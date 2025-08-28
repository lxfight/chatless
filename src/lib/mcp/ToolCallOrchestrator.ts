// 仅保留必要调试输出，不禁用全局 no-console
import { serverManager } from './ServerManager';
import { buildSchemaHint } from './schemaHints';
import { useChatStore } from '@/store/chatStore';
import { streamChat } from '@/lib/llm';
import type { Message as LlmMessage, StreamCallbacks } from '@/lib/llm/types';
import { DEFAULT_MAX_TOOL_RECURSION_DEPTH } from './constants';
import StorageUtil from '@/lib/storage';

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
  const DEBUG_MCP = false;
  if (DEBUG_MCP) { try { console.log('[MCP-ORCH] start', assistantMessageId, server, tool); } catch { /* noop */ } }

  const effectiveTool = (server === 'filesystem' && tool === 'list') ? 'dir' : tool;
  const effectiveArgs = normalizeArgs(server, args || {});

  // 工具存在性校验（若可获取列表）
  try {
    const { getToolsCached } = await import('./toolsCache');
    const available = await getToolsCached(server);
    if (available && Array.isArray(available)) {
      const ok = available.some((t: any) => (t?.name || '').toLowerCase() === String(effectiveTool).toLowerCase());
      if (!ok) {
        const hint = `当前服务器(${server})不包含工具: ${effectiveTool}。请改为以下之一: ${available.map((t:any)=>t?.name).filter(Boolean).join(', ')}`;
        const stx = useChatStore.getState();
        // 改为通过状态机更新已有“运行中”卡片，避免生成重复卡片
        stx.dispatchMessageAction(assistantMessageId, { type: 'TOOL_RESULT', server, tool: effectiveTool, ok: false, errorMessage: hint, schemaHint: hint, cardId });
        return;
      }
    }
  } catch { /* ignore */ }

  try {
    const result = await serverManager.callTool(server, effectiveTool, effectiveArgs || undefined);
    if (DEBUG_MCP) { try { console.log('[MCP-ORCH] ok', server, effectiveTool); } catch { /* noop */ } }
    const resultPreview = typeof result === 'string' ? result : JSON.stringify(result).slice(0, 2000);

    const st = useChatStore.getState();
    st.dispatchMessageAction(assistantMessageId, { type: 'TOOL_RESULT', server, tool: effectiveTool, ok: true, resultPreview, cardId });

    await continueWithToolResult({ assistantMessageId, provider, model, conversationId, historyForLlm, originalUserContent, server, tool, result });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    if (DEBUG_MCP) { try { console.warn('[MCP-ORCH] err', server, effectiveTool); } catch { /* noop */ } }
    let schemaHint = '';
    try { schemaHint = await buildSchemaHint(server, effectiveTool); } catch { /* ignore */ }

    const st = useChatStore.getState();
    st.dispatchMessageAction(assistantMessageId, { type: 'TOOL_RESULT', server, tool: effectiveTool, ok: false, errorMessage: err, schemaHint, cardId });
  }
}

function normalizeArgs(srv: string, originalArgs: Record<string, unknown>) {
  const a: Record<string, unknown> & { path?: string } = { ...(originalArgs || {}) };
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
  if (current >= maxDepth) { (globalThis as any)[counterKey] = 0; return; }
  (globalThis as any)[counterKey] = current + 1;

  const follow = typeof result === 'string' ? result : JSON.stringify(result);
  const nextUser = `Here is the result of MCP tool use ${server}.${tool} -> ${follow.slice(0, 4000)}\nPlease produce the final answer directly. If another tool is required, output <tool_call>{json}</tool_call> only.`;

  const _st = useChatStore.getState();
  // 继续在同一条 assistant 消息中流式续写，不新建消息

  const followHistory: LlmMessage[] = [...historyForLlm.filter((m:any)=>m.role!=='user' || m.content!==originalUserContent)];
  followHistory.push({ role:'user', content: nextUser } as any);

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
            const marker = JSON.stringify({ __tool_call_card__: { id: cardId, server: ev.server, tool: ev.tool, status: 'running', args: ev.args || {}, messageId: assistantMessageId }});
            const next = prev + (prev ? '\n' : '') + marker;
            stf.updateMessageContentInMemory(assistantMessageId, next);
            // 写入 segments
            stf.dispatchMessageAction(assistantMessageId, { type: 'TOOL_HIT', server: ev.server, tool: ev.tool, args: ev.args, cardId });
          }
        }
      } catch { /* ignore detector error */ }
    },
    onComplete: () => {
      const stf2 = useChatStore.getState();
      if (pendingHit) {
        // 继续执行下一个工具调用（同条消息递归）
        const next = pendingHit; pendingHit = null;
        // 关键：在发起下一次工具调用前，先持久化当前消息内容，避免重启后丢失本阶段文本
        try {
          const convNow = stf2.conversations.find(c=>c.id===conversationId);
          const msgNow = convNow?.messages.find(m=>m.id===assistantMessageId);
          const contentNow = msgNow?.content || '';
          void stf2.updateMessage(assistantMessageId, { content: contentNow });
        } catch { /* noop */ }
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
        const convf2 = stf2.conversations.find(c=>c.id===conversationId);
        const msgf2 = convf2?.messages.find(m=>m.id===assistantMessageId);
        const finalContent = msgf2?.content || '';
        // 若本轮没有任何正文输出，进行一次轻量“追问”以催促模型直接给出答案
        if (!hadText) {
          (async () => {
            const nudgeHistory: LlmMessage[] = [...followHistory, { role: 'user', content: '请基于上面的工具结果，直接用中文给出完整答案。不要再调用任何工具，不要输出解释或前缀。' } as any];
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
                generateTitleFromFirstMessage,
                isDefaultTitle,
              } = await import('@/lib/chat/TitleGenerator');
              if (!shouldGenerateTitleAfterAssistantComplete(conv)) return;
              const seed = extractFirstUserMessageSeed(conv);
              if (!seed || !seed.trim()) return;
              const gen = await generateTitleFromFirstMessage(
                provider,
                model,
                seed,
                { maxLength: 24, language: 'zh', fallbackPolicy: 'none' }
              );
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

