/**
 * Thinking Strategy类型定义
 */

import type { StreamEvent } from '../../types/stream-events';

/**
 * Thinking输入token
 * 
 * 不同Provider的字段可能不同：
 * - Ollama: thinking字段
 * - OpenAI: content字段（需解析<think>标签）
 * - DeepSeek: reasoning_content字段或<reasoning>标签
 */
export interface ThinkingToken {
  /** Ollama格式：直接的thinking内容 */
  thinking?: string;
  
  /** DeepSeek格式：reasoning内容 */
  reasoning_content?: string;
  
  /** 标准格式：可能包含<think>或<reasoning>标签的内容 */
  content?: string;
  
  /** 流是否结束 */
  done?: boolean;
}

/**
 * 处理结果
 */
export interface ProcessedOutput {
  /** 生成的结构化事件数组 */
  events: StreamEvent[];
  
  /** 流是否完成 */
  isComplete: boolean;
}

/**
 * Thinking模式策略接口
 * 
 * 所有ThinkingStrategy都应实现此接口
 */
export interface ThinkingModeStrategy {
  /**
   * 处理token，生成结构化事件
   */
  processToken(token: ThinkingToken): ProcessedOutput;
  
  /**
   * 重置策略状态
   */
  reset(): void;
}

