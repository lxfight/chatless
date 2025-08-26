// 仅保留必要调试输出，不禁用全局 no-console
import { serverManager } from './ServerManager';
import { buildSchemaHint } from './schemaHints';
import { useChatStore } from '@/store/chatStore';
import { v4 as uuidv4 } from 'uuid';
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
        await stx.updateMessage(assistantMessageId, {
          status: 'error',
          content: JSON.stringify({ __tool_call_card__: { id: uuidv4(), status: 'error', server, tool: effectiveTool, args: effectiveArgs || {}, errorMessage: hint, schemaHint: hint, messageId: assistantMessageId } })
        } as any);
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

  const { StreamingToolDetector } = await import('./StreamingToolDetector');
  const detector = new StreamingToolDetector();
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
        const hit = detector.push(tk);
        if (hit) {
          // 记录一次命中，待本轮流式完成后触发下一次工具调用
          if (!pendingHit) {
            const cardId = crypto.randomUUID();
            pendingHit = { server: hit.server, tool: hit.tool, args: hit.args, cardId };
            stf.dispatchMessageAction(assistantMessageId, { type: 'TOOL_HIT', server: hit.server, tool: hit.tool, args: hit.args, cardId });
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

