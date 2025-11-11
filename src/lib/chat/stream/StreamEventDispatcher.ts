import { useChatStore } from '@/store/chatStore';
import { createContentAppender } from './ContentAppender';
import { handleToolCall } from './ToolCardService';
import { trace } from '@/lib/debug/Trace';

export type AnyStreamEvent = {
  type: string;
  content?: string;
  parsed?: any;
};

export interface StreamEventDispatcherOptions {
  conversationId: string;
  assistantMessageId: string;
  onAutoExecuteTool?: (server: string, tool: string, args: Record<string, unknown> | undefined, cardId: string) => void | Promise<void>;
  onRequestAuthorization?: (info: { server: string; tool: string; args: Record<string, unknown> | undefined; cardId: string }) => void | Promise<void>;
}

export interface StreamEventDispatcher {
  handle: (event: AnyStreamEvent) => void;
  flush: () => void;
  getState: () => { hadText: boolean; pendingTool?: { server: string; tool: string; cardId: string } | null };
}

export function createStreamEventDispatcher(opts: StreamEventDispatcherOptions): StreamEventDispatcher {
  const st = useChatStore.getState();
  const getCurContent = (): string => {
    const conv = st.conversations.find(c=>c.id===opts.conversationId);
    const msg = conv?.messages.find(m=>m.id===opts.assistantMessageId);
    return (msg?.content || '') + '';
  };
  const appender = createContentAppender({
    assistantMessageId: opts.assistantMessageId,
    updateMessageContentInMemory: st.updateMessageContentInMemory,
    updateMessage: st.updateMessage,
    getCurrentContent: getCurContent
  });
  let hadText = false;
  let pending: null | { server: string; tool: string; cardId: string } = null;
  let contentChars = 0;
  const eventCounts: Record<string, number> = Object.create(null);

  const handleToolCallInternal = async (parsed: any) => {
    if (pending) return;
    const server = parsed.serverName || parsed.server || '';
    const tool = parsed.toolName || parsed.tool || '';
    if (!server || !tool) return;
    const cardId = crypto.randomUUID();
    pending = { server, tool, cardId };
    trace('events', opts.assistantMessageId, `tool_call -> ${server}.${tool}`);
    await handleToolCall({
      conversationId: opts.conversationId,
      assistantMessageId: opts.assistantMessageId,
      parsed,
      onAutoExecute: opts.onAutoExecuteTool,
      onRequestAuthorization: opts.onRequestAuthorization
    });
  };

  return {
    handle: (event: AnyStreamEvent) => {
      const stx = useChatStore.getState();
      eventCounts[event?.type || 'unknown'] = (eventCounts[event?.type || 'unknown'] || 0) + 1;
      switch (event?.type) {
        case 'thinking_start':
          trace('events', opts.assistantMessageId, 'thinking_start');
          stx.dispatchMessageAction(opts.assistantMessageId, { type: 'THINK_START' } as any);
          break;
        case 'thinking_token':
          if ((event.content || '').length > 0 && (eventCounts['thinking_token'] % 20 === 1)) {
            trace('events', opts.assistantMessageId, `thinking_token +${(event.content || '').length}`);
          }
          if (event.content) stx.dispatchMessageAction(opts.assistantMessageId, { type: 'THINK_APPEND', chunk: event.content } as any);
          break;
        case 'thinking_end':
          trace('events', opts.assistantMessageId, 'thinking_end');
          stx.dispatchMessageAction(opts.assistantMessageId, { type: 'THINK_END' } as any);
          break;
        case 'content_token': {
          const chunk = String(event.content || '');
          if (!chunk) break;
          hadText = true;
          appender.append(chunk);
          contentChars += chunk.length;
          if (contentChars >= 500 && contentChars % 500 < chunk.length) {
            trace('events', opts.assistantMessageId, `content_token total=${contentChars}`);
          }
          // 段渲染：交给 FSM/segments 处理过滤
          stx.dispatchMessageAction(opts.assistantMessageId, { type: 'TOKEN_APPEND', chunk } as any);
          break;
        }
        case 'tool_call': {
          void handleToolCallInternal(event.parsed || {});
          break;
        }
        default:
          break;
      }
    },
    flush: () => {
      try { appender.flush(); } catch { /* noop */ }
      trace('events', opts.assistantMessageId, 'summary', { counts: eventCounts, contentChars, pendingTool: pending });
    },
    getState: () => ({ hadText, pendingTool: pending })
  };
}


