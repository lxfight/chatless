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

    // —— 早阻断抑制阀 ——
    const visible = applySuppressionValve(context, chunk);
    if (!visible) return;

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
        chunk: visible // 经过抑制阀后的可见文本
      });

    } catch (error) {
      console.error('[ContentHandler] Failed to dispatch action:', error);
      // 不抛出错误，避免中断整个流
    }
  }
}

/**
 * 早阻断“抑制阀”
 * - 保留一段尾部缓冲（guardWindow），在缓冲内检测指令起点
 * - 一旦命中指令触发词，进入抑制态：吞掉所有字符，直到 JSON 大括号闭合或遇到换行等边界
 * - 抑制结束后，缓冲清零，恢复正常流出
 */
function applySuppressionValve(context: StreamContext, chunk: string): string {
  if (!context.suppression) {
    context.suppression = { buffer: '', active: false, braceDepth: 0, seenJsonStart: false, guardWindow: 64 };
  }
  const s = context.suppression;

  // 将新字符放入缓冲
  s.buffer += chunk;
  // 限制缓冲大小（保留最多 2048 字符，避免内存膨胀）
  if (s.buffer.length > 2048) s.buffer = s.buffer.slice(-2048);

  // 定义触发器：多形态工具调用前缀
  const triggerRegexes: RegExp[] = [
    /<\|channel\|\>\s*commentary\s+to=/i,     // GPT‑OSS 标记版
    /commentary\s+to=/i,                      // 无标记变体
    /(?:^|\s)to\s*=\s*[a-z0-9_.-]+/i,         // 极简变体：to=server.tool
    /<use_mcp_tool>/i,
    /<tool_call>/i,
  ];

  // 未进入抑制态时，检查触发
  if (!s.active) {
    const text = s.buffer;
    let hitIndex = -1;
    for (const re of triggerRegexes) {
      const m = re.exec(text);
      if (m && (hitIndex === -1 || m.index < hitIndex)) hitIndex = m.index;
    }
    if (hitIndex >= 0) {
      // 命中触发：进入抑制态。把触发点之前的内容作为“可见输出”，触发点及之后的内容全部抑制。
      const visible = text.slice(0, hitIndex);
      const suppressedTail = text.slice(hitIndex);
      s.active = true;
      s.braceDepth = 0;
      s.seenJsonStart = false;
      s.buffer = suppressedTail; // 仅保留被抑制的片段，等待判定结束
      // 通知 UI：开始工具识别占位
      try {
        const st = useChatStore.getState();
        st.dispatchMessageAction(context.messageId, { type: 'TOOL_DETECTING_START' } as any);
      } catch { /* noop */ }
      return visible;
    }
    // 未命中触发：按“守护窗口”策略释放一部分，降低延迟
    if (text.length > s.guardWindow) {
      const emit = text.slice(0, text.length - s.guardWindow);
      s.buffer = text.slice(text.length - s.guardWindow);
      return emit;
    }
    // 缓冲不足窗口，先不输出
    return '';
  }

  // 抑制态：吞掉字符直到判断指令结束
  // 规则：遇到 JSON 起始 { 后进入计数，遇到 } 归零即结束；
  // 若迟迟未出现 {，遇到换行或分号等硬边界也视为结束（容错）
  for (let i = 0; i < s.buffer.length; i++) {
    const ch = s.buffer[i];
    if (ch === '{') { s.seenJsonStart = true; s.braceDepth++; }
    else if (ch === '}') { if (s.braceDepth > 0) s.braceDepth--; }

    const isBoundary = /\n|;/.test(ch);
    const done = (s.seenJsonStart && s.braceDepth === 0) || (!s.seenJsonStart && isBoundary);
    if (done) {
      // 指令结束：清空缓冲，退出抑制
      s.buffer = '';
      s.active = false;
      s.braceDepth = 0;
      s.seenJsonStart = false;
      // 通知 UI：结束工具识别占位
      try {
        const st = useChatStore.getState();
        st.dispatchMessageAction(context.messageId, { type: 'TOOL_DETECTING_END' } as any);
      } catch { /* noop */ }
      return ''; // 整个指令段被吞掉，不输出任何字符
    }
  }
  // 仍在抑制态：继续吞
  return '';
}

