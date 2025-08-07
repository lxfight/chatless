import { SimilarityMetric, InvalidVectorError } from './types';

/**
 * 向量相似度计算工具类
 */
export class SimilarityCalculator {
  private static metrics: Map<string, SimilarityMetric> = new Map();

  static {
    // 注册默认的相似度算法
    this.registerMetric('cosine', {
      name: 'cosine',
      calculate: this.cosineSimilarity,
    });

    this.registerMetric('euclidean', {
      name: 'euclidean',
      calculate: this.euclideanDistance,
    });

    this.registerMetric('manhattan', {
      name: 'manhattan',
      calculate: this.manhattanDistance,
    });

    this.registerMetric('dot', {
      name: 'dot',
      calculate: this.dotProduct,
    });
  }

  /**
   * 注册新的相似度算法
   */
  static registerMetric(name: string, metric: SimilarityMetric): void {
    this.metrics.set(name, metric);
  }

  /**
   * 计算两个向量的相似度
   */
  static calculate(
    vectorA: number[],
    vectorB: number[],
    metric: string = 'cosine'
  ): number {
    this.validateVectors(vectorA, vectorB);

    const similarityMetric = this.metrics.get(metric);
    if (!similarityMetric) {
      throw new InvalidVectorError(`未知的相似度算法: ${metric}`);
    }

    return similarityMetric.calculate(vectorA, vectorB);
  }

  /**
   * 批量计算查询向量与候选向量的相似度
   */
  static batchCalculate(
    queryVector: number[],
    candidateVectors: number[][],
    metric: string = 'cosine'
  ): number[] {
    return candidateVectors.map(candidate => 
      this.calculate(queryVector, candidate, metric)
    );
  }

  /**
   * 找到最相似的K个向量
   */
  static findTopK(
    queryVector: number[],
    candidateVectors: Array<{ id: string; vector: number[]; metadata?: any }>,
    k: number = 10,
    metric: string = 'cosine',
    threshold?: number
  ): Array<{ id: string; score: number; metadata?: any }> {
    const scores = candidateVectors.map(candidate => ({
      id: candidate.id,
      score: this.calculate(queryVector, candidate.vector, metric),
      metadata: candidate.metadata,
    }));

    // 根据相似度算法决定排序方向
    const isDistanceMetric = ['euclidean', 'manhattan'].includes(metric);
    scores.sort((a, b) => isDistanceMetric ? a.score - b.score : b.score - a.score);

    // 应用阈值过滤
    let filteredScores = scores;
    if (threshold !== undefined) {
      filteredScores = scores.filter(item => 
        isDistanceMetric ? item.score <= threshold : item.score >= threshold
      );
    }

    return filteredScores.slice(0, k);
  }

  /**
   * 余弦相似度 (0-1, 1表示最相似)
   */
  private static cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * 欧几里得距离 (越小越相似)
   */
  private static euclideanDistance(a: number[], b: number[]): number {
    const squaredDiffs = a.map((val, i) => Math.pow(val - b[i], 2));
    return Math.sqrt(squaredDiffs.reduce((sum, val) => sum + val, 0));
  }

  /**
   * 曼哈顿距离 (越小越相似)
   */
  private static manhattanDistance(a: number[], b: number[]): number {
    return a.reduce((sum, val, i) => sum + Math.abs(val - b[i]), 0);
  }

  /**
   * 点积 (越大越相似)
   */
  private static dotProduct(a: number[], b: number[]): number {
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
  }

  /**
   * 验证向量有效性
   */
  private static validateVectors(a: number[], b: number[]): void {
    if (!Array.isArray(a) || !Array.isArray(b)) {
      throw new InvalidVectorError('向量必须是数组');
    }

    if (a.length === 0 || b.length === 0) {
      throw new InvalidVectorError('向量不能为空');
    }

    if (a.length !== b.length) {
      throw new InvalidVectorError(`向量维度不匹配: ${a.length} vs ${b.length}`);
    }

    if (a.some(val => !isFinite(val)) || b.some(val => !isFinite(val))) {
      throw new InvalidVectorError('向量包含无效数值');
    }
  }

  /**
   * 向量归一化
   */
  static normalize(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) {
      return vector.slice(); // 返回副本
    }
    return vector.map(val => val / magnitude);
  }

  /**
   * 计算向量的L2范数
   */
  static l2Norm(vector: number[]): number {
    return Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  }

  /**
   * 计算向量的L1范数
   */
  static l1Norm(vector: number[]): number {
    return vector.reduce((sum, val) => sum + Math.abs(val), 0);
  }

  /**
   * 获取可用的相似度算法列表
   */
  static getAvailableMetrics(): string[] {
    return Array.from(this.metrics.keys());
  }
} 