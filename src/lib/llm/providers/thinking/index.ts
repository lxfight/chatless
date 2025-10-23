/**
 * Thinking Strategy模块
 * 
 * ## 架构概述
 * 
 * ```
 * ┌─────────────────────────────────────────┐
 * │  ThinkingStrategyFactory                │
 * │  (创建适合的Strategy实例)               │
 * └───────────────┬─────────────────────────┘
 *                 │
 *      ┌──────────┼──────────┐
 *      ↓          ↓          ↓
 * OllamaThinking StandardThinking DeepSeekReasoning
 *   Strategy      Strategy       Strategy
 *      │          │          │
 *      └──────────┴──────────┘
 *                 │
 *        ┌────────┴────────┐
 *        ↓                 ↓
 * BaseStreamingStrategy ContentParser
 *   (统一流式逻辑)     (插件化解析)
 * ```
 * 
 * ## 使用方式
 * 
 * ### 在Provider中使用
 * 
 * ```typescript
 * import { ThinkingStrategyFactory } from './thinking';
 * 
 * export class OllamaProvider extends BaseProvider {
 *   private thinkingStrategy: ThinkingModeStrategy;
 *   
 *   constructor() {
 *     this.thinkingStrategy = ThinkingStrategyFactory.createOllamaStrategy();
 *   }
 *   
 *   async chatStream(model, messages, cb) {
 *     this.thinkingStrategy.reset();
 *     
 *     // 处理token
 *     const result = this.thinkingStrategy.processToken({
 *       thinking: json.message.thinking,
 *       content: json.message.content,
 *       done: json.done
 *     });
 *     
 *     // 发送事件
 *     if (cb.onEvent) {
 *       result.events.forEach(event => cb.onEvent(event));
 *     }
 *   }
 * }
 * ```
 * 
 * ### 自定义Strategy
 * 
 * ```typescript
 * import { BaseStreamingStrategy, ContentParserFactory } from './thinking';
 * 
 * export class MyCustomStrategy extends BaseStreamingStrategy {
 *   constructor() {
 *     super();
 *     this.contentParsers = ContentParserFactory.createStandardPipeline();
 *   }
 *   
 *   protected extractThinkingContent(token) {
 *     return token.myCustomField || '';
 *   }
 *   
 *   protected getThinkingMode() {
 *     return 'my-custom-mode';
 *   }
 * }
 * ```
 */

// 核心类型
export type { ThinkingToken, ProcessedOutput, ThinkingModeStrategy } from './types';

// 基础类
export { BaseStreamingStrategy } from './base-streaming-strategy';

// 内容解析
export type { ContentParser } from './content-parser';
export { 
  McpToolCallParser, 
  CodeBlockParser,
  ContentParserFactory 
} from './content-parser';

// 具体Strategy实现
export { OllamaThinkingStrategy } from './ollama-thinking-strategy';
export { StandardThinkingStrategy } from './standard-thinking-strategy';
export { DeepSeekReasoningStrategy } from './deepseek-reasoning-strategy';

// 工厂
export { ThinkingStrategyFactory } from './factory';

