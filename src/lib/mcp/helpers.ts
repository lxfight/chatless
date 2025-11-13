/**
 * MCP工具调用编排器的辅助函数
 * 
 * 本文件包含可复用的工具函数，用于减少代码重复和提高可维护性
 */

import type { Message } from '@/types/chat';
import type { StreamResponseLogger } from '@/lib/chat/stream/response-logger';

/**
 * 判断消息是否包含实际的文本内容
 * 
 * ⚠️ 【关键】：必须使用 segments 判断，不能使用 content！
 * 
 * 原因：
 * 1. content 包含原始LLM输出（含被suppression valve过滤的工具调用指令）
 * 2. content 的数据库同步是异步的，在判断时可能还是旧值或空值
 * 3. content 与用户实际看到的内容不一致（segments才是真实渲染内容）
 * 
 * 正确做法：
 * - 使用 segments 判断实际渲染的文本内容
 * - segments 由 FSM 实时驱动，反映UI的真实状态
 * 
 * @param store - ChatStore状态
 * @param conversationId - 会话ID
 * @param messageId - 消息ID
 * @returns 是否包含实际文本内容
 * 
 * @example
 * ```typescript
 * const store = useChatStore.getState();
 * const hasText = hasTextContent(store, conversationId, messageId);
 * if (!hasText) {
 *   // 触发fallback或第二次追问
 * }
 * ```
 */
export function hasTextContent(
  store: any,
  conversationId: string,
  messageId: string
): boolean {
  const conv = store.conversations.find((c: any) => c.id === conversationId);
  const msg = conv?.messages.find((m: any) => m.id === messageId);
  const segments = msg?.segments || [];
  const textSegments = segments.filter((s: any) => s.kind === 'text');
  return textSegments.some((s: any) => s.text && s.text.trim().length > 0);
}

/**
 * 查找指定的消息
 * 
 * @param store - ChatStore状态
 * @param conversationId - 会话ID
 * @param messageId - 消息ID
 * @returns 找到的消息，如果不存在则返回undefined
 * 
 * @example
 * ```typescript
 * const store = useChatStore.getState();
 * const message = findMessage(store, conversationId, messageId);
 * if (message) {
 *   // 处理消息
 * }
 * ```
 */
export function findMessage(
  store: any,
  conversationId: string,
  messageId: string
): Message | undefined {
  const conv = store.conversations.find((c: any) => c.id === conversationId);
  return conv?.messages.find((m: any) => m.id === messageId);
}

/**
 * 记录流式事件到响应日志
 * 
 * 统一的日志记录逻辑，避免在多处重复相同的代码。
 * 
 * @param event - 流式事件
 * @param logger - 响应日志记录器
 * 
 * @example
 * ```typescript
 * const logger = new StreamResponseLogger(provider, model);
 * 
 * onEvent: (event: any) => {
 *   logEventToResponseLogger(event, logger);
 *   // 其他处理...
 * }
 * ```
 */
export function logEventToResponseLogger(
  event: any,
  logger: StreamResponseLogger
): void {
  if (!event) return;
  
  if (event.type === 'thinking_token' && event.content) {
    logger.appendThinking(String(event.content));
  } else if (event.type === 'thinking_end') {
    logger.endThinking();
  } else if (event.type === 'content_token' && event.content) {
    logger.appendContent(String(event.content));
  }
}

/**
 * 获取消息的segments详细信息（用于调试）
 * 
 * @param store - ChatStore状态
 * @param conversationId - 会话ID
 * @param messageId - 消息ID
 * @returns segments的统计信息
 */
export function getSegmentsInfo(
  store: any,
  conversationId: string,
  messageId: string
): {
  segmentsCount: number;
  textSegmentsCount: number;
  hasText: boolean;
} {
  const msg = findMessage(store, conversationId, messageId);
  const segments = (msg as any)?.segments || [];
  const textSegments = segments.filter((s: any) => s.kind === 'text');
  const hasText = textSegments.some((s: any) => s.text && s.text.trim().length > 0);
  
  return {
    segmentsCount: segments.length,
    textSegmentsCount: textSegments.length,
    hasText
  };
}

