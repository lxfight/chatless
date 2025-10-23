/**
 * 标准Thinking策略（重构版）
 * 
 * ## 适用Provider
 * 
 * - OpenAI (ChatGPT, GPT-4)
 * - Anthropic (Claude)
 * - Google AI (Gemini)
 * - OpenAI Compatible APIs
 * 
 * ## 特性
 * 
 * 1. **<think>标签解析**：从content中提取`<think>...</think>`标签内容
 * 2. **流式输出**：thinking内容实时显示
 * 3. **MCP解析**：支持工具调用识别
 * 
 * ## 工作原理
 * 
 * ```
 * 输入: "Some <think>reasoning</think> text"
 *   ↓ 累积到buffer
 * 检测: 是否包含完整的<think>标签对
 *   ↓ 如果是
 * 提取: "reasoning"
 *   ↓
 * 输出: thinking_token事件
 *   ↓
 * 清理: 从buffer移除已解析部分
 * ```
 * 
 * ## 示例
 * 
 * ### 输入序列
 * ```
 * token1: "Let me <th"
 * token2: "ink>analyze "
 * token3: "this</think> So"
 * ```
 * 
 * ### 输出事件
 * ```
 * thinking_start
 * thinking_token("analyze this")
 * thinking_end
 * content_token("So")
 * ```
 */

import { BaseStreamingStrategy } from './base-streaming-strategy';
import type { ThinkingToken } from './types';
import type { ThinkingStartEvent } from '../../types/stream-events';
import { ContentParserFactory } from './content-parser';

export class StandardThinkingStrategy extends BaseStreamingStrategy {
  /** 标签解析缓冲区（处理跨token的<think>标签） */
  private tagBuffer: string = '';
  
  constructor() {
    super();
    
    // 注册标准解析器管道
    // 包含：McpToolCallParser, CodeBlockParser
    this.contentParsers = ContentParserFactory.createStandardPipeline();
  }
  
  /**
   * 提取thinking内容
   * 
   * 标准格式需要从content中提取<think>标签
   * 
   * 挑战：
   * - <think>标签可能跨越多个token
   * - 需要累积buffer直到遇到完整的标签对
   * 
   * @param token - 输入token
   * @returns 提取的thinking内容（如果找到完整标签）
   */
  protected extractThinkingContent(token: ThinkingToken): string {
    if (!token.content) return '';
    
    // 累积到buffer
    this.tagBuffer += token.content;
    
    // 检查是否包含完整的<think>标签
    const thinkMatch = this.tagBuffer.match(/<think>([\s\S]*?)<\/think>/i);
    
    if (thinkMatch) {
      const thinkingContent = thinkMatch[1];
      
      // 从buffer中移除已解析的<think>标签
      // 保留剩余内容（可能是下一个token的开始）
      this.tagBuffer = this.tagBuffer.replace(thinkMatch[0], '');
      
      return thinkingContent;
    }
    
    // 没有完整标签，继续累积
    return '';
  }
  
  /**
   * 获取thinking模式
   * 
   * @returns undefined - 标准模式，不指定特定mode
   */
  protected getThinkingMode(): ThinkingStartEvent['mode'] {
    return undefined;
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

