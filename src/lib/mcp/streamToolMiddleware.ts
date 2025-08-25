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
const frozenMessages = new Set<string>();

export function isMessageFrozen(id: string): boolean {
  return frozenMessages.has(id);
}

export async function insertRunningToolCardIfDetected(params: {
  assistantMessageId: string;
  conversationId: string;
  currentContent: string;
}): Promise<boolean> {
  const { assistantMessageId, conversationId, currentContent } = params;
  if (injectedRunning.has(assistantMessageId)) return false;
  const parsed = parseMcpToolCall(currentContent || '');
  // 增强：即使未形成完整 JSON/围栏，也要尽早冻结
  const containsOpenXml = /<tool_call/i.test(currentContent || '');
  const lastFence = (currentContent || '').lastIndexOf('```');
  const tail = lastFence >= 0 ? (currentContent || '').slice(lastFence) : '';
  const looksLikeToolJsonTail = lastFence >= 0 && /```[a-zA-Z]*\s*$/i.test((currentContent || '').slice(0, lastFence + 3))
    ? false
    : (tail.includes('"type"') && tail.replace(/\s+/g,'').includes('"tool_call"'));
  if (!parsed && !containsOpenXml && !looksLikeToolJsonTail) return false;

  const { server, tool, args } = parsed || { server: '', tool: '', args: {} } as any;
  const toolCallId = uuidv4();
  const runningMarker = JSON.stringify({ __tool_call_card__: { id: toolCallId, status: 'running', server, tool, args: args || {}, messageId: assistantMessageId } });
  const st = useChatStore.getState();
  const conv = st.conversations.find(c => c.id === conversationId);
  const msg = conv?.messages.find(m => m.id === assistantMessageId);
  // 使用当前内容作为基准，避免因异步写库导致替换 miss
  const base = (currentContent || msg?.content || '') || '';

  // 将 <tool_call>...</tool_call> 或独立 JSON 块替换为 runningMarker，避免代码在消息中显示
  let replaced = false;
  let newContent = base;
  try {
    // 1) XML 包裹（完整）
    newContent = newContent.replace(/<tool_call>[\s\S]*?<\/tool_call>/i, (m) => { replaced = true; return runningMarker; });
    // 2) 未闭合/已闭合代码块：从最近一次 ``` 开始到结尾，若尾部包含 tool_call 关键词，则直接截断替换
    if (!replaced && lastFence >= 0) {
      const afterFence = newContent.slice(lastFence);
      if (afterFence.includes('"type"') && afterFence.replace(/\s+/g,'').includes('"tool_call"')) {
        newContent = newContent.slice(0, lastFence) + runningMarker;
        replaced = true;
      }
    }
    // 3) 完整代码块
    if (!replaced) {
      const mblk = newContent.match(/```[a-zA-Z]*\n([\s\S]*?)\n```/);
      if (mblk && mblk[1] && /"type"\s*:\s*"tool_call"/i.test(mblk[1])) { newContent = newContent.replace(mblk[0], runningMarker); replaced = true; }
    }
    // 4) 行内 JSON（宽松）
    if (!replaced) {
      const mj = newContent.match(/\{[\s\S]*?"type"\s*:\s*"tool_call"[\s\S]*?\}/i);
      if (mj) { newContent = newContent.replace(mj[0], runningMarker); replaced = true; }
    }
  } catch { /* ignore and fallback to append */ }
  if (!replaced) {
    newContent = `${base}\n\n${runningMarker}`;
  }

  await st.updateMessage(assistantMessageId, { content: newContent } as any);
  injectedRunning.add(assistantMessageId);
  runningMarkerMap.set(assistantMessageId, runningMarker);
  frozenMessages.add(assistantMessageId);
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
  const base = (msg?.content && msg.content.length >= finalContent.length ? msg?.content : finalContent) as string;
  if (!injectedRunning.has(assistantMessageId)) {
    // 与流阶段相同：优先替换 JSON/标签，为空再追加
    let replaced = false;
    let newContent = base;
    try {
      // 同步流阶段的四步替换
      newContent = newContent.replace(/<tool_call>[\s\S]*?<\/tool_call>/i, (m) => { replaced = true; return runningMarker; });
      if (!replaced) {
        const lastFence = newContent.lastIndexOf('```');
        if (lastFence >= 0) {
          const afterFence = newContent.slice(lastFence);
          if (afterFence.includes('"type"') && afterFence.replace(/\s+/g,'').includes('"tool_call"')) {
            newContent = newContent.slice(0, lastFence) + runningMarker;
            replaced = true;
          }
        }
      }
      if (!replaced) {
        const mblk = newContent.match(/```[a-zA-Z]*\n([\s\S]*?)\n```/);
        if (mblk && mblk[1] && /"type"\s*:\s*"tool_call"/i.test(mblk[1])) { newContent = newContent.replace(mblk[0], runningMarker); replaced = true; }
      }
      if (!replaced) {
        const mj = newContent.match(/\{[\s\S]*?"type"\s*:\s*"tool_call"[\s\S]*?\}/i);
        if (mj) { newContent = newContent.replace(mj[0], runningMarker); replaced = true; }
      }
    } catch {}
    if (!replaced) newContent = `${base}\n\n${runningMarker}`;
    await st.updateMessage(assistantMessageId, { content: newContent });
    injectedRunning.add(assistantMessageId);
    runningMarkerMap.set(assistantMessageId, runningMarker);
  }
  frozenMessages.add(assistantMessageId);

  try {
    const result = await serverManager.callTool(server, effectiveTool, (effectiveArgs as any) || undefined);
    const resultPreview = typeof result === 'string' ? result : JSON.stringify(result).slice(0, 2000);
    const successMarker = JSON.stringify({ __tool_call_card__: { id: toolCallId, status: 'success', server, tool: effectiveTool, args: effectiveArgs || {}, resultPreview, messageId: assistantMessageId } });

    const st2 = useChatStore.getState();
    const conv2 = st2.conversations.find(c => c.id === conversationId);
    const msg2 = conv2?.messages.find(m => m.id === assistantMessageId);
    const old = msg2?.content ?? '';
    // 只替换第一张运行中卡片，避免重复卡片
    let newContent = old.replace(runningMarker, successMarker);
    if (newContent === old && old.includes('"__tool_call_card__"')) {
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

