/* eslint-disable no-console */
import { parseMcpToolCall } from './chatIntegration';
// imports kept for reference after refactor
// import { serverManager } from './ServerManager';
// import { buildSchemaHint } from './schemaHints';
// import { MAX_TOOL_RECURSION_DEPTH } from './constants';
// import { streamChat } from '@/lib/llm';
// 轻量段结构与FSM（渐进接入）
// import type { MessageFSM, MessageSegment } from './types';
import type { Message as LlmMessage } from '@/lib/llm/types';
import { v4 as uuidv4 } from 'uuid';
import { useChatStore } from '@/store/chatStore';
import { getToolsCached } from './toolsCache';

const injectedRunning = new Set<string>();
const runningMarkerMap = new Map<string, string>();
const frozenMessages = new Set<string>();
// 新增：消息修订号（用于避免覆盖插卡后的内容）。后续将替换为统一Persistor。
const messageRevision = new Map<string, number>();

export function isMessageFrozen(id: string): boolean {
  return frozenMessages.has(id);
}

export async function insertRunningToolCardIfDetected(params: {
  assistantMessageId: string;
  conversationId: string;
  currentContent: string;
  hint?: { server: string; tool: string; args?: Record<string, unknown> };
}): Promise<boolean> {
  const { assistantMessageId, conversationId, currentContent, hint } = params;
  try { console.log('[MCP-MW] tryInsertRunning', assistantMessageId, (currentContent||'').length); } catch { /* noop */ }
  // 若仍在 <think> 段内，禁止插卡与触发工具
  try {
    const txt = currentContent || '';
    const iStart = txt.lastIndexOf('<think>');
    const iEnd = txt.lastIndexOf('</think>');
    if (iStart !== -1 && (iEnd === -1 || iStart > iEnd)) {
      return false;
    }
  } catch { /* noop */ }
  if (injectedRunning.has(assistantMessageId)) return false;
  // 优先使用检测器传入的 hint，避免重复解析失败导致的漏判
  const parsed = hint || parseMcpToolCall(currentContent || '');
  // 增强：即使未形成完整 JSON/围栏，也要尽早冻结
  const containsOpenXml = /<tool_call/i.test(currentContent || '');
  const lastFence = (currentContent || '').lastIndexOf('```');
  const tail = lastFence >= 0 ? (currentContent || '').slice(lastFence) : '';
  // 新增：花括号平衡检测，避免必须等待 ``` 收尾
  const bracesBalanced = (() => {
    const s = (currentContent || '').slice(lastFence >= 0 ? lastFence : 0);
    let bal = 0; let seen = false;
    for (const ch of s) {
      if (ch === '{') { bal++; seen = true; }
      else if (ch === '}') { bal--; }
      if (bal < 0) break;
    }
    return seen && bal === 0;
  })();
  const looksLikeToolJsonTail = lastFence >= 0 && /```[a-zA-Z]*\s*$/i.test((currentContent || '').slice(0, lastFence + 3))
    ? false
    : ((tail.includes('"type"') && tail.replace(/\s+/g,'').includes('"tool_call"') && bracesBalanced));
  if (!parsed && !containsOpenXml && !looksLikeToolJsonTail) {
    try { console.log('[MCP-MW] skip: no signal'); } catch { /* noop */ }
    return false;
  }
  try { console.log('[MCP-MW] signal', !!parsed, containsOpenXml, looksLikeToolJsonTail); } catch { /* noop */ }

  const { server, tool, args } = parsed || { server: '', tool: '', args: {} };
  const toolCallId = uuidv4();
  const runningMarker = '';
  const st = useChatStore.getState();
  const conv = st.conversations.find(c => c.id === conversationId);
  const msg = conv?.messages.find(m => m.id === assistantMessageId) as any;
  const { ensureTextTail, insertRunningCard } = await import('@/lib/chat/segments');
  const oldSegs = ensureTextTail(Array.isArray(msg?.segments) ? [ ...msg.segments ] : [], (currentContent || msg?.content || '') || '');
  const newSegs = insertRunningCard(oldSegs, { id: toolCallId, server, tool, args: args || {}, messageId: assistantMessageId } as any);
  await st.updateMessage(assistantMessageId, { segments: newSegs });
  try { console.log('[MCP-MW] injected(seg)', assistantMessageId, server, tool); } catch { /* noop */ }
  injectedRunning.add(assistantMessageId);
  runningMarkerMap.set(assistantMessageId, runningMarker);
  frozenMessages.add(assistantMessageId);
  messageRevision.set(assistantMessageId, (messageRevision.get(assistantMessageId) || 0) + 1);
  return true;
}

export async function handleToolCallOnComplete(params: {
  assistantMessageId: string;
  conversationId: string;
  finalContent: string;
  provider: string;
  model: string;
  historyForLlm: LlmMessage[];
  originalUserContent: string;
}): Promise<void> {
  const { assistantMessageId, conversationId, finalContent, provider, model, historyForLlm, originalUserContent } = params;
  const parsed = parseMcpToolCall(finalContent || '');
  if (!parsed) return;
  try { console.log('[MCP-MW] onComplete parsed', assistantMessageId); } catch { /* noop */ }

  const { server, tool, args } = parsed as { server: string; tool: string; args?: Record<string, unknown> };
  // 兼容性修正：filesystem 服务器常用 dir 列目录；同时规范 Windows 路径分隔符
  const normalizeArgs = (srv: string, originalArgs: any) => {
    const a = { ...(originalArgs || {}) } as Record<string, unknown> & { path?: string };
    if (srv === 'filesystem' && typeof a.path === 'string') {
      a.path = a.path.replace(/\\/g, '/');
    }
    return a;
  };
  const effectiveTool = (server === 'filesystem' && tool === 'list') ? 'dir' : tool;
  const effectiveArgs = normalizeArgs(server, args);

  // 安全门：若工具不存在，则降级为提示信息并终止调用，避免“调用不存在方法”
  try {
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
  } catch {
    // ignore tools list fetching errors; proceed optimistically
  }
  const toolCallId = uuidv4();
  const runningMarker = runningMarkerMap.get(assistantMessageId) || JSON.stringify({ __tool_call_card__: { id: toolCallId, status: 'running', server, tool: effectiveTool, args: effectiveArgs || {}, messageId: assistantMessageId } });

  const st = useChatStore.getState();
  const conv = st.conversations.find(c => c.id === conversationId);
  const msg = conv?.messages.find(m => m.id === assistantMessageId);
  const base: string = (msg?.content && (msg as any).content.length >= finalContent.length ? (msg as any).content : finalContent) || '';
  if (!injectedRunning.has(assistantMessageId)) {
    try { console.log('[MCP-MW] merge(seg) at onComplete'); } catch { /* noop */ }
    const { ensureTextTail, insertRunningCard } = await import('@/lib/chat/segments');
    const oldSegs: any[] = ensureTextTail(Array.isArray(msg?.segments) ? [...(msg as any).segments] : [], base);
    const nextSegs = insertRunningCard(oldSegs as any, { id: toolCallId, server, tool: effectiveTool, args: effectiveArgs || {}, messageId: assistantMessageId } as any);
    await st.updateMessage(assistantMessageId, { segments: nextSegs as any } as any);
    injectedRunning.add(assistantMessageId);
    runningMarkerMap.set(assistantMessageId, runningMarker);
  }
  frozenMessages.add(assistantMessageId);

  // —— 统一通过编排器执行工具并回填 ——
  {
    const { executeToolCall } = await import('./ToolCallOrchestrator');
    try { console.log('[MCP-MW] exec', assistantMessageId, server, effectiveTool); } catch { /* noop */ }
    await executeToolCall({
      assistantMessageId,
      conversationId,
      server,
      tool: effectiveTool,
      args: effectiveArgs as Record<string, unknown>,
      runningMarker,
      provider,
      model,
      historyForLlm,
      originalUserContent,
      cardId: toolCallId,
    });
  }
}

// 编排器内已处理递归续写逻辑

