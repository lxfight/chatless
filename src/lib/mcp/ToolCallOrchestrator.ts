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

  const effectiveTool = (server === 'filesystem' && tool === 'list') ? 'dir' : tool;
  const effectiveArgs = normalizeArgs(server, args || {});

  // 检查是否是重复调用
  if (mcpCallHistory.isDuplicateCall(server, effectiveTool, effectiveArgs)) {
    const recentResult = mcpCallHistory.getRecentResult(server, effectiveTool, effectiveArgs);
    if (recentResult) {
      console.log(`[MCP-DEBUG] 使用缓存结果避免重复调用: ${server}.${effectiveTool}`);
      
      const stx = useChatStore.getState();
      stx.dispatchMessageAction(assistantMessageId, { 
        type: 'TOOL_RESULT', 
        server, 
        tool: effectiveTool, 
        ok: true, 
        result: recentResult, 
        cardId 
      });
      return;
    }
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
        console.log(`[MCP-DEBUG] 工具不存在错误 - 服务器=${server}, 工具=${effectiveTool}`, { hint, toolList });
        
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
      console.log(`[MCP-DEBUG] 准备调用工具: ${server}.${effectiveTool}`, {
        server,
        tool: effectiveTool,
        args: effectiveArgs,
        argsType: typeof effectiveArgs,
        argsSize: effectiveArgs ? JSON.stringify(effectiveArgs).length : 0
      });
      
      // 授权检查
      const autoAuth = await shouldAutoAuthorize(server);
      console.log(`[MCP-AUTH] 授权检查: ${server}.${effectiveTool}, 自动授权=${autoAuth}`);
      
      if (!autoAuth) {
        // 需要用户授权
        const effectiveCardId = cardId || crypto.randomUUID();
        console.log(`[MCP-AUTH] 等待用户授权: ${server}.${effectiveTool}, cardId=${effectiveCardId}`);
        
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
        
        console.log(`[MCP-AUTH] 授权结果: ${server}.${effectiveTool}, authorized=${authorized}`);
        
        if (!authorized) {
          // 用户拒绝授权
          console.log(`[MCP-AUTH] 用户拒绝授权: ${server}.${effectiveTool}`);
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
        console.log(`[MCP-AUTH] 用户批准授权，继续执行: ${server}.${effectiveTool}`);
      }
      
      // 检查服务器连接状态，如果未连接则尝试重连
      await ensureServerConnected(server);
      
      const result = await serverManager.callTool(server, effectiveTool, effectiveArgs || undefined);
    
    console.log(`[MCP-DEBUG] 工具调用成功: ${server}.${effectiveTool}`, {
      resultType: typeof result,
      resultSize: result ? (typeof result === 'string' ? result.length : JSON.stringify(result).length) : 0
    });
    
    // 记录成功调用
    mcpCallHistory.recordCall(server, effectiveTool, effectiveArgs, true, result);
    
    if (DEBUG_MCP) { try { console.log('[MCP-ORCH] ok', server, effectiveTool); } catch { /* noop */ } }
    const resultPreview = typeof result === 'string' ? result.slice(0, 12000) : JSON.stringify(result).slice(0, 12000);

    const st = useChatStore.getState();
    st.dispatchMessageAction(assistantMessageId, { type: 'TOOL_RESULT', server, tool: effectiveTool, ok: true, resultPreview, cardId });

      await continueWithToolResult({ assistantMessageId, provider, model, conversationId, historyForLlm, originalUserContent, server, tool, result });
    } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    
    console.error(`[MCP-DEBUG] 工具调用失败: ${server}.${effectiveTool}`, {
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
    console.log(`[MCP-DEBUG] 工具调用错误`, { server, effectiveTool, err, combinedHint, failStage });
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

  const follow = typeof result === 'string' ? result : JSON.stringify(result);
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

  const nextUser = `原始问题：${originalUserContent}

工具结果：${server}.${tool} -> ${follow.slice(0, 8000)}

${instruction}`;

  const _st = useChatStore.getState();
  // 继续在同一条 assistant 消息中流式续写，不新建消息

  // 生成唯一的系统提示词，避免重复
  const toolResultSystemPrompt = `基于工具调用结果回答用户问题。
- 如结果充分，直接回答
- 如有错误或不足，可调用其他工具
- 使用工具格式：<use_mcp_tool><server_name>S</server_name><tool_name>T</tool_name><arguments>{JSON}</arguments></use_mcp_tool>

原始问题：${originalUserContent}`;

  const followHistory: LlmMessage[] = [
    { role: 'system', content: toolResultSystemPrompt } as any,
    ...historyForLlm.filter((m:any)=>m.role!=='user' || m.content!==originalUserContent),
    { role:'user', content: nextUser } as any
  ];

  const { StructuredStreamTokenizer } = await import('@/lib/chat/StructuredStreamTokenizer');
  const tokenizer = new StructuredStreamTokenizer();
  // 递归阶段增加轻量自动保存：每累计一定字符就写库一次，避免断电/重启丢失
  let autosaveBuffer = '';
  let pendingHit: null | { server: string; tool: string; args?: Record<string, unknown>; cardId: string } = null;
  let hadText = false; // 本轮是否收到过正文 token
  const callbacks: StreamCallbacks = {
    onStart: () => {},
    onToken: (tk: string) => {
      const stf = useChatStore.getState();
      const convf = stf.conversations.find(c=>c.id===conversationId);
      const msgf = convf?.messages.find(m=>m.id===assistantMessageId);
      const cur = (msgf?.content || '') + tk;
      stf.updateMessageContentInMemory(assistantMessageId, cur);
      autosaveBuffer += tk;
      if (autosaveBuffer.length > 200) {
        autosaveBuffer = '';
        try { void stf.updateMessage(assistantMessageId, { content: cur }); } catch { /* noop */ }
      }

      try {
        const events = tokenizer.push(tk);
        for (const ev of events) {
          if (ev.type === 'think_start') {
            stf.dispatchMessageAction(assistantMessageId, { type: 'THINK_START' } as any);
          } else if (ev.type === 'think_chunk') {
            stf.dispatchMessageAction(assistantMessageId, { type: 'THINK_APPEND', chunk: ev.chunk } as any);
          } else if (ev.type === 'think_end') {
            stf.dispatchMessageAction(assistantMessageId, { type: 'THINK_END' } as any);
          } else if (ev.type === 'text') {
            // 关键：续流阶段也要把正文 token 追加到 segments
            if ((ev as any).chunk) {
              hadText = true;
              stf.dispatchMessageAction(assistantMessageId, { type: 'TOKEN_APPEND', chunk: (ev as any).chunk });
            }
          }
          if (ev.type === 'tool_call' && !pendingHit) {
            const cardId = crypto.randomUUID();
            pendingHit = { server: ev.server, tool: ev.tool, args: ev.args, cardId };
            // 在内容末尾追加卡片标记以确保可见
            const prev = (msgf?.content || '') + '';
            
            // 检查是否需要授权
            void (async () => {
              try {
                const needAuth = !(await shouldAutoAuthorize(ev.server));
                const marker = JSON.stringify({ 
                  __tool_call_card__: { 
                    id: cardId, 
                    server: ev.server, 
                    tool: ev.tool, 
                    status: needAuth ? 'pending_auth' : 'running',
                    args: ev.args || {}, 
                    messageId: assistantMessageId 
                  }
                });
                const next = prev + (prev ? '\n' : '') + marker;
                stf.updateMessageContentInMemory(assistantMessageId, next);
                
                // 根据授权状态写入不同的segments
                if (needAuth) {
                  // 需要授权，创建pending_auth状态的卡片
                  stf.dispatchMessageAction(assistantMessageId, { 
                    type: 'TOOL_RESULT', 
                    server: ev.server, 
                    tool: ev.tool, 
                    ok: false,
                    errorMessage: 'pending_auth',
                    cardId 
                  });
                } else {
                  // 自动授权，创建running状态的卡片
                  stf.dispatchMessageAction(assistantMessageId, { 
                    type: 'TOOL_HIT', 
                    server: ev.server, 
                    tool: ev.tool, 
                    args: ev.args, 
                    cardId 
                  });
                }
              } catch (error) {
                console.error('[MCP-AUTH] 授权检查失败:', error);
                // 出错时默认需要授权
                const marker = JSON.stringify({ 
                  __tool_call_card__: { 
                    id: cardId, 
                    server: ev.server, 
                    tool: ev.tool, 
                    status: 'pending_auth',
                    args: ev.args || {}, 
                    messageId: assistantMessageId 
                  }
                });
                const next = prev + (prev ? '\n' : '') + marker;
                stf.updateMessageContentInMemory(assistantMessageId, next);
                stf.dispatchMessageAction(assistantMessageId, { 
                  type: 'TOOL_RESULT', 
                  server: ev.server, 
                  tool: ev.tool, 
                  ok: false,
                  errorMessage: 'pending_auth',
                  cardId 
                });
              }
            })();
          }
        }
      } catch { /* ignore detector error */ }
    },
              onComplete: () => {
      const stf2 = useChatStore.getState();
      
      // 关键修复：在流式结束时调用tokenizer的flush方法，确保缓冲区中的最后几个字符被处理
      try {
        const flushEvents = tokenizer.flush();
        for (const ev of flushEvents) {
          if (ev.type === 'text' && (ev as any).chunk) {
            stf2.dispatchMessageAction(assistantMessageId, { type: 'TOKEN_APPEND', chunk: (ev as any).chunk });
          }
        }
      } catch { /* noop */ }
      
      // 关键修复：确保在流式结束时强制保存所有内容，包括最后的token
      try {
        const convNow = stf2.conversations.find(c=>c.id===conversationId);
        const msgNow = convNow?.messages.find(m=>m.id===assistantMessageId);
        const contentNow = msgNow?.content || '';
        // 强制保存当前内容，确保最后的token不会丢失
        void stf2.updateMessage(assistantMessageId, { content: contentNow });
      } catch { /* noop */ }
      
      if (pendingHit) {
        // 检查是否需要授权 - 只有自动授权的才在这里执行
        const next = pendingHit; pendingHit = null;
        
        // 异步检查授权状态，只有自动授权的才立即执行
        void (async () => {
          try {
            const autoAuth = await shouldAutoAuthorize(next.server);
            if (autoAuth) {
              // 自动授权，立即执行
              console.log(`[MCP-COMPLETE] 自动授权，立即执行: ${next.server}.${next.tool}`);
              void executeToolCall({
                assistantMessageId,
                conversationId,
                server: next.server,
                tool: next.tool,
                args: next.args,
                _runningMarker: '',
                provider,
                model,
                historyForLlm: followHistory,
                originalUserContent: originalUserContent,
                cardId: next.cardId,
              });
            } else {
              // 需要用户授权，创建授权请求并等待用户确认
              console.log(`[MCP-COMPLETE] 需要用户授权，创建授权请求: ${next.server}.${next.tool}`);
              
              // 创建授权请求，等待用户批准
              const authStore = useAuthorizationStore.getState();
              await new Promise<boolean>((resolve) => {
                authStore.addPendingAuthorization({
                  id: next.cardId,
                  messageId: assistantMessageId,
                  server: next.server,
                  tool: next.tool,
                  args: next.args || {},
                  createdAt: Date.now(),
                  onApprove: () => {
                    console.log(`[MCP-AUTH] 用户批准授权: ${next.server}.${next.tool}`);
                    resolve(true);
                    // 用户批准后执行工具调用
                    void executeToolCall({
                      assistantMessageId,
                      conversationId,
                      server: next.server,
                      tool: next.tool,
                      args: next.args,
                      _runningMarker: '',
                      provider,
                      model,
                      historyForLlm: followHistory,
                      originalUserContent: originalUserContent,
                      cardId: next.cardId,
                    });
                  },
                  onReject: () => {
                    console.log(`[MCP-AUTH] 用户拒绝授权: ${next.server}.${next.tool}`);
                    resolve(false);
                    // 用户拒绝，更新卡片状态为error
                    const st = useChatStore.getState();
                    st.dispatchMessageAction(assistantMessageId, { 
                      type: 'TOOL_RESULT', 
                      server: next.server, 
                      tool: next.tool, 
                      ok: false, 
                      errorMessage: '用户拒绝授权此工具调用',
                      cardId: next.cardId 
                    });
                  }
                });
              });
            }
          } catch (error) {
            console.error('[MCP-COMPLETE] 授权检查失败:', error);
            // 出错时不执行，等待用户授权
          }
        })();
      } else {
        const convf2 = stf2.conversations.find(c=>c.id===conversationId);
        const msgf2 = convf2?.messages.find(m=>m.id===assistantMessageId);
        const finalContent = msgf2?.content || '';
        // 若本轮没有任何正文输出，进行一次轻量“追问”以催促模型直接给出答案
        if (!hadText) {
          (async () => {
            // 为追问阶段构建更好的系统提示词
            const nudgeSystemPrompt = `基于工具调用结果回答用户问题。

要求：
1. 有结果时直接回答
2. 结果不足时可调用其他工具
3. 遇到错误时重试或换用其他工具

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
            const { StructuredStreamTokenizer } = await import('@/lib/chat/StructuredStreamTokenizer');
            const tk2 = new StructuredStreamTokenizer();
            let autosave2 = '';
            let pending2: null | { server: string; tool: string; args?: Record<string, unknown>; cardId: string } = null;
            // 追问阶段仍按正常渲染与保存，但不再单独统计是否有文本
            const cb2: StreamCallbacks = {
              onStart: () => { /* stream started for nudge round */ },
              onToken: (tk: string) => {
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
                    if (ev.type === 'think_start') stx.dispatchMessageAction(assistantMessageId, { type: 'THINK_START' } as any);
                    else if (ev.type === 'think_chunk') stx.dispatchMessageAction(assistantMessageId, { type: 'THINK_APPEND', chunk: ev.chunk } as any);
                    else if (ev.type === 'think_end') stx.dispatchMessageAction(assistantMessageId, { type: 'THINK_END' } as any);
                    else if (ev.type === 'text' && (ev as any).chunk) { stx.dispatchMessageAction(assistantMessageId, { type: 'TOKEN_APPEND', chunk: (ev as any).chunk }); }
                    else if (ev.type === 'tool_call' && !pending2) {
                      // 即便模型再次提出工具调用，也按常规处理，保持一致体验
                      const cardId = crypto.randomUUID();
                      pending2 = { server: ev.server, tool: ev.tool, args: ev.args, cardId };
                      const prevx = (msgx?.content || '') + '';
                      const markerx = JSON.stringify({ __tool_call_card__: { id: cardId, server: ev.server, tool: ev.tool, status: 'running', args: ev.args || {}, messageId: assistantMessageId }});
                      const nextx = prevx + (prevx ? '\n' : '') + markerx;
                      stx.updateMessageContentInMemory(assistantMessageId, nextx);
                      stx.dispatchMessageAction(assistantMessageId, { type: 'TOOL_HIT', server: ev.server, tool: ev.tool, args: ev.args, cardId });
                    }
                  }
                } catch (e) { void e; }
              },
              onComplete: () => {
                const sty = useChatStore.getState();
                
                // 关键修复：在追问阶段流式结束时也调用tokenizer的flush方法
                try {
                  const flushEvents = tk2.flush();
                  for (const ev of flushEvents) {
                    if (ev.type === 'text' && (ev as any).chunk) {
                      sty.dispatchMessageAction(assistantMessageId, { type: 'TOKEN_APPEND', chunk: (ev as any).chunk });
                    }
                  }
                } catch { /* noop */ }
                
                if (pending2) {
                  const nx = pending2; pending2 = null;
                  // 启动下一轮工具
                  void executeToolCall({ assistantMessageId, conversationId, server: nx.server, tool: nx.tool, args: nx.args, _runningMarker: '', provider, model, historyForLlm: nudgeHistory, originalUserContent, cardId: nx.cardId });
                } else {
                  const convy = sty.conversations.find(c=>c.id===conversationId);
                  const msgy = convy?.messages.find(m=>m.id===assistantMessageId);
                  const content2 = msgy?.content || '';
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

