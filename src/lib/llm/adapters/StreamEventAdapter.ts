/**
 * 流事件适配器
 * 
 * ## 当前状态 (2025-10-23)
 * 
 * 此适配器主要作为**向后兼容的安全网**存在：
 * - 所有Provider都优先使用 `onEvent` 发送结构化事件
 * - `useChatActions` 完全支持 `onEvent` 回调
 * - `eventsToText` 仅在 `onEvent` 不可用时作为降级路径
 * 
 * ## 使用场景
 * 
 * ### 1. Provider层降级路径
 * 
 * 当 `StreamCallbacks.onEvent` 不存在但 `onToken` 存在时，
 * Provider使用此适配器将结构化事件转换为文本：
 * 
 * ```typescript
 * if (cb.onEvent) {
 *   // ✅ 优先：直接发送结构化事件
 *   cb.onEvent(event);
 * } else if (cb.onToken) {
 *   // ⚠️ 降级：转换为文本
 *   const text = StreamEventAdapter.eventsToText([event]);
 *   cb.onToken(text);
 * }
 * ```
 * 
 * ### 2. 实际使用情况
 * 
 * - **Provider**: 所有8个核心Provider都已迁移，优先使用onEvent
 * - **消费者**: useChatActions完全支持onEvent
 * - **降级频率**: 实际上很少触发降级路径（主要作为安全网）
 * 
 * ## 未来方向
 * 
 * - 保留 `eventsToText` 作为向后兼容的安全网
 * - `ViewModelBuilder` 可能不需要（Store层已有自己的ViewModel）
 * 
 * @see src/hooks/useChatActions.ts - onEvent 回调实现
 * @see src/types/message-viewmodel.ts - Store层ViewModel类型
 * @see src/store/chatStore.ts - segments_vm 生成逻辑
 */

import type { StreamEvent } from '@/lib/llm/types/stream-events';

/**
 * 将结构化事件转换为文本token
 * 
 * 这是临时适配层，最终应该直接在UI层使用结构化事件
 */
export class StreamEventAdapter {
  /**
   * 将事件列表转换为文本
   */
  static eventsToText(events: StreamEvent[]): string {
    let result = '';
    
    for (const event of events) {
      switch (event.type) {
        case 'thinking_start':
          result += '<think>';
          break;
          
        case 'thinking_token':
          result += event.content;
          break;
          
        case 'thinking_end':
          result += '</think>';
          break;
          
        case 'content_token':
          result += event.content;
          break;
          
        case 'tool_call':
          result += event.toolCall;
          break;
          
        case 'stream_complete':
          // 流结束事件不需要输出文本
          break;
      }
    }
    
    return result;
  }
  
  /**
   * 将单个事件转换为文本
   */
  static eventToText(event: StreamEvent): string {
    return this.eventsToText([event]);
  }
}

/**
 * @deprecated 此ViewModel可能不需要
 * 
 * ## 弃用原因
 * 
 * Store层已经有了自己的ViewModel机制：
 * - 使用 `MessageViewModel` 类型（见 `src/types/message-viewmodel.ts`）
 * - 通过 `dispatchMessageAction` 的FSM处理直接生成
 * - 已集成到 `chatStore` 的 `segments_vm` 字段
 * 
 * ## 当前架构
 * 
 * ```
 * Provider (StreamEvent) 
 *   → useChatActions (onEvent)
 *     → dispatchMessageAction (FSM)
 *       → Store segments_vm
 *         → UI渲染
 * ```
 * 
 * 此 `ThinkingViewModel` 和 `ViewModelBuilder` 是早期设计的遗留，
 * 实际上Store层已经使用了不同的ViewModel结构。
 * 
 * @see src/types/message-viewmodel.ts - 实际使用的ViewModel类型
 * @see src/store/chatStore.ts - segments_vm 生成逻辑
 * 
 * ---
 * 
 * 从结构化事件流创建ViewModel（未使用）
 * 
 * 示例用法：
 * ```typescript
 * const viewModel = {
 *   thinkingContent: '',
 *   mainContent: '',
 *   toolCalls: []
 * };
 * 
 * // 处理事件
 * for (const event of events) {
 *   switch (event.type) {
 *     case 'thinking_token':
 *       viewModel.thinkingContent += event.content;
 *       break;
 *     case 'content_token':
 *       viewModel.mainContent += event.content;
 *       break;
 *     case 'tool_call':
 *       viewModel.toolCalls.push(event.parsed);
 *       break;
 *   }
 * }
 * ```
 */
export interface ThinkingViewModel {
  /** 思考内容 */
  thinkingContent: string;
  /** 主要内容 */
  mainContent: string;
  /** 工具调用列表 */
  toolCalls: Array<{
    serverName?: string;
    toolName?: string;
    arguments?: string;
  }>;
  /** 是否正在思考 */
  isThinking: boolean;
  /** 思考模式 */
  thinkingMode?: 'standard' | 'ollama' | 'deepseek' | 'chain-of-thought';
}

/**
 * 从事件流创建ViewModel
 */
export class ViewModelBuilder {
  private viewModel: ThinkingViewModel = {
    thinkingContent: '',
    mainContent: '',
    toolCalls: [],
    isThinking: false
  };
  
  /**
   * 处理事件，更新ViewModel
   */
  processEvent(event: StreamEvent): void {
    switch (event.type) {
      case 'thinking_start':
        this.viewModel.isThinking = true;
        this.viewModel.thinkingMode = event.mode;
        break;
        
      case 'thinking_token':
        this.viewModel.thinkingContent += event.content;
        break;
        
      case 'thinking_end':
        this.viewModel.isThinking = false;
        break;
        
      case 'content_token':
        this.viewModel.mainContent += event.content;
        break;
        
      case 'tool_call':
        if (event.parsed) {
          this.viewModel.toolCalls.push(event.parsed);
        }
        break;
        
      case 'stream_complete':
        this.viewModel.isThinking = false;
        break;
    }
  }
  
  /**
   * 处理多个事件
   */
  processEvents(events: StreamEvent[]): void {
    for (const event of events) {
      this.processEvent(event);
    }
  }
  
  /**
   * 获取当前ViewModel
   */
  getViewModel(): Readonly<ThinkingViewModel> {
    return this.viewModel;
  }
  
  /**
   * 重置ViewModel
   */
  reset(): void {
    this.viewModel = {
      thinkingContent: '',
      mainContent: '',
      toolCalls: [],
      isThinking: false
    };
  }
}

