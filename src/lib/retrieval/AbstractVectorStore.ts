import { 
  VectorSearchResult, 
  SearchOptions, 
  RetrievalStrategy,
  RetrievalError 
} from './types';
import { VectorStoreConfig, VectorStorePerformanceConfig } from './VectorStoreConfig';

export interface VectorStoreMetrics {
  searchLatency: number;
  indexingThroughput: number;
  memoryUsage: number;
  cacheHitRate: number;
  errorRate: number;
}

export interface VectorStoreBenchmark {
  vectorCount: number;
  dimension: number;
  searchTime: number;
  indexingTime: number;
  memoryUsed: number;
  accuracy: number;
}

/**
 * 抽象向量存储基类
 * 提供通用的优化方法和接口规范
 */
export abstract class AbstractVectorStore implements RetrievalStrategy {
  protected config: VectorStoreConfig;
  protected performanceConfig: VectorStorePerformanceConfig;
  protected metrics: VectorStoreMetrics;
  protected queryCache: Map<string, VectorSearchResult[]>;
  protected isInitialized: boolean = false;

  constructor(config: VectorStoreConfig, performanceConfig: VectorStorePerformanceConfig) {
    this.config = config;
    this.performanceConfig = performanceConfig;
    this.queryCache = new Map();
    this.metrics = this.initializeMetrics();
  }

  // 抽象方法 - 子类必须实现
  protected abstract initializeStore(): Promise<void>;
  protected abstract performSearch(
    queryEmbedding: number[],
    options: SearchOptions
  ): Promise<VectorSearchResult[]>;
  protected abstract performAddVectors(
    vectors: Array<{
      id: string;
      embedding: number[];
      content: string;
      metadata: Record<string, any>;
    }>
  ): Promise<void>;
  protected abstract performRemoveVectors(ids: string[]): Promise<void>;
  protected abstract performClear(): Promise<void>;
  protected abstract performGetStats(): Promise<{
    totalVectors: number;
    dimension: number;
    indexSize: number;
  }>;

  // 公共接口实现
  async search(
    queryEmbedding: number[],
    options: SearchOptions = {}
  ): Promise<VectorSearchResult[]> {
    await this.ensureInitialized();
    
    const startTime = Date.now();
    
    try {
      // 缓存检查
      if (this.performanceConfig.enableQueryCache) {
        const cacheKey = this.generateCacheKey(queryEmbedding, options);
        const cached = this.queryCache.get(cacheKey);
        if (cached) {
          this.updateMetrics('searchLatency', Date.now() - startTime);
          this.updateMetrics('cacheHitRate', 1);
          return cached;
        }
      }

      // 预过滤优化
      const optimizedOptions = this.optimizeSearchOptions(options);
      
      // 执行搜索
      const results = await this.performSearch(queryEmbedding, optimizedOptions);
      
      // 后处理优化
      const optimizedResults = await this.postProcessResults(results, options);
      
      // 更新缓存
      if (this.performanceConfig.enableQueryCache) {
        const cacheKey = this.generateCacheKey(queryEmbedding, options);
        this.updateCache(cacheKey, optimizedResults);
      }

      this.updateMetrics('searchLatency', Date.now() - startTime);
      this.updateMetrics('cacheHitRate', 0);
      
      return optimizedResults;
      
    } catch (error) {
      this.updateMetrics('errorRate', 1);
      throw new RetrievalError(
        `向量搜索失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  async addVectors(
    vectors: Array<{
      id: string;
      embedding: number[];
      content: string;
      metadata: Record<string, any>;
    }>
  ): Promise<void> {
    await this.ensureInitialized();
    
    // 添加详细的参数验证
    if (!vectors) {
      throw new RetrievalError('向量数组不能为null或undefined');
    }
    
    if (!Array.isArray(vectors)) {
      throw new RetrievalError(`向量参数必须为数组，当前类型: ${typeof vectors}`);
    }
    
    if (vectors.length === 0) {
      console.warn('向量数组为空，跳过添加操作');
      return;
    }

    const startTime = Date.now();
    
    try {
      // 向量验证
      this.validateVectors(vectors);
      
      // 批处理优化
      const batches = this.createBatches(vectors, this.config.batchSize);
      
      // 并发处理（如果启用）
      if (this.performanceConfig.enableParallelSearch && batches.length > 1) {
        await this.processBatchesInParallel(batches);
      } else {
        await this.processBatchesSequentially(batches);
      }

      // 清除相关缓存
      this.invalidateCache();
      
      // 更新度量
      const duration = Date.now() - startTime;
      this.updateMetrics('indexingThroughput', vectors.length / (duration / 1000));
      
    } catch (error) {
      this.updateMetrics('errorRate', 1);
      throw new RetrievalError(
        `添加向量失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  async removeVectors(ids: string[]): Promise<void> {
    await this.ensureInitialized();
    await this.performRemoveVectors(ids);
    this.invalidateCache();
  }

  async clear(): Promise<void> {
    await this.ensureInitialized();
    await this.performClear();
    this.invalidateCache();
  }

  async getStats(): Promise<{
    totalVectors: number;
    dimension: number;
    indexSize: number;
  }> {
    await this.ensureInitialized();
    return await this.performGetStats();
  }

  // 性能优化方法
  protected optimizeSearchOptions(options: SearchOptions): SearchOptions {
    const optimized = { ...options };
    
    // 应用配置中的优化设置
    if (this.config.queryOptimization.enablePrefiltering) {
      optimized.topK = Math.min(
        optimized.topK || 10,
        this.config.queryOptimization.maxCandidates
      );
    }
    
    if (this.config.queryOptimization.similarityThreshold > 0) {
      optimized.threshold = Math.max(
        optimized.threshold || 0,
        this.config.queryOptimization.similarityThreshold
      );
    }
    
    return optimized;
  }

  protected async postProcessResults(
    results: VectorSearchResult[],
    options: SearchOptions
  ): Promise<VectorSearchResult[]> {
    let processedResults = [...results];
    
    // 重排序（如果启用）
    if (this.config.queryOptimization.enableReranking && options.rerank) {
      processedResults = await this.rerankResults(processedResults);
    }
    
    // 应用最终的topK限制
    if (options.topK) {
      processedResults = processedResults.slice(0, options.topK);
    }
    
    return processedResults;
  }

  protected async rerankResults(results: VectorSearchResult[]): Promise<VectorSearchResult[]> {
    // 基础重排序实现 - 子类可以重写提供更复杂的逻辑
    return results.sort((a, b) => b.score - a.score);
  }

  // 批处理方法
  protected createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  protected async processBatchesSequentially(
    batches: Array<{
      id: string;
      embedding: number[];
      content: string;
      metadata: Record<string, any>;
    }>[]
  ): Promise<void> {
    for (const batch of batches) {
      await this.performAddVectors(batch);
    }
  }

  protected async processBatchesInParallel(
    batches: Array<{
      id: string;
      embedding: number[];
      content: string;
      metadata: Record<string, any>;
    }>[]
  ): Promise<void> {
    const concurrency = this.config.indexingConcurrency;
    const chunks = this.createBatches(batches, concurrency);
    
    for (const chunk of chunks) {
      await Promise.all(chunk.map(batch => this.performAddVectors(batch)));
    }
  }

  // 缓存管理
  protected generateCacheKey(queryEmbedding: number[], options: SearchOptions): string {
    const optionsStr = JSON.stringify(options);
    const vectorStr = queryEmbedding.slice(0, 10).join(','); // 只使用前10个维度作为键
    return `${vectorStr}:${optionsStr}`;
  }

  protected updateCache(key: string, results: VectorSearchResult[]): void {
    if (this.queryCache.size >= this.performanceConfig.queryCacheSize) {
      // LRU清理 - 删除最老的条目
      const firstKey = this.queryCache.keys().next().value;
      if (firstKey) {
        this.queryCache.delete(firstKey);
      }
    }
    this.queryCache.set(key, results);
  }

  protected invalidateCache(): void {
    this.queryCache.clear();
  }

  // 验证方法
  protected validateVectors(vectors: Array<{
    id: string;
    embedding: number[];
    content: string;
    metadata: Record<string, any>;
  }>): void {
    if (vectors.length === 0) return;
    
    const firstDimension = vectors[0].embedding.length;
    
    for (const vector of vectors) {
      if (!vector.id || typeof vector.id !== 'string') {
        throw new RetrievalError('向量ID必须为非空字符串');
      }
      
      if (!Array.isArray(vector.embedding)) {
        throw new RetrievalError('向量嵌入必须为数组');
      }
      
      if (vector.embedding.length !== firstDimension) {
        throw new RetrievalError(`向量维度不一致: 期望 ${firstDimension}, 实际 ${vector.embedding.length}`);
      }
      
      if (vector.embedding.some(v => typeof v !== 'number' || !isFinite(v))) {
        throw new RetrievalError('向量嵌入包含无效数值');
      }
    }
  }

  // 度量管理
  protected initializeMetrics(): VectorStoreMetrics {
    return {
      searchLatency: 0,
      indexingThroughput: 0,
      memoryUsage: 0,
      cacheHitRate: 0,
      errorRate: 0,
    };
  }

  protected updateMetrics(metric: keyof VectorStoreMetrics, value: number): void {
    // 使用指数移动平均来平滑度量
    const alpha = 0.1;
    this.metrics[metric] = this.metrics[metric] * (1 - alpha) + value * alpha;
  }

  // 基准测试
  async benchmark(testVectorCount: number = 1000, dimension: number = 384): Promise<VectorStoreBenchmark> {
    
    // 生成测试向量
    const testVectors = this.generateTestVectors(testVectorCount, dimension);
    const queryVector = this.generateRandomVector(dimension);
    
    // 测试索引性能
    const indexStartTime = Date.now();
    await this.addVectors(testVectors);
    const indexingTime = Date.now() - indexStartTime;
    
    // 测试搜索性能
    const searchStartTime = Date.now();
    const results = await this.search(queryVector, { topK: 10 });
    const searchTime = Date.now() - searchStartTime;
    
    // 计算内存使用
    const stats = await this.getStats();
    const memoryUsed = stats.indexSize;
    
    // 计算精度（简单指标）
    const accuracy = results.length > 0 ? 1.0 : 0.0;
    
    return {
      vectorCount: testVectorCount,
      dimension,
      searchTime,
      indexingTime,
      memoryUsed,
      accuracy,
    };
  }

  protected generateTestVectors(count: number, dimension: number) {
    return Array.from({ length: count }, (_, i) => ({
      id: `test_${i}`,
      embedding: this.generateRandomVector(dimension),
      content: `测试文档 ${i}`,
      metadata: { index: i, type: 'test' },
    }));
  }

  protected generateRandomVector(dimension: number): number[] {
    return Array.from({ length: dimension }, () => Math.random() * 2 - 1);
  }

  // 工具方法
  getMetrics(): VectorStoreMetrics {
    return { ...this.metrics };
  }

  getConfig(): VectorStoreConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<VectorStoreConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  protected async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeStore();
      this.isInitialized = true;
    }
  }
} 