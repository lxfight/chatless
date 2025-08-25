import { parseMcpToolCall } from './chatIntegration';
import { serverManager } from './ServerManager';
import { buildSchemaHint } from './schemaHints';
import { MAX_TOOL_RECURSION_DEPTH } from './constants';
import { streamChat } from '@/lib/llm';
import type { Message as LlmMessage, StreamCallbacks } from '@/lib/llm/types';
import { v4 as uuidv4 } from 'uuid';
import { useChatStore } from '@/store/chatStore';
import { getToolsCached } from './toolsCache';

const injectedRunning = new Set<string>();
const runningMarkerMap = new Map<string, string>();

export async function insertRunningToolCardIfDetected(params: {
  assistantMessageId: string;
  conversationId: string;
  currentContent: string;
}): Promise<boolean> {
  const { assistantMessageId, conversationId, currentContent } = params;
  if (injectedRunning.has(assistantMessageId)) return;
  const parsed = parseMcpToolCall(currentContent || '');
  if (!parsed) return false;

  const { server, tool, args } = parsed;
  const toolCallId = uuidv4();
  const runningMarker = JSON.stringify({ __tool_call_card__: { id: toolCallId, status: 'running', server, tool, args: args || {}, messageId: assistantMessageId } });
  const st = useChatStore.getState();
  const conv = st.conversations.find(c => c.id === conversationId);
  const msg = conv?.messages.find(m => m.id === assistantMessageId);
  const base = (msg?.content ?? '') || '';
  await st.updateMessage(assistantMessageId, { content: `${base}\n\n${runningMarker}` } as any);
  injectedRunning.add(assistantMessageId);
  runningMarkerMap.set(assistantMessageId, runningMarker);
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

  const { server, tool, args } = parsed as any;
  // 兼容性修正：filesystem 服务器常用 dir 列目录；同时规范 Windows 路径分隔符
  const normalizeArgs = (srv: string, originalArgs: any) => {
    const a = { ...(originalArgs || {}) } as any;
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
  } catch {}
  const toolCallId = uuidv4();
  const runningMarker = runningMarkerMap.get(assistantMessageId) || JSON.stringify({ __tool_call_card__: { id: toolCallId, status: 'running', server, tool: effectiveTool, args: effectiveArgs || {}, messageId: assistantMessageId } });

  const st = useChatStore.getState();
  const conv = st.conversations.find(c => c.id === conversationId);
  const msg = conv?.messages.find(m => m.id === assistantMessageId);
  const base = msg?.content ?? finalContent;
  if (!injectedRunning.has(assistantMessageId)) {
    await st.updateMessage(assistantMessageId, { content: `${base}\n\n${runningMarker}` });
    injectedRunning.add(assistantMessageId);
    runningMarkerMap.set(assistantMessageId, runningMarker);
  }

  try {
    const result = await serverManager.callTool(server, effectiveTool, (effectiveArgs as any) || undefined);
    const resultPreview = typeof result === 'string' ? result : JSON.stringify(result).slice(0, 2000);
    const successMarker = JSON.stringify({ __tool_call_card__: { id: toolCallId, status: 'success', server, tool: effectiveTool, args: effectiveArgs || {}, resultPreview, messageId: assistantMessageId } });

    const st2 = useChatStore.getState();
    const conv2 = st2.conversations.find(c => c.id === conversationId);
    const msg2 = conv2?.messages.find(m => m.id === assistantMessageId);
    const old = msg2?.content ?? '';
    // 如果 runningMarker 被用户编辑或流式覆盖，优先追加替换两种可能：完全匹配与忽略空白差异匹配
    let newContent = old.replace(runningMarker, successMarker);
    if (newContent === old && old.includes('"__tool_call_card__"')) {
      // 回退：将第一张运行中卡片直接替换为成功卡
      newContent = old.replace(/\{\"__tool_call_card__\":\{[\s\S]*?\}\}/, successMarker);
    }
    await st2.updateMessage(assistantMessageId, { status: 'sent', content: newContent });

    // 递归续写
    await continueWithToolResult({ provider, model, conversationId, historyForLlm, originalUserContent, server, tool, result });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    let schemaHint = '';
    try { schemaHint = await buildSchemaHint(server, effectiveTool); } catch {}
    const errorMarker = JSON.stringify({ __tool_call_card__: { id: toolCallId, status: 'error', server, tool: effectiveTool, args: effectiveArgs || {}, errorMessage: err, schemaHint, messageId: assistantMessageId } });
    const st3 = useChatStore.getState();
    const conv3 = st3.conversations.find(c => c.id === conversationId);
    const msg3 = conv3?.messages.find(m => m.id === assistantMessageId);
    const old3 = msg3?.content ?? '';
    let newContent3 = old3.replace(runningMarker, errorMarker);
    if (newContent3 === old3 && old3.includes('\"__tool_call_card__\"')) {
      newContent3 = old3.replace(/\{\"__tool_call_card__\":\{[\s\S]*?\}\}/, errorMarker);
    }
    await st3.updateMessage(assistantMessageId, { status: 'error', content: newContent3 });
  }
}

const recursionCounter = new Map<string, number>();

async function continueWithToolResult(params: {
  provider: string;
  model: string;
  conversationId: string;
  historyForLlm: LlmMessage[];
  originalUserContent: string;
  server: string;
  tool: string;
  result: unknown;
}): Promise<void> {
  const { provider, model, conversationId, historyForLlm, originalUserContent, server, tool, result } = params;
  const key = conversationId;
  const count = recursionCounter.get(key) || 0;
  if (count >= MAX_TOOL_RECURSION_DEPTH) { recursionCounter.set(key, 0); return; }
  recursionCounter.set(key, count + 1);

  const follow = typeof result === 'string' ? result : JSON.stringify(result);
  const nextUser = `Here is the result of MCP tool use ${server}.${tool} -> ${follow.slice(0, 4000)}\nPlease produce the final answer directly. If another tool is required, output <tool_call>{json}</tool_call> only.`;

  const newAssistantId = uuidv4();
  const st = useChatStore.getState();
  await st.addMessage({
    id: newAssistantId,
    conversation_id: conversationId,
    role: 'assistant',
    content: '',
    created_at: Date.now(),
    updated_at: Date.now(),
    status: 'loading',
    model,
    thinking_start_time: Date.now(),
  } as any);

  const followHistory: LlmMessage[] = [...historyForLlm.filter((m:any)=>m.role!=='user' || m.content!==originalUserContent)];
  followHistory.push({ role:'user', content: nextUser } as any);

  const callbacks: StreamCallbacks = {
    onStart: () => {},
    onToken: (tk: string) => {
      const stf = useChatStore.getState();
      const convf = stf.conversations.find(c=>c.id===conversationId);
      const msgf = convf?.messages.find(m=>m.id===newAssistantId);
      const cur = (msgf?.content || '') + tk;
      stf.updateMessageContentInMemory(newAssistantId, cur);
    },
    onComplete: () => {
      const stf2 = useChatStore.getState();
      const convf2 = stf2.conversations.find(c=>c.id===conversationId);
      const msgf2 = convf2?.messages.find(m=>m.id===newAssistantId);
      stf2.updateMessage(newAssistantId, { status: 'sent', content: msgf2?.content || '' });
      recursionCounter.set(key, 0);
    },
    onError: (err: Error) => {
      const stf3 = useChatStore.getState();
      stf3.updateMessage(newAssistantId, { status: 'error', content: err.message, error: true } as any);
      recursionCounter.set(key, 0);
    }
  } as any;

  await streamChat(provider, model, followHistory as any, callbacks as any, {});
}

