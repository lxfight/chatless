/**
 * 工具调用事件处理器
 * 
 * 职责：
 * - 处理 tool_call 事件
 * - 清理内容中的工具调用指令
 * - 创建工具卡片
 * - 触发工具执行
 */

import type { StreamEvent } from '@/lib/llm/types/stream-events';
import type { EventHandler, StreamContext } from '../types';
import { useChatStore } from '@/store/chatStore';

export class ToolCallEventHandler implements EventHandler {
  canHandle(event: StreamEvent): boolean {
    return event.type === 'tool_call';
  }

  async handle(event: StreamEvent, context: StreamContext): Promise<void> {
    // 类型窄化
    if (event.type !== 'tool_call') {
      return;
    }
    
    // 输入验证
    if (!event || !event.parsed) {
      console.warn('[ToolCallHandler] Invalid event: missing parsed data');
      return;
    }

    if (!context || !context.messageId || !context.conversationId) {
      console.error('[ToolCallHandler] Invalid context: missing required fields');
      return;
    }

    const parsed = event.parsed || {};
    const server = parsed.serverName || '';
    const tool = parsed.toolName || '';
    // arguments是JSON字符串，需要解析为对象
    let args: Record<string, unknown> | undefined = undefined;
    if (parsed.arguments) {
      try {
        args = JSON.parse(parsed.arguments);
      } catch (error) {
        console.warn('[ToolCallHandler] Failed to parse arguments:', error);
      }
    }

    if (!server || !tool) {
      console.warn('[ToolCallHandler] Invalid tool call: missing server or tool name');
      return;
    }

    // 防止重复执行
    if (context.toolStarted) {
      console.debug('[ToolCallHandler] Tool already started, skipping duplicate call');
      return;
    }

    let cardId: string | undefined;

    try {
      // 标记工具已启动
      context.toolStarted = true;

      // 动态导入工具函数
      const { createToolCardMarker } = 
        await import('@/lib/chat/tool-call-cleanup');

      // 注意：不需要清理 context.content
      // 原因：
      // 1. context.content 保留原始内容（包括指令）用于解析
      // 2. UI渲染的内容已经在 segments 层过滤了
      // 3. 这是线性委派的优势：各层职责清晰，不需要重复处理
      
      // 创建工具卡片标记
      cardId = crypto.randomUUID();
      const marker = createToolCardMarker(cardId, server, tool, args, context.messageId);

      // 更新FSM状态
      context.fsmState = 'TOOL_RUNNING';

      // 获取store
      const store = useChatStore.getState();
      
      if (!store) {
        throw new Error('Store not available');
      }
      
      // 派发工具卡片创建动作到FSM
      // FSM会通过 insertRunningCard 将卡片追加到segments
      if (typeof store.dispatchMessageAction === 'function') {
        store.dispatchMessageAction(context.messageId, { 
          type: 'TOOL_HIT', 
          server, 
          tool, 
          args, 
          cardId 
        });
      }

      // 执行工具调用（独立的错误处理）
      try {
        const { executeToolCall } = await import('@/lib/mcp/ToolCallOrchestrator');
        await executeToolCall({
          assistantMessageId: context.messageId,
          conversationId: context.conversationId,
          server,
          tool,
          args,
          _runningMarker: marker,
          provider: context.metadata.provider,
          model: context.metadata.model,
          historyForLlm: context.metadata.historyForLlm as any,
          originalUserContent: context.metadata.originalUserContent,
          cardId,
        });
      } catch (executeError) {
        console.error('[ToolCallHandler] Tool execution failed:', executeError);
        
        // 更新工具卡片为错误状态
        if (cardId && typeof store.dispatchMessageAction === 'function') {
          store.dispatchMessageAction(context.messageId, {
            type: 'TOOL_RESULT',
            server,
            tool,
            ok: false,
            errorMessage: executeError instanceof Error 
              ? executeError.message 
              : 'Tool execution failed',
            cardId,
          });
        }
        
        // 不重新抛出错误，允许流继续
      }
    } catch (error) {
      console.error('[ToolCallHandler] Handler failed:', error);
      
      // 如果创建了卡片，尝试更新为错误状态
      if (cardId) {
        try {
          const store = useChatStore.getState();
          if (store && typeof store.dispatchMessageAction === 'function') {
            store.dispatchMessageAction(context.messageId, {
              type: 'TOOL_RESULT',
              server,
              tool,
              ok: false,
              errorMessage: error instanceof Error 
                ? error.message 
                : 'Tool call handler failed',
              cardId,
            });
          }
        } catch { /* 忽略二次错误 */ }
      }
      
      // 重置工具启动标记，允许后续工具调用
      context.toolStarted = false;
      
      throw error; // 让 Orchestrator 处理
    }
  }
}

