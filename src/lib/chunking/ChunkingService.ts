import { 
  ChunkingStrategy, 
  TextChunk, 
  ChunkingOptions, 
  ChunkingResult,
  ChunkingError 
} from './types';
import { RecursiveCharacterSplitter } from './strategies/RecursiveCharacterSplitter';
import { SemanticSplitter } from './strategies/SemanticSplitter';

export type ChunkingStrategyType = 'recursive-character' | 'semantic';

export class ChunkingService {
  private strategies: Map<ChunkingStrategyType, ChunkingStrategy> = new Map();

  constructor() {
    this.initializeStrategies();
  }

  private initializeStrategies(): void {
    this.strategies.set('recursive-character', new RecursiveCharacterSplitter());
    this.strategies.set('semantic', new SemanticSplitter());
  }

  /**
   * 使用指定策略对文本进行分块
   */
  async chunkText(
    text: string,
    strategyType: ChunkingStrategyType = 'recursive-character',
    options?: Partial<ChunkingOptions>
  ): Promise<ChunkingResult> {
    try {
      const strategy = this.getStrategy(strategyType);
      const defaultOptions = strategy.getDefaultOptions();
      const mergedOptions: ChunkingOptions = { ...defaultOptions, ...options };

      // 验证选项
      this.validateOptions(mergedOptions);

      // 执行分块
      const startTime = Date.now();
      const chunks = strategy.chunkText(text, mergedOptions);
      const endTime = Date.now();

      // 计算统计信息
      const result: ChunkingResult = {
        chunks,
        totalChunks: chunks.length,
        totalCharacters: text.length,
        averageChunkSize: chunks.length > 0 
          ? chunks.reduce((sum, chunk) => sum + chunk.content.length, 0) / chunks.length 
          : 0,
        metadata: {
          strategy: strategy.getName(),
          options: mergedOptions,
          processedAt: new Date(),
        },
      };

      console.log(`文本分块完成: ${chunks.length}个块, 耗时${endTime - startTime}ms`);
      return result;

    } catch (error) {
      throw new ChunkingError(
        `分块失败: ${error instanceof Error ? error.message : '未知错误'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 获取可用的分块策略列表
   */
  getAvailableStrategies(): ChunkingStrategyType[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * 获取指定策略的默认选项
   */
  getDefaultOptions(strategyType: ChunkingStrategyType): ChunkingOptions {
    const strategy = this.getStrategy(strategyType);
    return strategy.getDefaultOptions();
  }

  /**
   * 注册新的分块策略
   */
  registerStrategy(name: string, strategy: ChunkingStrategy): void {
    this.strategies.set(name as ChunkingStrategyType, strategy);
  }

  /**
   * 批量分块多个文本
   */
  async chunkMultipleTexts(
    texts: Array<{ id: string; content: string }>,
    strategyType: ChunkingStrategyType = 'recursive-character',
    options?: Partial<ChunkingOptions>,
    onProgress?: (completed: number, total: number) => void
  ): Promise<Array<{ id: string; result: ChunkingResult }>> {
    const results: Array<{ id: string; result: ChunkingResult }> = [];

    for (let i = 0; i < texts.length; i++) {
      const { id, content } = texts[i];
      
      try {
        const result = await this.chunkText(content, strategyType, options);
        results.push({ id, result });
        
        if (onProgress) {
          onProgress(i + 1, texts.length);
        }
      } catch (error) {
        console.error(`文本 ${id} 分块失败:`, error);
        // 继续处理其他文本
      }
    }

    return results;
  }

  /**
   * 合并相邻的小块
   */
  mergeSmallChunks(
    chunks: TextChunk[], 
    minChunkSize: number = 100
  ): TextChunk[] {
    if (chunks.length <= 1) return chunks;

    const mergedChunks: TextChunk[] = [];
    let currentChunk = chunks[0];

    for (let i = 1; i < chunks.length; i++) {
      const nextChunk = chunks[i];
      
      if (currentChunk.content.length < minChunkSize && 
          nextChunk.content.length < minChunkSize) {
        // 合并小块
        currentChunk = {
          id: currentChunk.id,
          content: currentChunk.content + ' ' + nextChunk.content,
          startIndex: currentChunk.startIndex,
          endIndex: nextChunk.endIndex,
          metadata: {
            ...currentChunk.metadata,
            characterCount: currentChunk.content.length + nextChunk.content.length + 1,
            wordCount: (currentChunk.content + ' ' + nextChunk.content).split(/\s+/).length,
          },
        };
      } else {
        mergedChunks.push(currentChunk);
        currentChunk = nextChunk;
      }
    }

    mergedChunks.push(currentChunk);
    return mergedChunks;
  }

  /**
   * 分析文本特征，推荐最佳分块策略
   */
  recommendStrategy(text: string): {
    strategy: ChunkingStrategyType;
    reason: string;
    confidence: number;
  } {
    const textLength = text.length;
    const paragraphCount = (text.match(/\n\n/g) || []).length;
    const sentenceCount = (text.match(/[.!?。！？]/g) || []).length;
    const avgParagraphLength = paragraphCount > 0 ? textLength / paragraphCount : textLength;
    const avgSentenceLength = sentenceCount > 0 ? textLength / sentenceCount : textLength;

    // 基于文本特征推荐策略
    if (paragraphCount > 5 && avgParagraphLength > 200 && sentenceCount > 10) {
      return {
        strategy: 'semantic',
        reason: '文本具有清晰的段落和句子结构，适合语义分块',
        confidence: 0.8,
      };
    } else if (textLength > 5000 && paragraphCount < 3) {
      return {
        strategy: 'recursive-character',
        reason: '文本较长但结构简单，适合递归字符分块',
        confidence: 0.7,
      };
    } else {
      return {
        strategy: 'recursive-character',
        reason: '默认推荐递归字符分块策略',
        confidence: 0.6,
      };
    }
  }

  private getStrategy(strategyType: ChunkingStrategyType): ChunkingStrategy {
    const strategy = this.strategies.get(strategyType);
    if (!strategy) {
      throw new ChunkingError(`未找到分块策略: ${strategyType}`);
    }
    return strategy;
  }

  private validateOptions(options: ChunkingOptions): void {
    if (options.chunkSize <= 0) {
      throw new ChunkingError(`无效的块大小: ${options.chunkSize}`);
    }

    if (options.overlap < 0) {
      throw new ChunkingError(`无效的重叠大小: ${options.overlap}`);
    }

    if (options.overlap >= options.chunkSize) {
      throw new ChunkingError('重叠大小不能大于或等于块大小');
    }

    if (options.minChunkSize && options.minChunkSize > options.chunkSize) {
      throw new ChunkingError('最小块大小不能大于块大小');
    }

    if (options.maxChunkSize && options.maxChunkSize < options.chunkSize) {
      throw new ChunkingError('最大块大小不能小于块大小');
    }
  }
} 