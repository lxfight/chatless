/**
 * 基础流式Thinking策略
 * 
 * ## 设计原则
 * 
 * 1. **流式优先**：thinking内容实时输出，不缓冲等待
 * 2. **关注点分离**：流式输出与内容解析分离
 * 3. **可扩展性**：通过ContentParser插件化扩展解析能力
 * 4. **统一行为**：所有ThinkingStrategy都遵循相同的流式输出模式
 * 
 * ## 架构
 * 
 * ```
 * BaseStreamingStrategy (基类)
 *   ├── processToken() - 模板方法模式
 *   ├── processThinkingStream() - 实时流式输出
 *   ├── parseBufferedThinking() - 批量解析特殊内容
 *   └── contentParsers[] - 内容解析器管道
 * ```
 * 
 * ## 使用方式
 * 
 * ```typescript
 * export class OllamaThinkingStrategy extends BaseStreamingStrategy {
 *   constructor() {
 *     super();
 *     this.contentParsers = [new McpToolCallParser()];
 *   }
 *   
 *   protected extractThinkingContent(token: ThinkingToken): string {
 *     return token.thinking || '';
 *   }
 *   
 *   protected getThinkingMode() {
 *     return 'ollama';
 *   }
 * }
 * ```
 */

import type { 
  ThinkingModeStrategy, 
  ThinkingToken, 
  ProcessedOutput 
} from './types';
import type { StreamEvent, ThinkingStartEvent } from '../../types/stream-events';
import { createStreamEvent } from '../../types/stream-events';
import type { ContentParser } from './content-parser';

export abstract class BaseStreamingStrategy implements ThinkingModeStrategy {
  /** thinking内容缓冲区（仅用于批量解析） */
  protected thinkingBuffer: string = '';
  
  /** content内容缓冲区 */
  protected contentBuffer: string = '';
  
  /** 是否正在thinking模式 */
  protected isInThinkingMode: boolean = false;
  
  /** 是否已开始thinking（用于发送start事件） */
  protected hasStartedThinking: boolean = false;
  
  /** 内容解析器管道（子类可扩展） */
  protected contentParsers: ContentParser[] = [];
  
  /**
   * 处理token - 模板方法模式
   * 
   * 流程：
   * 1. 处理thinking内容（实时流式输出）
   * 2. 处理content内容
   * 3. 结束时批量解析特殊内容
   */
  processToken(token: ThinkingToken): ProcessedOutput {
    const events: StreamEvent[] = [];
    
    // 1. 处理thinking内容（实时流式输出）
    if (this.shouldProcessThinking(token)) {
      events.push(...this.processThinkingStream(token));
    }
    
    // 2. 处理content内容
    if (token.content && token.content.length > 0) {
      events.push(...this.processContentStream(token.content));
    }
    
    // 3. 结束时批量解析特殊内容
    if (token.done) {
      events.push(...this.finalize());
    }
    
    return {
      events,
      isComplete: token.done || false
    };
  }
  
  /**
   * 处理thinking流 - 实时输出
   * 
   * 关键特性：
   * - 首次thinking token：发送thinking_start事件
   * - 每个thinking token：立即发送thinking_token事件
   * - 同时缓冲内容用于后续批量解析
   */
  protected processThinkingStream(token: ThinkingToken): StreamEvent[] {
    const events: StreamEvent[] = [];
    const thinkingContent = this.extractThinkingContent(token);
    
    if (!thinkingContent) return events;
    
    // 首次thinking：发送start事件
    if (!this.hasStartedThinking) {
      events.push(createStreamEvent.thinkingStart(this.getThinkingMode()));
      this.hasStartedThinking = true;
      this.isInThinkingMode = true;
    }
    
    // ✅ 关键：实时发送thinking token，不等待
    events.push(createStreamEvent.thinkingToken(thinkingContent));
    
    // 同时缓冲（用于后续批量解析特殊内容）
    this.thinkingBuffer += thinkingContent;
    
    return events;
  }
  
  /**
   * 提取thinking内容 - 子类实现
   * 
   * 不同Provider的thinking字段位置不同：
   * - Ollama: token.thinking
   * - OpenAI: 从token.content中提取<think>标签
   * - DeepSeek: token.reasoning_content 或 <reasoning>标签
   */
  protected abstract extractThinkingContent(token: ThinkingToken): string;
  
  /**
   * 获取thinking模式 - 子类实现
   * 
   * 用于thinking_start事件的mode字段
   */
  protected abstract getThinkingMode(): ThinkingStartEvent['mode'];
  
  /**
   * 判断是否应该处理thinking
   */
  protected shouldProcessThinking(token: ThinkingToken): boolean {
    const content = this.extractThinkingContent(token);
    return !!content && content.length > 0;
  }
  
  /**
   * 处理content流
   * 
   * 当遇到content时：
   * 1. 如果在thinking模式，发送thinking_end
   * 2. 批量解析缓冲的thinking内容（提取MCP调用等）
   * 3. 输出content_token事件
   */
  protected processContentStream(content: string): StreamEvent[] {
    const events: StreamEvent[] = [];
    
    // 如果在thinking模式，遇到content表示thinking结束
    if (this.isInThinkingMode) {
      events.push(createStreamEvent.thinkingEnd());
      this.isInThinkingMode = false;
      
      // 对缓冲的thinking内容进行批量解析（提取MCP调用等）
      events.push(...this.parseBufferedThinking());
    }
    
    // 输出content token
    this.contentBuffer += content;
    events.push(createStreamEvent.contentToken(content));
    
    return events;
  }
  
  /**
   * 批量解析缓冲的thinking内容
   * 
   * 使用解析器管道处理特殊内容（MCP调用、代码块等）
   * 
   * 设计思路：
   * - thinking内容已经实时输出，用户已经看到
   * - 这里对缓冲区进行批量解析，提取特殊结构（如MCP调用）
   * - 生成额外的事件（如tool_call事件）
   */
  protected parseBufferedThinking(): StreamEvent[] {
    const events: StreamEvent[] = [];
    
    if (!this.thinkingBuffer) return events;
    
    // 依次应用每个解析器
    for (const parser of this.contentParsers) {
      if (parser.canParse(this.thinkingBuffer)) {
        const parsed = parser.parse(this.thinkingBuffer);
        events.push(...parsed);
      }
    }
    
    return events;
  }
  
  /**
   * 结束处理
   * 
   * 当done=true时调用，确保：
   * 1. thinking模式被正确结束
   * 2. 剩余缓冲内容被解析
   * 3. 发送stream_complete事件
   */
  protected finalize(): StreamEvent[] {
    const events: StreamEvent[] = [];
    
    // 如果thinking模式还在，需要结束
    if (this.isInThinkingMode) {
      events.push(createStreamEvent.thinkingEnd());
      this.isInThinkingMode = false;
      
      // 解析剩余缓冲内容
      events.push(...this.parseBufferedThinking());
    }
    
    // 发送complete事件
    events.push(createStreamEvent.streamComplete());
    
    return events;
  }
  
  /**
   * 重置策略状态
   */
  reset(): void {
    this.thinkingBuffer = '';
    this.contentBuffer = '';
    this.isInThinkingMode = false;
    this.hasStartedThinking = false;
  }
}

