// 仅保留必要调试输出，不禁用全局 no-console
import { serverManager } from './ServerManager';
import { buildSchemaHint, buildDetailedToolGuide } from './schemaHints';
import { useChatStore } from '@/store/chatStore';
import { streamChat } from '@/lib/llm';
import { persistentCache } from './persistentCache';
import { mcpCallHistory } from './callHistory';
import type { Message as LlmMessage, StreamCallbacks } from '@/lib/llm/types';
import { DEFAULT_MAX_TOOL_RECURSION_DEPTH } from './constants';
import StorageUtil from '@/lib/storage';
import { shouldAutoAuthorize } from './authorizationConfig';
import { useAuthorizationStore } from '@/store/authorizationStore';
import { invoke } from '@tauri-apps/api/core';
import { useWebSearchStore } from '@/store/webSearchStore';
import { getProviderCredentials, isMissingRequiredCredentials } from '@/lib/websearch/registry';
import { WEB_SEARCH_SERVER_NAME } from './nativeTools/webSearch';

// 防止重复调用的缓存
const runningCalls = new Map<string, Promise<void>>();

/**
 * 确保MCP服务器已连接，如果未连接则尝试重连
 */
async function ensureServerConnected(serverName: string): Promise<void> {
  try {
    const { useMcpStore } = await import('@/store/mcpStore');
    const store = useMcpStore.getState();
    const status = store.serverStatuses[serverName];
    
    console.log(`[MCP-RECONNECT] 检查服务器 ${serverName} 连接状态: ${status}`);
    
    // 如果服务器未连接，尝试重连
    if (status !== 'connected') {
      console.log(`[MCP-RECONNECT] 服务器 ${serverName} 未连接，尝试重连...`);
      
      // 获取服务器配置
      const { Store } = await import('@tauri-apps/plugin-store');
      const cfgStore = await Store.load('mcp_servers.json');
      const srvList: Array<{ name: string; config: any; enabled?: boolean }> = (await cfgStore.get('servers')) || [];
      const found = srvList.find(s => s.name === serverName);
      
      if (!found) {
        console.error(`[MCP-RECONNECT] 未找到服务器 ${serverName} 的配置`);
        throw new Error(`服务器 ${serverName} 配置未找到`);
      }
      
      // 尝试重连
      console.log(`[MCP-RECONNECT] 开始重连服务器 ${serverName}...`);
      await serverManager.reconnect(serverName, found.config);
      console.log(`[MCP-RECONNECT] 服务器 ${serverName} 重连成功`);
    } else {
      console.log(`[MCP-RECONNECT] 服务器 ${serverName} 已连接，无需重连`);
    }
  } catch (error) {
    console.error(`[MCP-RECONNECT] 确保服务器连接失败:`, error);
    throw error;
  }
}

export async function executeToolCall(params: {
  assistantMessageId: string;
  conversationId: string;
  server: string;
  tool: string;
  args?: Record<string, unknown>;
  _runningMarker: string; // 兼容旧参数（未使用）
  provider: string;
  model: string;
  historyForLlm: LlmMessage[];
  originalUserContent: string;
  cardId?: string;
}): Promise<void> {
  const { assistantMessageId, conversationId, server, tool, args, _runningMarker, provider, model, historyForLlm, originalUserContent, cardId } = params;
  
  // 防重复调用：使用消息ID+工具+参数作为键
  const callKey = `${assistantMessageId}:${server}.${tool}:${JSON.stringify(args || {})}`;
  const existingCall = runningCalls.get(callKey);
  if (existingCall) {
    console.log(`[MCP-DEBUG] 跳过重复调用: ${callKey}`);
    return existingCall;
  }

  const DEBUG_MCP = false;
  if (DEBUG_MCP) { try { console.log('[MCP-ORCH] start', assistantMessageId, server, tool); } catch { /* noop */ } }

  // 关键修复：进入工具阶段即标记当前助手消息为 loading，保证停止按钮持续可见
  try {
    const st0 = useChatStore.getState();
    const conv0 = st0.conversations.find(c => c.id === conversationId);
    const msg0: any = conv0?.messages.find(m => m.id === assistantMessageId);
    // 若用户已停止（被标记为 error），则不再继续后续链路
    if (!msg0 || msg0.status === 'error') {
      return;
    }
    // 确保 loading 状态维持期间停止按钮可见
    void st0.updateMessage(assistantMessageId, { status: 'loading' });
  } catch { /* noop */ }

  const effectiveTool = (server === 'filesystem' && tool === 'list') ? 'dir' : tool;
  const effectiveArgs = normalizeArgs(server, args || {});

  // 重复调用检查移至授权判定之后，避免绕过授权开关

  // —— 原生工具拦截：web_search ——（加入授权判定与缓存复用）
  if (server === WEB_SEARCH_SERVER_NAME) {
    const executeNative = (async () => {
      try {
        // 授权检查（不可绕过）
        const autoAuth = await shouldAutoAuthorize(server);
        if (!autoAuth) {
          const effectiveCardId = cardId || crypto.randomUUID();
          const st = useChatStore.getState();
          if (!cardId) {
            st.dispatchMessageAction(assistantMessageId, { 
              type: 'TOOL_RESULT', 
              server, 
              tool: effectiveTool, 
              ok: false, 
              errorMessage: 'pending_auth',
              cardId: effectiveCardId 
            });
          }
          const authorized = await new Promise<boolean>((resolve) => {
            const authStore = useAuthorizationStore.getState();
            authStore.addPendingAuthorization({
              id: effectiveCardId,
              messageId: assistantMessageId,
              server,
              tool: effectiveTool,
              args: effectiveArgs || {},
              createdAt: Date.now(),
              onApprove: () => resolve(true),
              onReject: () => resolve(false)
            });
          });
          if (!authorized) {
            st.dispatchMessageAction(assistantMessageId, { 
              type: 'TOOL_RESULT', 
              server, 
              tool: effectiveTool, 
              ok: false, 
              errorMessage: '用户拒绝授权此工具调用',
              cardId: effectiveCardId 
            });
            await continueWithToolResult({
              assistantMessageId,
              provider,
              model,
              conversationId,
              historyForLlm,
              originalUserContent,
              server,
              tool: effectiveTool,
              result: {
                error: 'AUTHORIZATION_DENIED',
                message: '用户拒绝了此工具调用。这可能是因为用户认为此调用不合理或参数有误。'
              }
            });
            return;
          }
        }

        // 授权通过后再尝试使用缓存结果
        if (mcpCallHistory.isDuplicateCall(server, effectiveTool, effectiveArgs)) {
          const recent = mcpCallHistory.getRecentResult(server, effectiveTool, effectiveArgs);
          if (recent) {
            const st = useChatStore.getState();
            const resultPreview = typeof recent === 'string' ? recent.slice(0, 12000) : JSON.stringify(recent).slice(0, 12000);
            st.dispatchMessageAction(assistantMessageId, { type: 'TOOL_RESULT', server, tool: effectiveTool, ok: true, resultPreview, cardId });
            await continueWithToolResult({ assistantMessageId, provider, model, conversationId, historyForLlm, originalUserContent, server, tool: effectiveTool, result: recent });
            return;
          }
        }

        const cfg = useWebSearchStore.getState();
        const conversationProvider = cfg.getConversationProvider(conversationId);
        const providerToUse = conversationProvider || cfg.provider;
        const { apiKey, cseId } = getProviderCredentials(providerToUse as any, {
          apiKeyGoogle: cfg.apiKeyGoogle,
          cseIdGoogle: cfg.cseIdGoogle,
          apiKeyBing: cfg.apiKeyBing,
          apiKeyOllama: (cfg as any).apiKeyOllama,
        });
        const query = typeof (effectiveArgs as any)?.query === 'string' ? String((effectiveArgs as any).query) : '';

        // —— 调试日志：记录本次计划的 provider 与参数（去敏）
        try {
          console.log('[WEB_SEARCH] plan', {
            provider: providerToUse,
            hasApiKey: !!apiKey,
            hasCseId: !!cseId,
            conversationId,
            messageId: assistantMessageId,
            tool: effectiveTool,
            queryPreview: (query || '').slice(0, 200),
          });
        } catch { /* noop */ }

        // 缺少密钥/必需配置时，右下角通知并在卡片中给出可读提示
        const missingKey = isMissingRequiredCredentials(providerToUse as any, {
          apiKeyGoogle: cfg.apiKeyGoogle,
          cseIdGoogle: cfg.cseIdGoogle,
          apiKeyBing: cfg.apiKeyBing,
          apiKeyOllama: (cfg as any).apiKeyOllama,
        });
        if (missingKey) {
          const msg = '未配置相关网络搜索密钥，请切换到其他可用的搜索提供商。';
          try {
            const { toast } = await import('@/components/ui/sonner');
            toast.error('网络搜索不可用', { description: msg });
          } catch { /* ignore */ }
          const st = useChatStore.getState();
          try { st.appendTextToMessageSegments(assistantMessageId, msg); } catch { /* noop */ }
          st.dispatchMessageAction(assistantMessageId, { 
            type: 'TOOL_RESULT', 
            server, tool: effectiveTool, ok: false, 
            errorMessage: msg, 
            cardId 
          });
          try { console.warn('[WEB_SEARCH] missing credentials', { provider: providerToUse, hasApiKey: !!apiKey, hasCseId: !!cseId }); } catch { /* noop */ }
          await continueWithToolResult({
            assistantMessageId,
            provider,
            model,
            conversationId,
            historyForLlm,
            originalUserContent,
            server,
            tool: effectiveTool,
            result: { error: 'WEB_SEARCH_CREDENTIALS_MISSING', message: msg }
          });
          return;
        }

        const request = {
          provider: providerToUse,
          query,
          apiKey: apiKey,
          cseId: cseId,
        };

        // —— 发起原生调用（带日志）
        try {
          console.log('[WEB_SEARCH] invoke(native_web_search) -> start', {
            provider: providerToUse,
            hasApiKey: !!apiKey,
            hasCseId: !!cseId,
            queryPreview: (query || '').slice(0, 200),
          });
        } catch { /* noop */ }
        const result = await invoke('native_web_search', { request });
        try {
          if (Array.isArray(result)) {
            console.log('[WEB_SEARCH] invoke(native_web_search) -> ok', {
              count: result.length,
              first: (result as unknown[])[0],
            });
          } else {
            const previewStr = typeof result === 'string' ? result : JSON.stringify(result ?? {}).slice(0, 300);
            console.log('[WEB_SEARCH] invoke(native_web_search) -> ok', previewStr);
          }
        } catch { /* noop */ }

        // 记录成功
        mcpCallHistory.recordCall(server, effectiveTool, effectiveArgs, true, result);
        const st = useChatStore.getState();
        const resultPreview = typeof result === 'string' ? result.slice(0, 12000) : JSON.stringify(result).slice(0, 12000);
        st.dispatchMessageAction(assistantMessageId, { type: 'TOOL_RESULT', server, tool: effectiveTool, ok: true, resultPreview, cardId });

        await continueWithToolResult({ assistantMessageId, provider, model, conversationId, historyForLlm, originalUserContent, server, tool: effectiveTool, result });
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        try {
          console.error('[WEB_SEARCH] invoke(native_web_search) -> error', {
            error: err,
            provider: (useWebSearchStore.getState().getConversationProvider(conversationId) || useWebSearchStore.getState().provider),
            messageId: assistantMessageId,
            tool: effectiveTool,
          });
        } catch { /* noop */ }
        mcpCallHistory.recordCall(server, effectiveTool, effectiveArgs, false);
        const st = useChatStore.getState();
        const hint = `原生网络搜索 ${server}.${effectiveTool} 失败: ${err}`;
        st.dispatchMessageAction(assistantMessageId, { type: 'TOOL_RESULT', server, tool: effectiveTool, ok: false, errorMessage: err, schemaHint: hint, cardId });
        await continueWithToolResult({
          assistantMessageId,
          provider,
          model,
          conversationId,
          historyForLlm,
          originalUserContent,
          server,
          tool: effectiveTool,
          result: { error: 'CALL_TOOL_FAILED', message: err, schemaHint: hint }
        });
      } finally {
        runningCalls.delete(callKey);
      }
    })();
    runningCalls.set(callKey, executeNative);
    return executeNative;
  }

  // 工具存在性校验（若可获取列表）
  try {
    // 优先使用持久化缓存获取工具列表
    let available = await persistentCache.getToolsWithCache(server);
    if (!Array.isArray(available) || available.length === 0) {
      // 缓存失败，使用原有方法
      const { getToolsCached } = await import('./toolsCache');
      available = await getToolsCached(server);
    }
    if (available && Array.isArray(available)) {
      const ok = available.some((t: any) => (t?.name || '').toLowerCase() === String(effectiveTool).toLowerCase());
      if (!ok) {
        const toolList = (available || []).filter((t:any)=>t?.name).map((t:any)=>{
          const nm = String(t.name);
          const desc = t?.description ? String(t.description) : '';
          return desc ? `${nm} - ${desc}` : nm;
        });
        const hint = `错误：服务器"${server}"中找不到工具"${effectiveTool}"。\n\n该服务器的可用工具如下：\n${toolList.map(tool => `• ${tool}`).join('\n')}`;
        console.warn(`[MCP] 工具不存在: ${server}.${effectiveTool}`);
        
        const stx = useChatStore.getState();
        // 改为通过状态机更新已有"运行中"卡片，避免生成重复卡片
        const fixHint = `解决方案：请从以下可用工具中选择一个：\n${toolList.map(tool => `• ${tool}`).join('\n')}\n\n然后重新调用：<use_mcp_tool><server_name>${server}</server_name><tool_name>正确的工具名</tool_name><arguments>{}</arguments></use_mcp_tool>`;
        stx.dispatchMessageAction(assistantMessageId, { type: 'TOOL_RESULT', server, tool: effectiveTool, ok: false, errorMessage: hint, schemaHint: fixHint, cardId });
        // 关键修复：即使工具不存在，也把该错误作为“工具调用结果”继续进入追问流程，驱动模型自我纠正
        await continueWithToolResult({
          assistantMessageId,
          provider,
          model,
          conversationId,
          historyForLlm,
          originalUserContent,
          server,
          tool: effectiveTool,
          result: {
            error: 'TOOL_NOT_FOUND',
            message: hint,
            availableTools: (available?.map((t:any)=>t?.name).filter(Boolean) || []),
            availableToolsWithDescriptions: toolList,
          }
        });
        return;
      }
    }
  } catch { /* ignore */ }

  // 将执行逻辑包装为Promise并缓存
  const executePromise = (async () => {
    try {
      // 降噪：仅输出一条简要起止日志
      console.debug(`[MCP] 调用 ${server}.${effectiveTool}`);
      
      // 授权检查
      const autoAuth = await shouldAutoAuthorize(server);
      console.debug(`[MCP-AUTH] 授权检查: ${server}.${effectiveTool}, auto=${autoAuth}`);
      
      if (!autoAuth) {
        // 需要用户授权
        const effectiveCardId = cardId || crypto.randomUUID();
        console.debug(`[MCP-AUTH] 等待用户授权: ${server}.${effectiveTool}`);
        
        const st = useChatStore.getState();
        
        // 注意：如果卡片已经在tool_call事件时设置为pending_auth，这里就不需要再次更新
        // 只有在没有cardId时才需要设置（比如手动调用的情况）
        if (!cardId) {
          st.dispatchMessageAction(assistantMessageId, { 
            type: 'TOOL_RESULT', 
            server, 
            tool: effectiveTool, 
            ok: false, 
            errorMessage: 'pending_auth',
            cardId: effectiveCardId 
          });
        }
        
        // 等待用户授权
        const authorized = await new Promise<boolean>((resolve) => {
          const authStore = useAuthorizationStore.getState();
          authStore.addPendingAuthorization({
            id: effectiveCardId,
            messageId: assistantMessageId,
            server,
            tool: effectiveTool,
            args: effectiveArgs || {},
            createdAt: Date.now(),
            onApprove: () => resolve(true),
            onReject: () => resolve(false)
          });
        });
        
        console.debug(`[MCP-AUTH] 授权结果: ${server}.${effectiveTool}, ok=${authorized}`);
        
        if (!authorized) {
          // 用户拒绝授权
          console.warn(`[MCP-AUTH] 用户拒绝: ${server}.${effectiveTool}`);
          st.dispatchMessageAction(assistantMessageId, { 
            type: 'TOOL_RESULT', 
            server, 
            tool: effectiveTool, 
            ok: false, 
            errorMessage: '用户拒绝授权此工具调用',
            cardId: effectiveCardId 
          });
          
          // 继续追问流程，让AI知道用户拒绝了
          await continueWithToolResult({
            assistantMessageId,
            provider,
            model,
            conversationId,
            historyForLlm,
            originalUserContent,
            server,
            tool: effectiveTool,
            result: {
              error: 'AUTHORIZATION_DENIED',
              message: '用户拒绝了此工具调用。这可能是因为用户认为此调用不合理或参数有误。请考虑用户的反馈，调整你的方法或询问用户的具体需求。'
            }
          });
          return;
        }
        
        // 用户批准，卡片已经存在（pending_auth状态），不需要再创建
        // 授权批准后，卡片会在工具执行完成时自动更新为 success
        console.debug(`[MCP-AUTH] 已批准，继续: ${server}.${effectiveTool}`);
      }
      
      // 授权通过后：若短时间内相同请求已成功，直接复用结果并继续追问链路
      if (mcpCallHistory.isDuplicateCall(server, effectiveTool, effectiveArgs)) {
        const recent = mcpCallHistory.getRecentResult(server, effectiveTool, effectiveArgs);
        if (recent) {
          const stDup = useChatStore.getState();
          const resultPreview = typeof recent === 'string' ? recent.slice(0, 12000) : JSON.stringify(recent).slice(0, 12000);
          stDup.dispatchMessageAction(assistantMessageId, { type: 'TOOL_RESULT', server, tool: effectiveTool, ok: true, resultPreview, cardId });
          await continueWithToolResult({ assistantMessageId, provider, model, conversationId, historyForLlm, originalUserContent, server, tool, result: recent });
          return;
        }
      }
      
      // 检查服务器连接状态，如果未连接则尝试重连
      await ensureServerConnected(server);
      
      const result = await serverManager.callTool(server, effectiveTool, effectiveArgs || undefined);
      console.debug(`[MCP] 成功: ${server}.${effectiveTool}`);
    
    // 记录成功调用
    mcpCallHistory.recordCall(server, effectiveTool, effectiveArgs, true, result);
    
    if (DEBUG_MCP) { try { console.log('[MCP-ORCH] ok', server, effectiveTool); } catch { /* noop */ } }
    const resultPreview = typeof result === 'string' ? result.slice(0, 12000) : JSON.stringify(result).slice(0, 12000);

    const st = useChatStore.getState();
    st.dispatchMessageAction(assistantMessageId, { type: 'TOOL_RESULT', server, tool: effectiveTool, ok: true, resultPreview, cardId });

      await continueWithToolResult({ assistantMessageId, provider, model, conversationId, historyForLlm, originalUserContent, server, tool, result });
    } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    
    console.error(`[MCP] 工具调用失败: ${server}.${effectiveTool}`, {
      server,
      tool: effectiveTool,
      args: effectiveArgs,
      error: err,
      errorType: typeof e,
      errorStack: e instanceof Error ? e.stack : undefined,
      timestamp: new Date().toISOString()
    });
    
    // 记录失败调用
    mcpCallHistory.recordCall(server, effectiveTool, effectiveArgs, false);
    
    if (DEBUG_MCP) { try { console.warn('[MCP-ORCH] err', server, effectiveTool); } catch { /* noop */ } }
    let schemaHint = '';
    try { schemaHint = await buildSchemaHint(server, effectiveTool); } catch { /* ignore */ }
    let detailedGuide: { text: string; spec: any } | null = null;
    try { detailedGuide = await buildDetailedToolGuide(server, effectiveTool, effectiveArgs || {}); } catch { /* ignore */ }

    const st = useChatStore.getState();
    // —— 分阶段提示：按同一对话内相同 server.tool 的失败次数递进 ——
    const failStage = incToolFailCount(conversationId, server, effectiveTool);
    let combinedHint = '';
    if (failStage <= 1) {
      // 第1次：仅给出简短 schema 示例与必填项，提示精确重试
      combinedHint = [
        '参数提示（精简）：',
        schemaHint || '',
        '请按示例与必填项修正 arguments 后重试本工具。'
      ].filter(Boolean).join('\n');
    } else if (failStage === 2) {
      // 第2次：给出聚焦纠错摘要 + 最小可行模板
      const concise = buildConciseGuideText(detailedGuide?.spec);
      combinedHint = [
        '参数纠错建议（聚焦）：',
        concise || schemaHint || '',
        '请优先补齐缺失必填项，修正类型/枚举后再试。'
      ].filter(Boolean).join('\n');
    } else {
      // 第3次及以上：提供完整详细引导 + 可替代工具建议
      let toolsSuggest = '';
      try {
        const { getToolsCached } = await import('./toolsCache');
        const available = await getToolsCached(server);
        const toolList = (available || []).filter((t:any)=>t?.name).map((t:any)=>{
          const nm = String(t.name);
          const desc = t?.description ? String(t.description) : '';
          return desc ? `${nm} - ${desc}` : nm;
        }).slice(0, 20);
        if (toolList.length) toolsSuggest = `若仍失败，可考虑改用：\n${toolList.join('\n')}`;
      } catch { /* ignore */ }
      combinedHint = [
        '详细引导：',
        detailedGuide?.text || schemaHint || '',
        toolsSuggest
      ].filter(Boolean).join('\n');
    }
    console.warn(`[MCP] 工具调用错误: ${server}.${effectiveTool} -> ${err}`);
    st.dispatchMessageAction(assistantMessageId, { type: 'TOOL_RESULT', server, tool: effectiveTool, ok: false, errorMessage: err, schemaHint: combinedHint, cardId });
    // 关键修复：当调用发生错误时，也继续走追问链路，把错误与 schema 提示一并提供给模型
    try {
      await continueWithToolResult({
        assistantMessageId,
        provider,
        model,
        conversationId,
        historyForLlm,
        originalUserContent,
        server,
        tool: effectiveTool,
        result: { error: 'CALL_TOOL_FAILED', message: err, schemaHint: combinedHint, toolSpec: detailedGuide?.spec, failStage }
      });
    } catch { /* ignore */ }
    } finally {
      // 清理缓存
      runningCalls.delete(callKey);
    }
  })();

  // 缓存Promise
  runningCalls.set(callKey, executePromise);
  return executePromise;
}

function normalizeArgs(srv: string, originalArgs: Record<string, unknown>) {
  const a: Record<string, unknown> & { path?: string } = { ...(originalArgs || {}) };
  // Filesystem: 统一路径分隔符
  if (srv === 'filesystem' && typeof a.path === 'string') {
    a.path = a.path.replace(/\\/g, '/');
  }
  return a;
}

async function continueWithToolResult(params: {
  assistantMessageId: string;
  provider: string;
  model: string;
  conversationId: string;
  historyForLlm: LlmMessage[];
  originalUserContent: string;
  server: string;
  tool: string;
  result: unknown;
}) {
  const { assistantMessageId, provider, model, conversationId, historyForLlm, originalUserContent, server, tool, result } = params;
  const key = conversationId;
  const counterKey = `mcp-recursion-${key}`;
  // 简易递归限制（避免依赖外部模块）
  const current = (globalThis as any)[counterKey] || 0;
  // 读取设置中的递归深度（mcp-settings.json）
  let maxDepth = DEFAULT_MAX_TOOL_RECURSION_DEPTH;
  try {
    const val = await StorageUtil.getItem<number|'infinite'>('max_tool_recursion_depth', DEFAULT_MAX_TOOL_RECURSION_DEPTH, 'mcp-settings.json');
    if (val === 'infinite') maxDepth = Number.POSITIVE_INFINITY;
    else if (typeof val === 'number' && val >= 2 && val <= 15) maxDepth = val;
  } catch { /* use default */ }
  if (current >= maxDepth) {
    (globalThis as any)[counterKey] = 0;
    // 显示右下角通知
    try {
      const { toast } = await import('@/components/ui/sonner');
      toast.warning('MCP递归调用已达上限', {
        description: `已达到最大递归深度 ${maxDepth}，停止继续调用工具。您可以在MCP高级设置中调整此限制。`,
        duration: 6000,
      });
    } catch (err) {
      console.warn('[MCP] 显示递归限制通知失败:', err);
    }
    return;
  }
  (globalThis as any)[counterKey] = current + 1;

  // 根据结果类型生成精准的追问提示
  const isError = typeof result === 'object' && result && (result as any).error;
  const isEmptyResult = !result || (typeof result === 'string' && result.trim().length === 0) || 
                       (Array.isArray(result) && result.length === 0);
  const isConnectionError = isError && String((result as any).message || '').includes('Transport send error');
  
  // 检测是否是有效的结果数据（通用判断）
  const hasValidData = !isError && !isEmptyResult && (
    (typeof result === 'string' && result.trim().length > 10) || // 有意义的字符串结果
    (typeof result === 'object' && result && Object.keys(result).length > 0) // 有内容的对象结果
  );
  
  let instruction = '';
  if (isConnectionError) {
    instruction = '上述调用因连接问题失败（服务器正在重连），请稍等片刻后重新调用相同工具。用户已授权，可直接重试。';
  } else if (isError) {
    instruction = '上述调用失败，请根据错误信息分析原因并重新调用或使用其他工具。';
  } else if (isEmptyResult) {
    instruction = '上述调用返回空结果，可能需要调整参数或使用其他工具获取信息。';
  } else if (hasValidData) {
    instruction = '上述调用已返回结果，请基于结果回答用户问题。';
  } else {
    instruction = '请基于上述结果回答用户问题，如信息不足可继续调用相关工具。';
  }

  // 二显一策略：只把摘要用于提示，不在正文回显原始JSON，以免与卡片重复
  const _followSummary = (() => {
    try {
      const obj = typeof result === 'string' ? JSON.parse(result) : result as any;
      if (obj && typeof obj === 'object') {
        const keys = Object.keys(obj).slice(0, 8);
        return `键: ${keys.join(', ')} (长度≈${JSON.stringify(obj).length})`;
      }
    } catch { /* ignore */ }
    const s = (typeof result === 'string' ? result : JSON.stringify(result ?? {})).replace(/\s+/g,' ').slice(0, 300);
    return `${s}${s.length>=300?'…':''}`;
  })();

  // 构造“包含真实结果”的追问消息（避免模型凭空猜测）
  const { toolResultToNextMessage } = await import('@/lib/mcp/providerAdapters');
  const nextUserMsg = toolResultToNextMessage(provider as any, server, tool, result, originalUserContent);
  // 将工程化的补充说明拼接到消息末尾，保留真实结果文本
  nextUserMsg.content = `${nextUserMsg.content}\n\n—— 追加说明 ——\n${instruction}\n\n（注意：上述JSON/文本只作为事实依据，不要直接回显给用户）`;

  const _st = useChatStore.getState();
  // 继续在同一条 assistant 消息中流式续写，不新建消息

  // 生成唯一的系统提示词，避免重复
  const toolResultSystemPrompt = `基于工具调用结果回答用户问题。
- 如结果充分，直接回答
- 如有错误或不足，可调用其他工具
- 【关键】需要调用工具时，直接在回复正文中输出完整的工具调用标签，不要只在思考中描述计划
- 使用工具格式：<use_mcp_tool><server_name>[服务器名]</server_name><tool_name>[工具名]</tool_name><arguments>[JSON参数]</arguments></use_mcp_tool>
- 格式示例：<use_mcp_tool><server_name>filesystem</server_name><tool_name>read_file</tool_name><arguments>{"path":"example.txt"}</arguments></use_mcp_tool>

原始问题：${originalUserContent}`;

  const followHistory: LlmMessage[] = [
    { role: 'system', content: toolResultSystemPrompt } as any,
    ...historyForLlm.filter((m:any)=>m.role!=='user' || m.content!==originalUserContent),
    nextUserMsg as any
  ];

  const { StreamTokenizer } = await import('@/lib/chat/StreamTokenizer');
  const tokenizer = new StreamTokenizer();
  const { createStreamEventDispatcher } = await import('@/lib/chat/stream/StreamEventDispatcher');
  const dispatcher = createStreamEventDispatcher({
    conversationId,
    assistantMessageId,
    onAutoExecuteTool: (srv, tl, a, cardId) => {
      void executeToolCall({
        assistantMessageId,
        conversationId,
        server: srv,
        tool: tl,
        args: a,
        _runningMarker: '',
        provider,
        model,
        historyForLlm: followHistory,
        originalUserContent,
        cardId,
      });
    },
    onRequestAuthorization: ({ server: srv, tool: tl, args: a, cardId }) => {
      const authStore = useAuthorizationStore.getState();
      authStore.addPendingAuthorization({
        id: cardId,
        messageId: assistantMessageId,
        server: srv,
        tool: tl,
        args: a || {},
        createdAt: Date.now(),
        onApprove: () => {
          void executeToolCall({
            assistantMessageId,
            conversationId,
            server: srv,
            tool: tl,
            args: a,
            _runningMarker: '',
            provider,
            model,
            historyForLlm: followHistory,
            originalUserContent,
            cardId,
          });
        },
        onReject: () => {
          const st = useChatStore.getState();
          st.dispatchMessageAction(assistantMessageId, {
            type: 'TOOL_RESULT',
            server: srv,
            tool: tl,
            ok: false,
            errorMessage: '用户拒绝授权此工具调用',
            cardId,
          });
          
          // 用户拒绝后继续追问流程，让AI知道用户再次拒绝了
          void continueWithToolResult({
            assistantMessageId,
            provider,
            model,
            conversationId,
            historyForLlm: followHistory,
            originalUserContent,
            server: srv,
            tool: tl,
            result: {
              error: 'AUTHORIZATION_DENIED',
              message: '用户拒绝了此工具调用。这可能是因为用户认为此调用不合理或参数有误。请考虑用户的反馈，调整你的方法或询问用户的具体需求。'
            }
          });
        },
      });
    },
  });
  // 递归阶段：hadText 用于决定是否触发“追问”流程
  let hadText = false; // 本轮是否收到过正文 token
  let eventModeUsed = false;

  // 关键修复：追问阶段开始前再次确保状态为 loading（覆盖上游可能的 sent）
  try {
    const stPre = useChatStore.getState();
    const convPre = stPre.conversations.find(c => c.id === conversationId);
    const msgPre: any = convPre?.messages.find(m => m.id === assistantMessageId);
    // 若用户已停止（被标记为 error），直接跳过追问阶段
    if (!msgPre || msgPre.status === 'error') {
      (globalThis as any)[counterKey] = 0;
      return;
    }
    void stPre.updateMessage(assistantMessageId, { status: 'loading' });
  } catch { /* noop */ }

  const callbacks: StreamCallbacks = {
    onStart: () => {},
    // 新增：优先使用结构化事件流（push式组件开始/结束）
    onEvent: (event: any) => {
      eventModeUsed = true;
      try {
        dispatcher.handle(event);
        const s = dispatcher.getState();
        if (s.hadText) hadText = true;
      } catch { /* noop */ }
    },
    onToken: (tk: string) => {
      if (eventModeUsed) return;
      try {
        const events = tokenizer.push(tk);
        for (const ev of events) { dispatcher.handle(ev as any); }
        if (dispatcher.getState().hadText) hadText = true;
      } catch { /* ignore detector error */ }
    },
              onComplete: () => {
      const stf2 = useChatStore.getState();
      
      // 事件模式或降级模式：都要在收尾时 flush，避免尾部字符与抑制阀缓冲丢失
      try {
        if (!eventModeUsed) {
          const flushEvents = tokenizer.flush();
          for (const ev of flushEvents) { dispatcher.handle(ev as any); }
        }
        dispatcher.flush();
      } catch { /* noop */ }
      
      // 关键修复：确保在流式结束时强制保存所有内容，包括最后的token
      try {
        const convNow = stf2.conversations.find(c=>c.id===conversationId);
        const msgNow = convNow?.messages.find(m=>m.id===assistantMessageId);
        const contentNow = msgNow?.content || '';
        // 强制保存当前内容，确保最后的token不会丢失
        void stf2.updateMessage(assistantMessageId, { content: contentNow });
      } catch { /* noop */ }
      
      {
        const convf2 = stf2.conversations.find(c=>c.id===conversationId);
        const msgf2 = convf2?.messages.find(m=>m.id===assistantMessageId);
        const finalContent = msgf2?.content || '';
        // 若本轮没有任何正文输出，进行一次轻量“追问”以催促模型直接给出答案
        if (!hadText) {
          (async () => {
            // 为追问阶段构建更好的系统提示词
            const nudgeSystemPrompt = `你现在需要基于已获得的工具调用结果，完成最终回答或继续调用工具补充证据。

严格遵循：
1) 若现有结果已足够回答，请直接给出中文最终答案（≤ 300 字）；
2) 若仍缺少证据或需要查看/验证，请再次调用合适的工具（正文只输出 1 个 <use_mcp_tool> 标签，不要在标签外输出任何文字）；
3) 每次仅调用 1 个工具；完成后再次判断是否已能给出最终答案；
4) 禁止仅在思考中描述计划，必须把调用以 <use_mcp_tool> 形式写入正文；
5) 不要编造 Server 名称，从系统提供的“已启用 Server”中选择。 

用户问题：${originalUserContent}`;

            const nudgeHistory: LlmMessage[] = [
              { role: 'system', content: nudgeSystemPrompt } as any,
              ...followHistory, 
              { role: 'user', content: `请基于上述所有工具调用结果，分析并回答用户的原始问题。

请根据实际情况灵活处理：
1. 如果工具结果正常且足够，请直接给出完整的中文答案
2. 如果工具结果异常或不足，请继续调用相关工具
3. 如果需要调用工具，请使用 <use_mcp_tool><server_name>...</server_name><tool_name>...</tool_name><arguments>{...}</arguments></use_mcp_tool> 格式
4. 确保最终能够完整回答用户的原始问题` } as any
            ];
            const { StreamTokenizer } = await import('@/lib/chat/StreamTokenizer');
            const tk2 = new StreamTokenizer();
            let autosave2 = '';
            let pending2: null | { server: string; tool: string; args?: Record<string, unknown>; cardId: string } = null;
            let eventMode2 = false;
            const dispatcher2 = createStreamEventDispatcher({ conversationId, assistantMessageId });
            // 追问阶段仍按正常渲染与保存，但不再单独统计是否有文本
            const cb2: StreamCallbacks = {
              onStart: () => { /* stream started for nudge round */ },
              // 同样优先使用结构化事件，保证多轮思考都能独立渲染
              onEvent: (event: any) => {
                eventMode2 = true;
                try { dispatcher2.handle(event); } catch { /* noop */ }
              },
              onToken: (tk: string) => {
                if (eventMode2) return;
                const stx = useChatStore.getState();
                const convx = stx.conversations.find(c=>c.id===conversationId);
                const msgx = convx?.messages.find(m=>m.id===assistantMessageId);
                const curx = (msgx?.content || '') + tk;
                stx.updateMessageContentInMemory(assistantMessageId, curx);
                autosave2 += tk;
                if (autosave2.length > 200) { autosave2 = ''; try { void stx.updateMessage(assistantMessageId, { content: curx }); } catch (e) { void e; } }
                try {
                  const events = tk2.push(tk);
                  for (const ev of events) {
                    if (ev.type === 'thinking_start') stx.dispatchMessageAction(assistantMessageId, { type: 'THINK_START' } as any);
                    else if (ev.type === 'thinking_token') stx.dispatchMessageAction(assistantMessageId, { type: 'THINK_APPEND', chunk: ev.content } as any);
                    else if (ev.type === 'thinking_end') stx.dispatchMessageAction(assistantMessageId, { type: 'THINK_END' } as any);
                    else if (ev.type === 'content_token' && ev.content) { stx.dispatchMessageAction(assistantMessageId, { type: 'TOKEN_APPEND', chunk: ev.content }); }
                    else if (ev.type === 'tool_call' && !pending2) {
                      // 将回退解析到的 tool_call 转交统一分发器
                      try { dispatcher2.handle({ type: 'tool_call', parsed: ev.parsed }); } catch { /* noop */ }
                      // 不直接维护 pending2，由分发器插卡
                    }
                  }
                } catch (e) { void e; }
              },
              onComplete: () => {
                const sty = useChatStore.getState();
                
                // 关键修复：追问阶段无论是否事件模式，都要flush（tokenizer与dispatcher）
                try {
                  if (!eventMode2) {
                    const flushEvents = tk2.flush();
                    for (const ev of flushEvents) {
                      if (ev.type === 'content_token' && ev.content) {
                        sty.dispatchMessageAction(assistantMessageId, { type: 'TOKEN_APPEND', chunk: ev.content });
                      }
                    }
                  }
                  dispatcher2.flush();
                } catch { /* noop */ }
                
                if (pending2) {
                  const nx = pending2; pending2 = null;
                  // 启动下一轮工具
                  void executeToolCall({ assistantMessageId, conversationId, server: nx.server, tool: nx.tool, args: nx.args, _runningMarker: '', provider, model, historyForLlm: nudgeHistory, originalUserContent, cardId: nx.cardId });
                } else {
                  const convy = sty.conversations.find(c=>c.id===conversationId);
                  const msgy = convy?.messages.find(m=>m.id===assistantMessageId);
                  let content2 = msgy?.content || '';
                  // 若追问仍无任何正文，则使用结果生成一个最小可读的回退文本，避免界面空白
                  if (!content2 || content2.trim().length === 0) {
                    try {
                      if (server === WEB_SEARCH_SERVER_NAME && Array.isArray(result) && result.length > 0) {
                        const items: any[] = Array.isArray(result) ? result.slice(0, 5) : [];
                        const lines = items.map((it, i: number) => {
                          const t = (it?.source_title || it?.title || '').toString().trim();
                          const u = (it?.url || '').toString().trim();
                          return `${i + 1}. ${t}${u ? ` - ${u}` : ''}`;
                        });
                        const fallbackText = `根据网络搜索的结果，供参考：\n${lines.join('\n')}\n\n需要我基于这些链接进一步总结或继续检索吗？`;
                        try { sty.appendTextToMessageSegments(assistantMessageId, fallbackText); } catch { /* noop */ }
                        content2 = ((msgy?.content || '') + fallbackText).trim();
                      }
                    } catch { /* noop */ }
                  }
                  void sty.updateMessage(assistantMessageId, { status: 'sent', content: content2 });
                  sty.dispatchMessageAction(assistantMessageId, { type: 'STREAM_END' });
                  (globalThis as any)[counterKey] = 0;
                }
              },
              onError: (err: Error) => {
                const stz = useChatStore.getState();
                void stz.updateMessage(assistantMessageId, { status: 'error', content: err.message, error: true } as any);
                (globalThis as any)[counterKey] = 0;
              }
            } as any;
            await streamChat(provider, model, nudgeHistory as any, cb2 as any, {});
          })();
        } else {
          void stf2.updateMessage(assistantMessageId, { status: 'sent', content: finalContent });
          stf2.dispatchMessageAction(assistantMessageId, { type: 'STREAM_END' });
          (globalThis as any)[counterKey] = 0;

          // —— 在 MCP 递归链完全结束的稳定时机生成标题（仅一次）——
          (async () => {
            try {
              const state = useChatStore.getState();
              const conv = state.conversations.find(c => c.id === conversationId);
              if (!conv) return;
              const {
                shouldGenerateTitleAfterAssistantComplete,
                extractFirstUserMessageSeed,
                isDefaultTitle,
              } = await import('@/lib/chat/TitleGenerator');
              const { generateTitle } = await import('@/lib/chat/TitleService');
              if (!shouldGenerateTitleAfterAssistantComplete(conv)) return;
              const seed = extractFirstUserMessageSeed(conv);
              if (!seed || !seed.trim()) return;
              const gen = await generateTitle(provider, model, seed, { maxLength: 24, language: 'zh' });
              const st2 = useChatStore.getState();
              const conv2 = st2.conversations.find(c => c.id === conversationId);
              if (conv2 && isDefaultTitle(conv2.title) && gen && gen.trim()) {
                void st2.renameConversation(String(conversationId), gen.trim());
              }
            } catch { /* noop */ }
          })();
        }
      }
    },
    onError: (err: Error) => {
      const stf3 = useChatStore.getState();
      void stf3.updateMessage(assistantMessageId, { status: 'error', content: err.message, error: true } as any);
      (globalThis as any)[counterKey] = 0;
    }
  } as any;

  await streamChat(provider, model, followHistory as any, callbacks as any, {});
}

// —— 失败次数统计（同会话 + 服务器 + 工具）——
function getFailCounterKey(conversationId: string, server: string, tool: string): string {
  return `mcp-fails-${conversationId}::${server}::${tool}`;
}

function incToolFailCount(conversationId: string, server: string, tool: string): number {
  const k = getFailCounterKey(conversationId, server, tool);
  const cur = (globalThis as any)[k] || 0;
  const next = cur + 1;
  (globalThis as any)[k] = next;
  return next;
}

function buildConciseGuideText(spec: any): string {
  if (!spec || !spec.issues) return '';
  const lines: string[] = [];
  const missing: string[] = spec.issues.missingRequired || [];
  const unknown: string[] = spec.issues.unknownKeys || [];
  const mismatches: Array<{ key: string; expected: string; actual: string }> = spec.issues.typeMismatches || [];
  const enums: Array<{ key: string; expected: string[]; actual: any }> = spec.issues.enumViolations || [];
  if (missing.length) lines.push(`缺失必填：${missing.join(', ')}`);
  if (unknown.length) lines.push(`未知参数：${unknown.join(', ')}`);
  if (mismatches.length) lines.push(`类型不匹配：${mismatches.map((i)=>`${i.key}(期望:${i.expected}, 实际:${i.actual})`).join('; ')}`);
  if (enums.length) lines.push(`枚举不匹配：${enums.map((i)=>`${i.key}(允许:${(i.expected||[]).slice(0,20).join('|')}, 实际:${JSON.stringify(i.actual)})`).join('; ')}`);
  const sug = spec.suggestedArguments ? JSON.stringify(spec.suggestedArguments, null, 2) : '';
  if (sug) lines.push('建议的最小可行 arguments：\n' + sug);
  return lines.join('\n');
}

