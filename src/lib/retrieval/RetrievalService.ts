import { 
  RetrievalStrategy, 
  VectorSearchResult, 
  SearchOptions,
  HybridSearchOptions,
  RetrievalError 
} from './types';
import { VectorStoreFactory, VectorStoreCreationOptions, VectorStoreType } from './VectorStoreFactory';
import { SimilarityCalculator } from './similarity';

export class RetrievalService {
  private currentStrategy: RetrievalStrategy | null = null;
  private strategyConfig: VectorStoreCreationOptions;

  constructor(config?: Partial<VectorStoreCreationOptions>) {
    this.strategyConfig = {
      type: 'optimized_sqlite',
      performanceProfile: 'balanced',
      useCase: 'search',
      autoTune: true,
      ...config,
    };
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.currentStrategy) {
      this.currentStrategy = await VectorStoreFactory.create(this.strategyConfig);
      console.log('检索服务已初始化，使用优化的向量存储策略');
    }
  }

  /**
   * 向量搜索
   */
  async search(
    queryEmbedding: number[],
    options: SearchOptions = {}
  ): Promise<VectorSearchResult[]> {
    await this.ensureInitialized();
    return await this.currentStrategy!.search(queryEmbedding, options);
  }

  /**
   * 混合搜索（向量 + 文本）
   */
  async hybridSearch(
    queryEmbedding: number[],
    queryText: string,
    options: HybridSearchOptions = {}
  ): Promise<VectorSearchResult[]> {
    const {
      textWeight = 0.3,
      vectorWeight = 0.7,
      topK = 10,
      textSearchOptions = {}
    } = options;

    // 执行向量搜索
    const vectorResults = await this.search(queryEmbedding, {
      ...options,
      topK: Math.max(topK * 2, 20) // 获取更多候选结果
    });

    // 执行文本搜索（基于关键词匹配）
    const textResults = await this.textSearch(queryText, {
      ...options,
      topK: Math.max(topK * 2, 20)
    });

    // 合并和重新排序结果
    const hybridResults = this.combineResults(
      vectorResults,
      textResults,
      vectorWeight,
      textWeight
    );

    // 返回前K个结果
    return hybridResults.slice(0, topK);
  }

  /**
   * 文本搜索（基于关键词匹配）
   */
  private async textSearch(
    queryText: string,
    options: SearchOptions = {}
  ): Promise<VectorSearchResult[]> {
    // 这里可以实现基于关键词的文本搜索
    // 暂时返回空结果，因为主要依赖向量搜索
    return [];
  }

  /**
   * 合并向量搜索和文本搜索结果
   */
  private combineResults(
    vectorResults: VectorSearchResult[],
    textResults: VectorSearchResult[],
    vectorWeight: number,
    textWeight: number
  ): VectorSearchResult[] {
    const resultMap = new Map<string, VectorSearchResult>();

    // 添加向量搜索结果
    vectorResults.forEach(result => {
      resultMap.set(result.id, {
        ...result,
        score: result.score * vectorWeight
      });
    });

    // 添加文本搜索结果，如果已存在则合并分数
    textResults.forEach(result => {
      const existing = resultMap.get(result.id);
      if (existing) {
        existing.score += result.score * textWeight;
      } else {
        resultMap.set(result.id, {
          ...result,
          score: result.score * textWeight
        });
      }
    });

    // 按分数排序
    return Array.from(resultMap.values()).sort((a, b) => b.score - a.score);
  }

  /**
   * 添加向量到索引
   */
  async addVectors(
    vectors: Array<{
      id: string;
      embedding: number[];
      content: string;
      metadata: Record<string, any>;
    }>
  ): Promise<void> {
    await this.ensureInitialized();
    await this.currentStrategy!.addVectors(vectors);
  }

  /**
   * 删除向量
   */
  async removeVectors(ids: string[]): Promise<void> {
    await this.ensureInitialized();
    await this.currentStrategy!.removeVectors(ids);
  }

  /**
   * 获取索引统计信息
   */
  async getStats(): Promise<{
    totalVectors: number;
    dimension: number;
    indexSize: number;
  }> {
    await this.ensureInitialized();
    return await this.currentStrategy!.getStats();
  }

  /**
   * 清空索引
   */
  async clear(): Promise<void> {
    await this.ensureInitialized();
    await this.currentStrategy!.clear();
  }

  /**
   * 切换向量存储策略
   */
  async switchStrategy(config: Partial<VectorStoreCreationOptions>): Promise<void> {
    this.strategyConfig = { ...this.strategyConfig, ...config };
    this.currentStrategy = await VectorStoreFactory.create(this.strategyConfig);
    console.log(`向量存储策略已切换到: ${this.strategyConfig.type}`);
  }

  /**
   * 获取当前策略配置
   */
  getCurrentConfig(): VectorStoreCreationOptions {
    return { ...this.strategyConfig };
  }

  /**
   * 获取推荐配置
   */
  static getRecommendedConfig(
    vectorCount: number,
    dimension: number,
    useCase: 'chat' | 'search' | 'analytics' = 'search'
  ): VectorStoreCreationOptions {
    return VectorStoreFactory.getRecommendedConfig(vectorCount, dimension, useCase);
  }

  /**
   * 计算查询向量与候选向量的相似度
   */
  calculateSimilarity(
    queryVector: number[],
    candidateVector: number[],
    metric: string = 'cosine'
  ): number {
    return SimilarityCalculator.calculate(queryVector, candidateVector, metric);
  }

  /**
   * 批量计算相似度
   */
  batchCalculateSimilarity(
    queryVector: number[],
    candidateVectors: number[][],
    metric: string = 'cosine'
  ): number[] {
    return candidateVectors.map(candidate => 
      this.calculateSimilarity(queryVector, candidate, metric)
    );
  }

  /**
   * 查找最相似的K个向量
   */
  findTopKSimilar(
    queryVector: number[],
    candidateVectors: Array<{ id: string; vector: number[]; metadata?: any }>,
    k: number = 10,
    metric: string = 'cosine',
    threshold?: number
  ): Array<{ id: string; score: number; metadata?: any }> {
    const results = candidateVectors.map(candidate => ({
      id: candidate.id,
      score: this.calculateSimilarity(queryVector, candidate.vector, metric),
      metadata: candidate.metadata,
    }));

    // 过滤阈值
    const filteredResults = threshold !== undefined 
      ? results.filter(result => result.score >= threshold)
      : results;

    // 排序并返回前K个
    const isDistanceMetric = ['euclidean', 'manhattan'].includes(metric);
    filteredResults.sort((a, b) => 
      isDistanceMetric ? a.score - b.score : b.score - a.score
    );

    return filteredResults.slice(0, k);
  }

  /**
   * 验证向量维度
   */
  async validateVectorDimension(vectors: number[][]): Promise<{
    isValid: boolean;
    dimension?: number;
    error?: string;
  }> {
    if (vectors.length === 0) {
      return { isValid: false, error: '向量数组为空' };
    }

    const firstDimension = vectors[0].length;
    for (let i = 1; i < vectors.length; i++) {
      if (vectors[i].length !== firstDimension) {
        return {
          isValid: false,
          error: `向量维度不一致: 期望 ${firstDimension}, 实际 ${vectors[i].length} (索引 ${i})`
        };
      }
    }

    return { isValid: true, dimension: firstDimension };
  }

  /**
   * 搜索相似文档
   */
  async searchSimilarDocuments(
    documentId: string,
    options: SearchOptions = {}
  ): Promise<VectorSearchResult[]> {
    await this.ensureInitialized();
    
    // 首先获取文档的向量
    const results = await this.search([], {
      filter: { id: documentId },
      topK: 1,
      includeEmbeddings: true
    });

    if (results.length === 0 || !results[0].embedding) {
      throw new RetrievalError(`文档 ${documentId} 未找到或缺少向量数据`);
    }

    // 使用文档向量搜索相似文档
    return await this.search(results[0].embedding, {
      ...options,
      filter: { ...options.filter, id: { $ne: documentId } } // 排除自身
    });
  }

  /**
   * 获取向量存储性能度量
   */
  async getMetrics(): Promise<any> {
    await this.ensureInitialized();
    
    // 如果当前策略是 AbstractVectorStore 的实例，获取详细度量
    if (this.currentStrategy && 'getMetrics' in this.currentStrategy) {
      return (this.currentStrategy as any).getMetrics();
    }
    
    return null;
  }

  /**
   * 运行基准测试
   */
  async benchmark(
    testVectorCount: number = 1000,
    dimension: number = 384
  ): Promise<any> {
    await this.ensureInitialized();
    
    if (this.currentStrategy && 'benchmark' in this.currentStrategy) {
      return await (this.currentStrategy as any).benchmark(testVectorCount, dimension);
    }
    
    throw new RetrievalError('当前向量存储策略不支持基准测试');
  }

  /**
   * 优化向量存储性能
   */
  async optimize(): Promise<void> {
    await this.ensureInitialized();
    
    if (this.currentStrategy && 'compactMemory' in this.currentStrategy) {
      await (this.currentStrategy as any).compactMemory();
    }
  }
} 