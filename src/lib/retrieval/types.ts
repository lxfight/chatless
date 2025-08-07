// 向量检索相关类型定义

export interface VectorSearchResult {
  id: string;
  content: string;
  score: number;
  metadata: Record<string, any>;
  embedding?: number[];
}

export interface SearchOptions {
  topK?: number;
  threshold?: number;
  filter?: Record<string, any>;
  includeEmbeddings?: boolean;
  rerank?: boolean;
}

export interface VectorIndex {
  id: string;
  vectors: number[][];
  metadata: Array<Record<string, any>>;
  dimension: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SimilarityMetric {
  name: string;
  calculate: (a: number[], b: number[]) => number;
}

export interface RetrievalStrategy {
  /**
   * 搜索相似向量
   */
  search(
    queryEmbedding: number[],
    options: SearchOptions
  ): Promise<VectorSearchResult[]>;

  /**
   * 添加向量到索引
   */
  addVectors(
    vectors: Array<{
      id: string;
      embedding: number[];
      content: string;
      metadata: Record<string, any>;
    }>
  ): Promise<void>;

  /**
   * 删除向量
   */
  removeVectors(ids: string[]): Promise<void>;

  /**
   * 获取索引统计信息
   */
  getStats(): Promise<{
    totalVectors: number;
    dimension: number;
    indexSize: number;
  }>;

  /**
   * 清空索引
   */
  clear(): Promise<void>;
}

export interface HybridSearchOptions extends SearchOptions {
  textWeight?: number;
  vectorWeight?: number;
  textSearchOptions?: {
    fuzzy?: boolean;
    stemming?: boolean;
    stopWords?: string[];
  };
}

export interface RerankingOptions {
  model?: string;
  topK?: number;
  threshold?: number;
}

// 错误类型
export class RetrievalError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'RetrievalError';
  }
}

export class IndexNotFoundError extends RetrievalError {
  constructor(indexId: string) {
    super(`索引未找到: ${indexId}`);
    this.name = 'IndexNotFoundError';
  }
}

export class DimensionMismatchError extends RetrievalError {
  constructor(expected: number, actual: number) {
    super(`向量维度不匹配: 期望 ${expected}, 实际 ${actual}`);
    this.name = 'DimensionMismatchError';
  }
}

export class InvalidVectorError extends RetrievalError {
  constructor(reason: string) {
    super(`无效的向量: ${reason}`);
    this.name = 'InvalidVectorError';
  }
} 