/**
 * LLM响应完整日志记录器
 * 
 * ## 设计目标
 * 
 * 1. **完整性**: 记录thinking + content的完整原文
 * 2. **可读性**: 格式化输出，易于阅读和分析
 * 3. **非侵入**: 不影响主流程，日志代码独立
 * 4. **性能**: 轻量级，不增加明显开销
 * 
 * ## 使用方式
 * 
 * ```typescript
 * const logger = new StreamResponseLogger(provider, model);
 * logger.appendThinking(chunk);
 * logger.appendContent(chunk);
 * logger.logComplete(messageId);
 * ```
 */

import type { StreamContext } from './types';

export interface ResponseMetrics {
  /** Thinking字符数 */
  thinkingChars: number;
  /** Content字符数 */
  contentChars: number;
  /** 总字符数 */
  totalChars: number;
  /** 思考时长(秒) */
  thinkingDuration?: number;
  /** 流式处理总时长(秒) */
  streamDuration: number;
}

/**
 * 流式响应日志记录器
 */
export class StreamResponseLogger {
  private static ENABLE_LOG = true;
  private thinkingBuffer: string = '';
  private contentBuffer: string = '';
  private startTime: number = 0;
  private thinkingStartTime: number = 0;
  private thinkingEndTime: number = 0;
  
  constructor(
    private provider: string,
    private model: string
  ) {
    this.startTime = Date.now();
  }

  /**
   * 追加thinking内容
   */
  appendThinking(chunk: string): void {
    if (!this.thinkingStartTime) {
      this.thinkingStartTime = Date.now();
    }
    this.thinkingBuffer += chunk;
  }

  /**
   * 标记thinking结束
   */
  endThinking(): void {
    if (this.thinkingStartTime && !this.thinkingEndTime) {
      this.thinkingEndTime = Date.now();
    }
  }

  /**
   * 追加content内容
   */
  appendContent(chunk: string): void {
    this.contentBuffer += chunk;
  }

  /**
   * 计算指标
   */
  private getMetrics(): ResponseMetrics {
    const thinkingDuration = this.thinkingStartTime && this.thinkingEndTime
      ? (this.thinkingEndTime - this.thinkingStartTime) / 1000
      : undefined;
    
    return {
      thinkingChars: this.thinkingBuffer.length,
      contentChars: this.contentBuffer.length,
      totalChars: this.thinkingBuffer.length + this.contentBuffer.length,
      thinkingDuration,
      streamDuration: (Date.now() - this.startTime) / 1000,
    };
  }

  /**
   * 输出完整的响应日志
   */
  logComplete(messageId: string): void {
    if (!StreamResponseLogger.ENABLE_LOG) return;
    const metrics = this.getMetrics();
    
    // 构建日志分隔线
    const separator = '='.repeat(100);
    const subSeparator = '-'.repeat(100);
    
    console.log(`\n${separator}`);
    console.log(`📊 LLM响应完成 [${this.provider}/${this.model}]`);
    console.log(`消息ID: ${messageId}`);
    console.log(`${subSeparator}`);
    
    // 输出指标
    console.log('📈 响应指标:');
    console.log(`  • Thinking: ${metrics.thinkingChars} 字符 ${metrics.thinkingDuration ? `(${metrics.thinkingDuration.toFixed(1)}秒)` : ''}`);
    console.log(`  • Content:  ${metrics.contentChars} 字符`);
    console.log(`  • 总计:     ${metrics.totalChars} 字符`);
    console.log(`  • 流式时长: ${metrics.streamDuration.toFixed(1)}秒`);
    
    // 输出Thinking内容（如果有）
    if (this.thinkingBuffer) {
      console.log(`\n${subSeparator}`);
      console.log('💭 Thinking内容:');
      console.log(`${subSeparator}`);
      console.log(this.thinkingBuffer);
    }
    
    // 输出Content内容
    if (this.contentBuffer) {
      console.log(`\n${subSeparator}`);
      console.log('📝 Content内容:');
      console.log(`${subSeparator}`);
      console.log(this.contentBuffer);
    }
    
    console.log(`${separator}\n`);
  }

  /**
   * 从StreamContext中提取并记录
   */
  static logFromContext(context: StreamContext): void {
    if (!StreamResponseLogger.ENABLE_LOG) return;
    const logger = new StreamResponseLogger(
      context.metadata.provider,
      context.metadata.model
    );
    
    // Content已经在context中累积了
    logger.contentBuffer = context.content;
    
    // Thinking需要从segments中提取
    const thinkingContent = StreamResponseLogger.extractThinkingFromSegments(context.messageId);
    if (thinkingContent) {
      logger.thinkingBuffer = thinkingContent;
    }
    
    // 设置时间信息
    if (context.thinkingStartTime > 0) {
      logger.thinkingStartTime = context.thinkingStartTime;
      logger.thinkingEndTime = context.thinkingStartTime + 100; // 估算
    }
    
    logger.logComplete(context.messageId);
  }

  /**
   * 从消息segments中提取thinking内容
   */
  private static extractThinkingFromSegments(messageId: string): string {
    try {
      const { useChatStore } = require('@/store/chatStore');
      const store = useChatStore.getState();
      
      // 找到消息
      let message: any = null;
      for (const conv of store.conversations) {
        const msg = conv.messages.find((m: any) => m.id === messageId);
        if (msg) {
          message = msg;
          break;
        }
      }
      
      if (!message || !Array.isArray(message.segments)) {
        return '';
      }
      
      // 提取所有think段的文本
      const thinkingParts: string[] = [];
      for (const segment of message.segments) {
        if (segment.kind === 'think' && segment.text) {
          thinkingParts.push(segment.text);
        }
      }
      
      return thinkingParts.join('');
    } catch (error) {
      console.warn('[ResponseLogger] Failed to extract thinking:', error);
      return '';
    }
  }
}


