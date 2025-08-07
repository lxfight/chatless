/**
 * 向量存储配置管理
 */

export interface VectorStoreConfig {
  // 通用配置
  type: 'sqlite' | 'qdrant';
  dimension?: number;
  similarityMetric: 'cosine' | 'euclidean' | 'manhattan' | 'dot_product';
  
  // 性能配置
  batchSize: number;
  cacheSize: number;
  indexingConcurrency: number;
  
  // SQLite特定配置
  sqlite?: {
    tableName: string;
    enableWAL: boolean;
    pragmaSettings: {
      cacheSize: number;
      synchronous: 'OFF' | 'NORMAL' | 'FULL';
      journalMode: 'DELETE' | 'TRUNCATE' | 'PERSIST' | 'MEMORY' | 'WAL';
      tempStore: 'DEFAULT' | 'FILE' | 'MEMORY';
    };
    indexOptimization: {
      enableBTreeIndex: boolean;
      enableHashIndex: boolean;
      vacuumInterval: number; // 小时
    };
  };
  
  // Qdrant特定配置
  qdrant?: {
    url: string;
    apiKey?: string;
    collectionName: string;
    vectorConfig: {
      size: number;
      distance: 'Cosine' | 'Euclid' | 'Dot';
    };
    optimizersConfig?: {
      deletedThreshold: number;
      vacuumMinVectorNumber: number;
      defaultSegmentNumber: number;
    };
  };
  
  // 查询优化配置
  queryOptimization: {
    enablePrefiltering: boolean;
    enableReranking: boolean;
    maxCandidates: number;
    similarityThreshold: number;
  };
}

export interface VectorStorePerformanceConfig {
  // 内存管理
  maxMemoryUsage: number; // MB
  enableMemoryOptimization: boolean;
  
  // 查询优化
  enableQueryCache: boolean;
  queryCacheSize: number;
  enableParallelSearch: boolean;
  
  // 索引优化
  enableIncrementalIndexing: boolean;
  indexCompressionLevel: number;
  enableApproximateSearch: boolean;
}

export class VectorStoreConfigManager {
  private static readonly DEFAULT_CONFIG: VectorStoreConfig = {
    type: 'sqlite',
    similarityMetric: 'cosine',
    batchSize: 1000,
    cacheSize: 1000,
    indexingConcurrency: 4,
    sqlite: {
      tableName: 'vector_embeddings',
      enableWAL: true,
      pragmaSettings: {
        cacheSize: 10000,
        synchronous: 'NORMAL',
        journalMode: 'WAL',
        tempStore: 'MEMORY',
      },
      indexOptimization: {
        enableBTreeIndex: true,
        enableHashIndex: false,
        vacuumInterval: 24,
      },
    },
    queryOptimization: {
      enablePrefiltering: true,
      enableReranking: false,
      maxCandidates: 10000,
      similarityThreshold: 0.1,
    },
  };

  private static readonly PERFORMANCE_PROFILES = {
    memory_optimized: {
      maxMemoryUsage: 256,
      enableMemoryOptimization: true,
      enableQueryCache: false,
      queryCacheSize: 100,
      enableParallelSearch: false,
      enableIncrementalIndexing: true,
      indexCompressionLevel: 9,
      enableApproximateSearch: true,
    },
    balanced: {
      maxMemoryUsage: 512,
      enableMemoryOptimization: true,
      enableQueryCache: true,
      queryCacheSize: 1000,
      enableParallelSearch: true,
      enableIncrementalIndexing: true,
      indexCompressionLevel: 6,
      enableApproximateSearch: false,
    },
    performance: {
      maxMemoryUsage: 1024,
      enableMemoryOptimization: false,
      enableQueryCache: true,
      queryCacheSize: 5000,
      enableParallelSearch: true,
      enableIncrementalIndexing: false,
      indexCompressionLevel: 1,
      enableApproximateSearch: false,
    },
  } as const;

  private config: VectorStoreConfig;
  private performanceConfig: VectorStorePerformanceConfig;

  constructor(
    config?: Partial<VectorStoreConfig>,
    performanceProfile: keyof typeof VectorStoreConfigManager.PERFORMANCE_PROFILES = 'balanced'
  ) {
    this.config = this.mergeConfig(VectorStoreConfigManager.DEFAULT_CONFIG, config || {});
    this.performanceConfig = VectorStoreConfigManager.PERFORMANCE_PROFILES[performanceProfile];
  }

  getConfig(): VectorStoreConfig {
    return { ...this.config };
  }

  getPerformanceConfig(): VectorStorePerformanceConfig {
    return { ...this.performanceConfig };
  }

  updateConfig(updates: Partial<VectorStoreConfig>): void {
    this.config = this.mergeConfig(this.config, updates);
  }

  updatePerformanceConfig(updates: Partial<VectorStorePerformanceConfig>): void {
    this.performanceConfig = { ...this.performanceConfig, ...updates };
  }

  switchToPerformanceProfile(profile: keyof typeof VectorStoreConfigManager.PERFORMANCE_PROFILES): void {
    this.performanceConfig = VectorStoreConfigManager.PERFORMANCE_PROFILES[profile];
  }

  // 根据数据规模自动调整配置
  autoTuneForDataSize(vectorCount: number, dimension: number): void {
    const estimatedMemoryMB = (vectorCount * dimension * 4) / (1024 * 1024);
    
    if (estimatedMemoryMB > 1000) {
      // 大数据集优化
      this.updateConfig({
        batchSize: 5000,
        cacheSize: 500,
        sqlite: {
          ...this.config.sqlite!,
          pragmaSettings: {
            ...this.config.sqlite!.pragmaSettings,
            cacheSize: 50000,
            synchronous: 'OFF',
          },
        },
      });
      this.switchToPerformanceProfile('performance');
    } else if (estimatedMemoryMB > 100) {
      // 中等数据集
      this.switchToPerformanceProfile('balanced');
    } else {
      // 小数据集
      this.switchToPerformanceProfile('memory_optimized');
    }
  }

  // 为特定用例生成配置
  static createConfigForUseCase(useCase: 'chat' | 'search' | 'analytics'): VectorStoreConfigManager {
    switch (useCase) {
      case 'chat':
        return new VectorStoreConfigManager({
          similarityMetric: 'cosine',
          batchSize: 500,
          queryOptimization: {
            enablePrefiltering: true,
            enableReranking: true,
            maxCandidates: 5000,
            similarityThreshold: 0.3,
          },
        }, 'balanced');
        
      case 'search':
        return new VectorStoreConfigManager({
          similarityMetric: 'cosine',
          batchSize: 2000,
          queryOptimization: {
            enablePrefiltering: true,
            enableReranking: false,
            maxCandidates: 20000,
            similarityThreshold: 0.1,
          },
        }, 'performance');
        
      case 'analytics':
        return new VectorStoreConfigManager({
          similarityMetric: 'euclidean',
          batchSize: 10000,
          queryOptimization: {
            enablePrefiltering: false,
            enableReranking: false,
            maxCandidates: 50000,
            similarityThreshold: 0.05,
          },
        }, 'memory_optimized');
        
      default:
        return new VectorStoreConfigManager();
    }
  }

  private mergeConfig(base: VectorStoreConfig, updates: Partial<VectorStoreConfig>): VectorStoreConfig {
    return {
      ...base,
      ...updates,
      sqlite: updates.sqlite ? { ...base.sqlite, ...updates.sqlite } : base.sqlite,
      qdrant: updates.qdrant ? { ...base.qdrant, ...updates.qdrant } : base.qdrant,
      queryOptimization: updates.queryOptimization 
        ? { ...base.queryOptimization, ...updates.queryOptimization }
        : base.queryOptimization,
    };
  }

  // 验证配置有效性
  validateConfig(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.config.batchSize <= 0) {
      errors.push('批处理大小必须大于0');
    }

    if (this.config.cacheSize <= 0) {
      errors.push('缓存大小必须大于0');
    }

    if (this.config.type === 'sqlite' && !this.config.sqlite) {
      errors.push('SQLite配置缺失');
    }

    if (this.config.type === 'qdrant' && !this.config.qdrant) {
      errors.push('Qdrant配置缺失');
    }

    if (this.config.dimension && this.config.dimension <= 0) {
      errors.push('向量维度必须大于0');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // 导出配置为JSON
  exportConfig(): string {
    return JSON.stringify({
      config: this.config,
      performanceConfig: this.performanceConfig,
    }, null, 2);
  }

  // 从JSON导入配置
  static importConfig(jsonString: string): VectorStoreConfigManager {
    try {
      const { config, performanceConfig } = JSON.parse(jsonString);
      const manager = new VectorStoreConfigManager(config);
      if (performanceConfig) {
        manager.updatePerformanceConfig(performanceConfig);
      }
      return manager;
    } catch (error) {
      throw new Error(`配置导入失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }
} 