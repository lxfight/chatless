// @ts-nocheck
'use strict';

import { 
  RetrievalStrategy, 
  VectorSearchResult, 
  SearchOptions,
  RetrievalError,
  DimensionMismatchError 
} from '../types';
import { SimilarityCalculator } from '../similarity';
import { getSafeDb } from '../../db';

export interface SQLiteVectorStoreOptions {
  tableName?: string;
  similarityMetric?: string;
  batchSize?: number;
}

export class SQLiteVectorStore implements RetrievalStrategy {
  private tableName: string;
  private similarityMetric: string;
  private batchSize: number;
  private dimension?: number;

  constructor(options: SQLiteVectorStoreOptions = {}) {
    this.tableName = options.tableName || 'vector_embeddings';
    this.similarityMetric = options.similarityMetric || 'cosine';
    this.batchSize = options.batchSize || 1000;
    
    this.initializeTable();
  }

  private async initializeTable(): Promise<void> {
    try {
      const db = await getSafeDb();
      await db.execute(`
        CREATE TABLE IF NOT EXISTS ${this.tableName} (
          id TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          embedding TEXT NOT NULL,
          metadata TEXT DEFAULT '{}',
          dimension INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 创建索引以提高查询性能
      await db.execute(`
        CREATE INDEX IF NOT EXISTS idx_${this.tableName}_dimension 
        ON ${this.tableName}(dimension)
      `);

      console.log(`向量存储表 ${this.tableName} 初始化完成`);
    } catch (error) {
      throw new RetrievalError(
        `初始化向量存储表失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  async search(
    queryEmbedding: number[],
    options: SearchOptions = {}
  ): Promise<VectorSearchResult[]> {
    const {
      topK = 10,
      threshold,
      filter,
      includeEmbeddings = false
    } = options;

    try {
      const db = await getSafeDb();
      
      // 构建查询条件
      let whereClause = `dimension = ?`;
      const params: any[] = [queryEmbedding.length];

      if (filter) {
        for (const [key, value] of Object.entries(filter)) {
          whereClause += ` AND JSON_EXTRACT(metadata, '$.${key}') = ?`;
          params.push(value);
        }
      }

      // 获取所有候选向量
      const query = `
        SELECT id, content, embedding, metadata 
        FROM ${this.tableName} 
        WHERE ${whereClause}
      `;

      const rows = await db.select(query, params) as any[];
      
      if (rows.length === 0) {
        return [];
      }

      // 计算相似度
      const candidates = rows.map((row: any) => {
        const embedding = JSON.parse(row.embedding as string);
        const metadata = JSON.parse(row.metadata as string);
        
        return {
          id: row.id as string,
          content: row.content as string,
          embedding,
          metadata,
          score: SimilarityCalculator.calculate(
            queryEmbedding,
            embedding,
            this.similarityMetric
          ),
        };
      });

      // 排序和过滤
      const isDistanceMetric = ['euclidean', 'manhattan'].includes(this.similarityMetric);
      candidates.sort((a: any, b: any) => 
        isDistanceMetric ? a.score - b.score : b.score - a.score
      );

      let results = candidates;
      if (threshold !== undefined) {
        results = candidates.filter((item: any) => 
          isDistanceMetric ? item.score <= threshold : item.score >= threshold
        );
      }

      // 返回前K个结果
      const topResults = results.slice(0, topK);
      
      return topResults.map((result: any) => ({
        id: result.id,
        content: result.content,
        score: result.score,
        metadata: result.metadata,
        embedding: includeEmbeddings ? result.embedding : undefined,
      }));

    } catch (error) {
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
    if (vectors.length === 0) return;

    try {
      const db = await getSafeDb();
      
      // 验证向量维度一致性
      const firstDimension = vectors[0].embedding.length;
      if (this.dimension && this.dimension !== firstDimension) {
        throw new DimensionMismatchError(this.dimension, firstDimension);
      }

      for (const vector of vectors) {
        if (vector.embedding.length !== firstDimension) {
          throw new DimensionMismatchError(firstDimension, vector.embedding.length);
        }
      }

      this.dimension = firstDimension;

      // 批量插入
      const insertQuery = `
        INSERT OR REPLACE INTO ${this.tableName} 
        (id, content, embedding, metadata, dimension, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;

      // 使用事务进行批量插入
      for (let i = 0; i < vectors.length; i += this.batchSize) {
        const batch = vectors.slice(i, i + this.batchSize);
        
        for (const vector of batch) {
          await db.execute(insertQuery, [
            vector.id,
            vector.content,
            JSON.stringify(vector.embedding),
            JSON.stringify(vector.metadata),
            vector.embedding.length,
          ]);
        }
      }

      console.log(`成功添加 ${vectors.length} 个向量到存储`);

    } catch (error) {
      throw new RetrievalError(
        `添加向量失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  async removeVectors(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    try {
      const db = await getSafeDb();
      const placeholders = ids.map(() => '?').join(',');
      const deleteQuery = `DELETE FROM ${this.tableName} WHERE id IN (${placeholders})`;
      
      const result = await db.execute(deleteQuery, ids);
      console.log(`成功删除 ${result.changes} 个向量`);

    } catch (error) {
      throw new RetrievalError(
        `删除向量失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  async getStats(): Promise<{
    totalVectors: number;
    dimension: number;
    indexSize: number;
  }> {
    try {
      const db = await getSafeDb();
      
      const countQuery = `SELECT COUNT(*) as count FROM ${this.tableName}`;
      const countResult = await db.select(countQuery);
      const totalVectors = countResult[0]?.count as number || 0;

      const dimensionQuery = `SELECT dimension FROM ${this.tableName} LIMIT 1`;
      const dimensionResult = await db.select(dimensionQuery);
      const dimension = dimensionResult[0]?.dimension as number || 0;

      // 估算索引大小（字节）
      const sizeQuery = `
        SELECT 
          SUM(LENGTH(content) + LENGTH(embedding) + LENGTH(metadata)) as size
        FROM ${this.tableName}
      `;
      const sizeResult = await db.select(sizeQuery);
      const indexSize = sizeResult[0]?.size as number || 0;

      return {
        totalVectors,
        dimension,
        indexSize,
      };

    } catch (error) {
      throw new RetrievalError(
        `获取统计信息失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  async clear(): Promise<void> {
    try {
      const db = await getSafeDb();
      await db.execute(`DELETE FROM ${this.tableName}`);
      this.dimension = undefined;
      console.log(`向量存储 ${this.tableName} 已清空`);

    } catch (error) {
      throw new RetrievalError(
        `清空向量存储失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  /**
   * 获取向量存储的维度
   */
  getDimension(): number | undefined {
    return this.dimension;
  }

  /**
   * 设置相似度算法
   */
  setSimilarityMetric(metric: string): void {
    const availableMetrics = SimilarityCalculator.getAvailableMetrics();
    if (!availableMetrics.includes(metric)) {
      throw new RetrievalError(`不支持的相似度算法: ${metric}`);
    }
    this.similarityMetric = metric;
  }

  /**
   * 获取当前使用的相似度算法
   */
  getSimilarityMetric(): string {
    return this.similarityMetric;
  }

  /**
   * 检查向量是否存在
   */
  async vectorExists(id: string): Promise<boolean> {
    try {
      const db = await getSafeDb();
      const query = `SELECT 1 FROM ${this.tableName} WHERE id = ? LIMIT 1`;
      const result = await db.select(query, [id]);
      return result.length > 0;

    } catch (error) {
      throw new RetrievalError(
        `检查向量存在性失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  /**
   * 获取指定ID的向量
   */
  async getVector(id: string): Promise<VectorSearchResult | null> {
    try {
      const db = await getSafeDb();
      const query = `
        SELECT id, content, embedding, metadata 
        FROM ${this.tableName} 
        WHERE id = ?
      `;
      const result = await db.select(query, [id]);
      
      if (result.length === 0) {
        return null;
      }

      const row = result[0];
      return {
        id: row.id as string,
        content: row.content as string,
        score: 1.0, // 精确匹配
        metadata: JSON.parse(row.metadata as string),
        embedding: JSON.parse(row.embedding as string),
      };

    } catch (error) {
      throw new RetrievalError(
        `获取向量失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }
} 