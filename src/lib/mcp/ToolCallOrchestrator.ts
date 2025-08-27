// 仅保留必要调试输出，不禁用全局 no-console
import { serverManager } from './ServerManager';
import { buildSchemaHint } from './schemaHints';
import { useChatStore } from '@/store/chatStore';
import { streamChat } from '@/lib/llm';
import type { Message as LlmMessage, StreamCallbacks } from '@/lib/llm/types';
import { MAX_TOOL_RECURSION_DEPTH } from './constants';

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
  try { console.log('[MCP-ORCH] start', assistantMessageId, server, tool); } catch { /* noop */ }

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
    try { console.log('[MCP-ORCH] ok', server, effectiveTool); } catch { /* noop */ }
    const resultPreview = typeof result === 'string' ? result : JSON.stringify(result).slice(0, 2000);

    const st = useChatStore.getState();
    st.dispatchMessageAction(assistantMessageId, { type: 'TOOL_RESULT', server, tool: effectiveTool, ok: true, resultPreview, cardId });

    await continueWithToolResult({ assistantMessageId, provider, model, conversationId, historyForLlm, originalUserContent, server, tool, result });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    try { console.warn('[MCP-ORCH] err', server, effectiveTool); } catch { /* noop */ }
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
  if (current >= MAX_TOOL_RECURSION_DEPTH) { (globalThis as any)[counterKey] = 0; return; }
  (globalThis as any)[counterKey] = current + 1;

  const follow = typeof result === 'string' ? result : JSON.stringify(result);
  const nextUser = `Here is the result of MCP tool use ${server}.${tool} -> ${follow.slice(0, 4000)}\nPlease produce the final answer directly. If another tool is required, output <tool_call>{json}</tool_call> only.`;

  const _st = useChatStore.getState();
  // 继续在同一条 assistant 消息中流式续写，不新建消息

  const followHistory: LlmMessage[] = [...historyForLlm.filter((m:any)=>m.role!=='user' || m.content!==originalUserContent)];
  followHistory.push({ role:'user', content: nextUser } as any);

  const { StructuredStreamTokenizer } = await import('@/lib/chat/StructuredStreamTokenizer');
  const tokenizer = new StructuredStreamTokenizer();
  let pendingHit: null | { server: string; tool: string; args?: Record<string, unknown>; cardId: string } = null;
  const callbacks: StreamCallbacks = {
    onStart: () => {},
    onToken: (tk: string) => {
      const stf = useChatStore.getState();
      const convf = stf.conversations.find(c=>c.id===conversationId);
      const msgf = convf?.messages.find(m=>m.id===assistantMessageId);
      const cur = (msgf?.content || '') + tk;
      stf.updateMessageContentInMemory(assistantMessageId, cur);

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
            if ((ev as any).chunk) stf.dispatchMessageAction(assistantMessageId, { type: 'TOKEN_APPEND', chunk: (ev as any).chunk });
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
        void stf2.updateMessage(assistantMessageId, { status: 'sent', content: finalContent });
        stf2.dispatchMessageAction(assistantMessageId, { type: 'STREAM_END' });
        (globalThis as any)[counterKey] = 0;
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

