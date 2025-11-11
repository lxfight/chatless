/**
 * 流式处理模块
 * 
 * 提供统一的、职责清晰的流式事件处理架构
 * 
 * @example
 * ```typescript
 * const orchestrator = new StreamOrchestrator({
 *   messageId: 'msg-123',
 *   conversationId: 'conv-456',
 *   provider: 'openai',
 *   model: 'gpt-4',
 *   originalUserContent: '用户消息',
 *   historyForLlm: [],
 * });
 * 
 * const callbacks = orchestrator.createCallbacks();
 * await provider.chatStream(model, messages, callbacks);
 * ```
 */

export { StreamOrchestrator } from './StreamOrchestrator';
export type { 
  StreamContext, 
  EventHandler, 
  StreamOrchestratorConfig,
  StateAction 
} from './types';
export { ThinkingEventHandler } from './handlers/ThinkingEventHandler';
export { ContentEventHandler } from './handlers/ContentEventHandler';
export { ToolCallEventHandler } from './handlers/ToolCallEventHandler';

