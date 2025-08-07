import { RetrievalStrategy } from './types';
import { VectorStoreConfig, VectorStoreConfigManager, VectorStorePerformanceConfig } from './VectorStoreConfig';
import { OptimizedSQLiteVectorStore } from './strategies/OptimizedSQLiteVectorStore';
import { SQLiteVectorStore } from './strategies/SQLiteVectorStore';
import { AbstractVectorStore } from './AbstractVectorStore';

export type VectorStoreType = 'sqlite' | 'optimized_sqlite' | 'qdrant';

export interface VectorStoreCreationOptions {
  type: VectorStoreType;
  config?: Partial<VectorStoreConfig>;
  performanceProfile?: 'memory_optimized' | 'balanced' | 'performance';
  useCase?: 'chat' | 'search' | 'analytics';
  autoTune?: boolean;
}

/**
 * 向量存储工厂类
 * 提供统一的向量存储创建、配置和管理接口
 */
export class VectorStoreFactory {
  private static instances: Map<string, RetrievalStrategy> = new Map();
  private static configs: Map<string, VectorStoreConfigManager> = new Map();

  /**
   * 创建向量存储实例
   */
  static async create(options: VectorStoreCreationOptions): Promise<RetrievalStrategy> {
    const instanceKey = this.generateInstanceKey(options);
    
    // 检查是否已存在实例
    if (this.instances.has(instanceKey)) {
      return this.instances.get(instanceKey)!;
    }

    // 创建配置管理器
    const configManager = this.createConfigManager(options);
    const config = configManager.getConfig();
    const performanceConfig = configManager.getPerformanceConfig();

    // 自动调优（如果启用）
    if (options.autoTune) {
      await this.autoTuneConfig(configManager, options.type);
    }

    // 创建向量存储实例
    const store = await this.createInstance(options.type, config, performanceConfig);
    
    // 缓存实例和配置
    this.instances.set(instanceKey, store);
    this.configs.set(instanceKey, configManager);

    console.log(`创建向量存储实例: ${options.type}, 配置: ${options.performanceProfile || 'default'}`);
    
    return store;
  }

  /**
   * 获取现有实例
   */
  static getInstance(options: VectorStoreCreationOptions): RetrievalStrategy | null {
    const instanceKey = this.generateInstanceKey(options);
    return this.instances.get(instanceKey) || null;
  }

  /**
   * 创建专用实例（不缓存）
   */
  static async createDedicated(options: VectorStoreCreationOptions): Promise<RetrievalStrategy> {
    const configManager = this.createConfigManager(options);
    const config = configManager.getConfig();
    const performanceConfig = configManager.getPerformanceConfig();

    if (options.autoTune) {
      await this.autoTuneConfig(configManager, options.type);
    }

    return await this.createInstance(options.type, config, performanceConfig);
  }

  /**
   * 获取推荐配置
   */
  static getRecommendedConfig(
    vectorCount: number, 
    dimension: number, 
    useCase: 'chat' | 'search' | 'analytics' = 'search'
  ): VectorStoreCreationOptions {
    const estimatedMemoryMB = (vectorCount * dimension * 4) / (1024 * 1024);
    
    let type: VectorStoreType;
    let performanceProfile: 'memory_optimized' | 'balanced' | 'performance';
    
    // 选择存储类型
    if (vectorCount < 5000) {
      type = 'optimized_sqlite';
      performanceProfile = 'memory_optimized';
    } else if (vectorCount < 50000) {
      type = 'optimized_sqlite';
      performanceProfile = 'balanced';
    } else if (vectorCount < 200000) {
      type = 'optimized_sqlite';
      performanceProfile = 'performance';
    } else {
      // 超大数据集建议使用Qdrant
      type = 'qdrant';
      performanceProfile = 'performance';
    }
    
    // 根据内存限制调整
    if (estimatedMemoryMB > 1000 && type === 'optimized_sqlite') {
      performanceProfile = 'memory_optimized';
    }

    return {
      type,
      performanceProfile,
      useCase,
      autoTune: true,
    };
  }

  /**
   * 比较不同配置的性能
   */
  static async benchmarkConfigurations(
    configs: VectorStoreCreationOptions[],
    testVectorCount: number = 1000,
    testDimension: number = 384
  ): Promise<Array<{
    config: VectorStoreCreationOptions;
    benchmark: any;
    score: number;
  }>> {
    const results = [];
    
    for (const config of configs) {
      try {
        const store = await this.createDedicated(config);
        
        if (store instanceof AbstractVectorStore) {
          const benchmark = await store.benchmark(testVectorCount, testDimension);
          const score = this.calculateBenchmarkScore(benchmark);
          
          results.push({
            config,
            benchmark,
            score,
          });
        }
      } catch (error) {
        console.warn(`配置基准测试失败:`, config, error);
      }
    }
    
    // 按分数排序
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * 获取最佳配置推荐
   */
  static async getBestConfiguration(
    requirements: {
      maxVectorCount: number;
      dimension: number;
      maxMemoryMB: number;
      prioritizeSpeed: boolean;
      useCase: 'chat' | 'search' | 'analytics';
    }
  ): Promise<VectorStoreCreationOptions> {
    const { maxVectorCount, dimension, maxMemoryMB, prioritizeSpeed, useCase } = requirements;
    
    // 生成候选配置
    const candidates: VectorStoreCreationOptions[] = [
      {
        type: 'optimized_sqlite',
        performanceProfile: 'memory_optimized',
        useCase,
        autoTune: true,
      },
      {
        type: 'optimized_sqlite',
        performanceProfile: 'balanced',
        useCase,
        autoTune: true,
      },
      {
        type: 'optimized_sqlite',
        performanceProfile: 'performance',
        useCase,
        autoTune: true,
      },
    ];

    // 如果数据量很大，添加Qdrant选项
    if (maxVectorCount > 100000) {
      candidates.push({
        type: 'qdrant',
        performanceProfile: 'performance',
        useCase,
        autoTune: true,
      });
    }
    
    // 过滤不符合内存要求的配置
    const filteredCandidates = candidates.filter(config => {
      const estimatedMemory = this.estimateMemoryUsage(config, maxVectorCount, dimension);
      return estimatedMemory <= maxMemoryMB;
    });
    
    if (filteredCandidates.length === 0) {
      // 如果没有符合内存要求的配置，返回最节省内存的
      return candidates[0];
    }
    
    // 根据优先级选择
    if (prioritizeSpeed) {
      return filteredCandidates.find(c => c.performanceProfile === 'performance') || filteredCandidates[0];
    } else {
      return filteredCandidates.find(c => c.performanceProfile === 'memory_optimized') || filteredCandidates[0];
    }
  }

  /**
   * 清理实例缓存
   */
  static clearCache(): void {
    this.instances.clear();
    this.configs.clear();
    console.log('向量存储实例缓存已清理');
  }

  /**
   * 获取缓存统计
   */
  static getCacheStats(): {
    instanceCount: number;
    configCount: number;
    instances: string[];
  } {
    return {
      instanceCount: this.instances.size,
      configCount: this.configs.size,
      instances: Array.from(this.instances.keys()),
    };
  }

  // 私有方法
  private static generateInstanceKey(options: VectorStoreCreationOptions): string {
    return `${options.type}_${options.performanceProfile || 'default'}_${options.useCase || 'default'}`;
  }

  private static createConfigManager(options: VectorStoreCreationOptions): VectorStoreConfigManager {
    if (options.useCase) {
      const configManager = VectorStoreConfigManager.createConfigForUseCase(options.useCase);
      if (options.config) {
        configManager.updateConfig(options.config);
      }
      if (options.performanceProfile) {
        configManager.switchToPerformanceProfile(options.performanceProfile);
      }
      return configManager;
    } else {
      return new VectorStoreConfigManager(options.config, options.performanceProfile);
    }
  }

  private static async createInstance(
    type: VectorStoreType,
    config: VectorStoreConfig,
    performanceConfig: VectorStorePerformanceConfig
  ): Promise<RetrievalStrategy> {
    switch (type) {
      case 'optimized_sqlite':
        return new OptimizedSQLiteVectorStore(config, performanceConfig);
        
      case 'sqlite':
        // 为了向后兼容，保留原始SQLite实现
        return new SQLiteVectorStore({
          tableName: config.sqlite?.tableName,
          similarityMetric: config.similarityMetric,
          batchSize: config.batchSize,
        });
        
      case 'qdrant':
        // TODO: 实现Qdrant向量存储
        throw new Error('Qdrant向量存储尚未实现');
        
      default:
        throw new Error(`不支持的向量存储类型: ${type}`);
    }
  }

  private static async autoTuneConfig(
    configManager: VectorStoreConfigManager,
    storeType: VectorStoreType
  ): Promise<void> {
    // 基于系统资源进行自动调优
    const availableMemory = this.getAvailableMemory();
    const cpuCores = this.getCPUCores();
    
    // 调整并发设置
    const concurrency = Math.max(1, Math.min(cpuCores, 8));
    configManager.updateConfig({
      indexingConcurrency: concurrency,
    });
    
    // 调整缓存设置
    if (availableMemory > 1000) {
      configManager.updateConfig({
        cacheSize: 5000,
      });
      configManager.updatePerformanceConfig({
        queryCacheSize: 2000,
      });
    } else if (availableMemory > 500) {
      configManager.updateConfig({
        cacheSize: 2000,
      });
      configManager.updatePerformanceConfig({
        queryCacheSize: 1000,
      });
    }
    
    console.log(`自动调优完成: 内存=${availableMemory}MB, CPU核心=${cpuCores}, 并发=${concurrency}`);
  }

  private static getAvailableMemory(): number {
    // 简化的内存检测（在实际应用中可能需要更复杂的逻辑）
    if (typeof navigator !== 'undefined' && 'deviceMemory' in navigator) {
      return (navigator as any).deviceMemory * 1024; // GB to MB
    }
    return 1024; // 默认假设1GB
  }

  private static getCPUCores(): number {
    if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) {
      return navigator.hardwareConcurrency;
    }
    return 4; // 默认假设4核
  }

  private static calculateBenchmarkScore(benchmark: any): number {
    // 综合评分算法
    const speedWeight = 0.4;
    const memoryWeight = 0.3;
    const accuracyWeight = 0.3;
    
    const speedScore = 1000 / Math.max(benchmark.searchTime, 1); // 速度越快分数越高
    const memoryScore = 1000000 / Math.max(benchmark.memoryUsed, 1000); // 内存越少分数越高
    const accuracyScore = benchmark.accuracy * 1000; // 精度分数
    
    return speedScore * speedWeight + memoryScore * memoryWeight + accuracyScore * accuracyWeight;
  }

  private static estimateMemoryUsage(
    config: VectorStoreCreationOptions,
    vectorCount: number,
    dimension: number
  ): number {
    const baseMemoryMB = (vectorCount * dimension * 4) / (1024 * 1024); // 向量数据本身
    
    let multiplier = 1.5; // 基础开销
    
    switch (config.performanceProfile) {
      case 'memory_optimized':
        multiplier = 1.2;
        break;
      case 'balanced':
        multiplier = 1.5;
        break;
      case 'performance':
        multiplier = 2.0;
        break;
    }
    
    if (config.type === 'qdrant') {
      multiplier += 0.5; // Qdrant额外开销
    }
    
    return baseMemoryMB * multiplier;
  }
} 