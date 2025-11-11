/**
 * 内容事件处理器（线性委派架构）
 * 
 * ## 职责（单一职责原则）
 * 
 * 1. 接收 content_token 事件
 * 2. 累积原始内容到上下文（用于tool_call解析）
 * 3. 转发给FSM处理
 * 
 * ## 不负责（委派给下游）
 * 
 * - ❌ 内容过滤：由 segments 层负责（`filterToolCallContent`）
 * - ❌ 状态管理：由 FSM 负责
 * - ❌ UI更新：由 FSM → segments → UI 负责
 * 
 * ## 设计理念
 * 
 * 像流水线一样，每个环节只做自己该做的事：
 * ```
 * ContentEventHandler (接收+转发)
 *     ↓
 * FSM (状态管理+路由)
 *     ↓
 * Segments (业务逻辑+过滤)
 *     ↓
 * UI (纯渲染)
 * ```
 */

import type { StreamEvent } from '@/lib/llm/types/stream-events';
import type { EventHandler, StreamContext } from '../types';
import { useChatStore } from '@/store/chatStore';

export class ContentEventHandler implements EventHandler {
  canHandle(event: StreamEvent): boolean {
    return event.type === 'content_token';
  }

  handle(event: StreamEvent, context: StreamContext): void {
    // 输入验证
    if (!event || event.type !== 'content_token') {
      console.warn('[ContentHandler] Invalid event received:', event);
      return;
    }

    if (!context || !context.messageId) {
      console.error('[ContentHandler] Invalid context: missing messageId');
      return;
    }

    const chunk = String(event.content || '');
    if (!chunk) return;

    // 防止内容无限增长（保护措施）
    if (context.content.length > 1000000) { // 1MB 限制
      console.warn('[ContentHandler] Content size limit reached, skipping token');
      return;
    }

    // 累积原始内容（保留完整内容，包括工具调用指令）
    // 这用于 ToolCallEventHandler 解析工具调用
    context.content += chunk;

    // 转发给FSM处理（带错误处理）
    try {
      const store = useChatStore.getState();
      
      if (!store || typeof store.dispatchMessageAction !== 'function') {
        console.error('[ContentHandler] Invalid store state');
        return;
      }

      // 直接派发原始chunk，过滤由segments层负责
      // 这是线性委派的核心：上游不处理，交给下游处理
      store.dispatchMessageAction(context.messageId, { 
        type: 'TOKEN_APPEND', 
        chunk  // 原始chunk，未过滤
      });

    } catch (error) {
      console.error('[ContentHandler] Failed to dispatch action:', error);
      // 不抛出错误，避免中断整个流
    }
  }
}

