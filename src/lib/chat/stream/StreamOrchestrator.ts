/**
 * 流式处理编排器
 * 
 * 职责：
 * - 协调所有事件处理器
 * - 管理流式处理上下文
 * - 提供统一的流处理入口
 * - 处理错误和完成逻辑
 */

import type { StreamEvent } from '@/lib/llm/types/stream-events';
import type { StreamCallbacks } from '@/lib/llm/types';
import type { EventHandler, StreamContext, StreamOrchestratorConfig } from './types';
import { ThinkingEventHandler } from './handlers/ThinkingEventHandler';
import { ContentEventHandler } from './handlers/ContentEventHandler';
import { ToolCallEventHandler } from './handlers/ToolCallEventHandler';
import { StreamResponseLogger } from './response-logger';
import { useChatStore } from '@/store/chatStore';

/**
 * 流式处理编排器
 */
export class StreamOrchestrator {
  private context: StreamContext;
  private handlers: EventHandler[];
  private config: StreamOrchestratorConfig;
  private responseLogger: StreamResponseLogger;

  constructor(config: StreamOrchestratorConfig) {
    this.config = config;
    
    // 初始化上下文
    this.context = {
      messageId: config.messageId,
      conversationId: config.conversationId,
      content: '',
      toolStarted: false,
      thinkingStartTime: 0,
      fsmState: 'RENDERING_BODY',
      metadata: {
        provider: config.provider,
        model: config.model,
        originalUserContent: config.originalUserContent,
        historyForLlm: config.historyForLlm,
      },
    };

    // 初始化响应日志记录器
    this.responseLogger = new StreamResponseLogger(config.provider, config.model);

    // 注册事件处理器
    this.handlers = [
      new ThinkingEventHandler(),
      new ContentEventHandler(),
      new ToolCallEventHandler(),
    ];
  }

  /**
   * 创建流式回调
   */
  createCallbacks(): StreamCallbacks {
    return {
      onStart: () => {
        // 流开始 - 可以在这里做初始化
      },

      onEvent: async (event: StreamEvent) => {
        try {
          await this.handleEvent(event);
        } catch (error) {
          console.error('[StreamOrchestrator] 处理事件失败:', error);
          this.config.onError?.(error instanceof Error ? error : new Error(String(error)));
        }
      },

      onComplete: async () => {
        try {
          await this.handleComplete();
        } catch (error) {
          console.error('[StreamOrchestrator] 完成处理失败:', error);
          this.config.onError?.(error instanceof Error ? error : new Error(String(error)));
        }
      },

      onError: (error: Error) => {
        console.error('[StreamOrchestrator] 流式错误:', error);
        this.config.onError?.(error);
      },
    };
  }

  /**
   * 处理单个事件
   */
  private async handleEvent(event: StreamEvent): Promise<void> {
    // 记录到响应日志（非侵入式）
    this.logEventToResponse(event);
    
    // 找到合适的处理器
    for (const handler of this.handlers) {
      if (handler.canHandle(event)) {
        await handler.handle(event, this.context);
        break; // 每个事件只由一个处理器处理
      }
    }
  }

  /**
   * 将事件内容记录到响应日志（非侵入式）
   */
  private logEventToResponse(event: StreamEvent): void {
    try {
      if (event.type === 'thinking_token' && event.content) {
        this.responseLogger.appendThinking(event.content);
      } else if (event.type === 'thinking_end') {
        this.responseLogger.endThinking();
      } else if (event.type === 'content_token' && event.content) {
        this.responseLogger.appendContent(event.content);
      }
    } catch (error) {
      // 静默失败，不影响主流程
      console.warn('[StreamOrchestrator] Logger error:', error);
    }
  }

  /**
   * 处理流完成
   */
  private async handleComplete(): Promise<void> {
    const store = useChatStore.getState();
    
    // 导入清理工具
    const { cleanToolCallInstructions, extractToolCallFromText, createToolCardMarker } = 
      await import('@/lib/chat/tool-call-cleanup');

    // 获取当前消息
    const conv = store.conversations.find(c => c.id === this.context.conversationId);
    const msg = conv?.messages.find(m => m.id === this.context.messageId) as any;
    
    // 确定要持久化的内容
    const hadCardMarker = !!(msg?.content && msg.content.includes('"__tool_call_card__"'));
    let contentToPersist = hadCardMarker ? (msg?.content || this.context.content) : this.context.content;
    
    // 保存原始内容用于兜底解析
    const originalContent = contentToPersist;

    // 兜底：如果segments中没有任何toolCard，但内容包含工具调用指令
    const segs = Array.isArray(msg?.segments) ? msg.segments : [];
    const hasToolCardInSegments = segs.some((s: any) => s && s.kind === 'toolCard');
    
    if (!this.context.toolStarted && !hasToolCardInSegments) {
      const parsed = extractToolCallFromText(originalContent);
      
      if (parsed && parsed.server && parsed.tool) {
        // 创建并注入工具卡片
        const cardId = crypto.randomUUID();
        const marker = createToolCardMarker(cardId, parsed.server, parsed.tool, parsed.args, this.context.messageId);
        contentToPersist = contentToPersist + (contentToPersist ? '\n' : '') + marker;
        
        store.updateMessageContentInMemory(this.context.messageId, contentToPersist);
        store.dispatchMessageAction(this.context.messageId, { 
          type: 'TOOL_HIT', 
          server: parsed.server, 
          tool: parsed.tool, 
          args: parsed.args, 
          cardId 
        });
        
        // 兜底路径启动工具执行
        const { executeToolCall } = await import('@/lib/mcp/ToolCallOrchestrator');
        void executeToolCall({
          assistantMessageId: this.context.messageId,
          conversationId: this.context.conversationId,
          server: parsed.server,
          tool: parsed.tool,
          args: parsed.args,
          _runningMarker: marker,
          provider: this.config.provider,
          model: this.config.model,
          historyForLlm: this.config.historyForLlm as any,
          originalUserContent: this.config.originalUserContent,
          cardId,
        });
      }
    }

    // 最终清理：移除所有工具调用指令
    contentToPersist = cleanToolCallInstructions(contentToPersist);

    // 计算思考时长
    const thinking_duration = this.context.thinkingStartTime > 0
      ? Math.floor((Date.now() - this.context.thinkingStartTime) / 1000)
      : undefined;

    // 派发流结束动作
    store.dispatchMessageAction(this.context.messageId, { type: 'STREAM_END' });

    // 持久化消息
    await store.updateMessage(this.context.messageId, {
      content: contentToPersist,
      status: 'sent',
      thinking_start_time: this.context.thinkingStartTime || undefined,
      thinking_duration,
    });

    // 通知UI更新完成
    this.config.onUIUpdate?.(contentToPersist);

    // 🎯 输出完整的响应日志（在所有处理完成后）
    try {
      this.responseLogger.logComplete(this.context.messageId);
    } catch (error) {
      console.warn('[StreamOrchestrator] Failed to log response:', error);
    }
  }

  /**
   * 获取当前上下文（用于测试或调试）
   * 返回深拷贝，防止外部修改
   */
  getContext(): Readonly<StreamContext> {
    return {
      ...this.context,
      metadata: {
        ...this.context.metadata,
        historyForLlm: [...this.context.metadata.historyForLlm],
      },
    };
  }
}

