/**
 * DeepSeek推理策略（重构版）
 * 
 * ## 特性
 * 
 * 1. **多格式支持**：
 *    - `reasoning_content`字段（DeepSeek原生格式）
 *    - `<reasoning>`标签
 *    - `<think>`标签（兼容标准格式）
 * 
 * 2. **流式输出**：thinking内容实时显示
 * 
 * 3. **MCP解析**：支持工具调用识别
 * 
 * ## 格式示例
 * 
 * ### 格式1: reasoning_content字段
 * ```json
 * {
 *   "choices": [{
 *     "delta": {
 *       "reasoning_content": "Let me analyze...",
 *       "content": ""
 *     }
 *   }]
 * }
 * ```
 * 
 * ### 格式2: <reasoning>标签
 * ```
 * <reasoning>
 * This is the reasoning process...
 * </reasoning>
 * The answer is...
 * ```
 * 
 * ### 格式3: <think>标签（兼容）
 * ```
 * <think>
 * Thinking process...
 * </think>
 * Response text...
 * ```
 * 
 * ## 优先级
 * 
 * 1. reasoning_content字段（最高）
 * 2. <reasoning>标签
 * 3. <think>标签（兼容）
 */

import { BaseStreamingStrategy } from './base-streaming-strategy';
import type { ThinkingToken } from './types';
import type { ThinkingStartEvent } from '../../types/stream-events';
import { ContentParserFactory } from './content-parser';

export class DeepSeekReasoningStrategy extends BaseStreamingStrategy {
  /** 标签解析缓冲区（处理跨token的标签） */
  private tagBuffer: string = '';
  
  constructor() {
    super();
    
    // 注册DeepSeek专用解析器管道
    // 包含：McpToolCallParser, CodeBlockParser
    this.contentParsers = ContentParserFactory.createDeepSeekPipeline();
  }
  
  /**
   * 提取thinking内容
   * 
   * DeepSeek支持多种格式，按优先级尝试：
   * 1. reasoning_content字段（直接获取）
   * 2. <reasoning>标签（从content解析）
   * 3. <think>标签（兼容标准格式）
   * 
   * @param token - 输入token
   * @returns 提取的thinking内容
   */
  protected extractThinkingContent(token: ThinkingToken): string {
    // 优先级1: reasoning_content字段
    if (token.reasoning_content) {
      return token.reasoning_content;
    }
    
    // 优先级2-3: 从content解析标签
    if (!token.content) return '';
    
    // 累积到buffer
    this.tagBuffer += token.content;
    
    // 优先级2: 尝试<reasoning>标签
    const reasoningMatch = this.tagBuffer.match(/<reasoning>([\s\S]*?)<\/reasoning>/i);
    if (reasoningMatch) {
      const thinkingContent = reasoningMatch[1];
      this.tagBuffer = this.tagBuffer.replace(reasoningMatch[0], '');
      return thinkingContent;
    }
    
    // 优先级3: 尝试<think>标签（兼容）
    const thinkMatch = this.tagBuffer.match(/<think>([\s\S]*?)<\/think>/i);
    if (thinkMatch) {
      const thinkingContent = thinkMatch[1];
      this.tagBuffer = this.tagBuffer.replace(thinkMatch[0], '');
      return thinkingContent;
    }
    
    // 没有完整标签，继续累积
    return '';
  }
  
  /**
   * 获取thinking模式
   * 
   * @returns 'deepseek' - DeepSeek专用模式标识
   */
  protected getThinkingMode(): ThinkingStartEvent['mode'] {
    return 'deepseek';
  }
  
  /**
   * 重置策略状态
   * 
   * 除了基类状态，还需要清理标签缓冲区
   */
  reset(): void {
    super.reset();
    this.tagBuffer = '';
  }
}

