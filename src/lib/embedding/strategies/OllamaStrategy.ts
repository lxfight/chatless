import { EmbeddingStrategy, EmbeddingError, ModelLoadError, EmbeddingGenerationError } from '../types';
import { tauriFetch } from '@/lib/request';

/**
 * Ollama嵌入生成策略
 * 使用Ollama API进行嵌入生成
 */
export class OllamaStrategy implements EmbeddingStrategy {
  private isInitialized = false;
  private readonly dimension: number;

  constructor(private config: {
    apiUrl: string;
    modelName: string;
    dimension: number;
    timeout?: number;
    maxBatchSize?: number;
  }) {
    this.dimension = config.dimension;
  }

  getName(): string {
    return 'OllamaStrategy';
  }

  getDimension(): number {
    return this.dimension;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('正在初始化Ollama嵌入服务...');
      
      // 测试连接到Ollama API
      const response = await tauriFetch(`${this.config.apiUrl}/api/tags`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        danger: { acceptInvalidCerts: true, acceptInvalidHostnames: true },
        signal: AbortSignal.timeout(this.config.timeout || 10000),
      });

      // 检查响应状态 - 兼容Tauri HTTP响应对象
      // 如果响应对象有ok属性，说明是标准的Response对象
      if ((response).ok !== undefined) {
        if (!(response).ok) {
          const status = (response).status || (response).statusCode || 'unknown';
          const statusText = (response).statusText || '';
          throw new Error(`Ollama API响应错误: ${status} ${statusText}`);
        }
      } else {
        // 兼容旧的响应格式，直接检查状态码
        const status = (response).status || (response).statusCode;
        if (status && status !== 200) {
          const statusText = (response).statusText || '';
          throw new Error(`Ollama API响应错误: ${status} ${statusText}`);
        }
      }

      // 处理响应数据 - 兼容不同的响应格式
      let data: any;
      if (typeof response.json === 'function') {
        // 如果是标准的Response对象，解析JSON
        data = await response.json();
      } else if (typeof response === 'object' && response !== null) {
        // 如果已经是解析后的对象，直接使用
        data = response;
      } else {
        throw new Error('无法解析Ollama API响应');
      }
      
      // 检查模型是否可用
      const models = data.models || [];
      const modelExists = models.some((model: any) => model.name === this.config.modelName);
      
      if (!modelExists) {
        console.warn(`模型 ${this.config.modelName} 不在可用模型列表中，但仍尝试使用`);
      }

      this.isInitialized = true;
      console.log('Ollama嵌入服务初始化完成');
    } catch (error) {
      console.error('初始化Ollama嵌入服务失败:', error);
      throw new ModelLoadError(
        `无法连接到Ollama API: ${error instanceof Error ? error.message : String(error)}`,
        this.config.apiUrl
      );
    }
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.isInitialized) {
      throw new EmbeddingError('Ollama服务未初始化，请先调用 initialize()');
    }

    if (texts.length === 0) {
      return [];
    }

    try {
      console.log(`正在通过Ollama生成 ${texts.length} 个文本的嵌入向量...`);
      
      const results: number[][] = [];
      const maxBatchSize = this.config.maxBatchSize || 1; // Ollama通常一次处理一个
      
      for (let i = 0; i < texts.length; i += maxBatchSize) {
        const batch = texts.slice(i, i + maxBatchSize);
        console.log(`处理批次 ${Math.floor(i / maxBatchSize) + 1}/${Math.ceil(texts.length / maxBatchSize)}`);
        
        for (const text of batch) {
          const embedding = await this.generateSingleEmbedding(text);
          results.push(embedding);
        }
      }
      
      console.log(`成功生成 ${results.length} 个嵌入向量`);
      return results;
    } catch (error) {
      console.error('生成嵌入向量失败:', error);
      throw new EmbeddingGenerationError(
        `生成嵌入向量失败: ${error instanceof Error ? error.message : String(error)}`,
        texts
      );
    }
  }

  private async generateSingleEmbedding(text: string): Promise<number[]> {
    try {
      const response = await tauriFetch(`${this.config.apiUrl}/api/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.modelName,
          prompt: text,
          stream: false,
        }),
        danger: { acceptInvalidCerts: true, acceptInvalidHostnames: true },
        signal: AbortSignal.timeout(this.config.timeout || 30000),
      });

      // 检查响应状态 - 兼容Tauri HTTP响应对象
      // 如果响应对象有ok属性，说明是标准的Response对象
      if ((response).ok !== undefined) {
        if (!(response).ok) {
          const status = (response).status || (response).statusCode || 'unknown';
          const statusText = (response).statusText || '';
          throw new Error(`Ollama API响应错误: ${status} ${statusText}`);
        }
      } else {
        // 兼容旧的响应格式，直接检查状态码
        const status = (response).status || (response).statusCode;
        if (status && status !== 200) {
          const statusText = (response).statusText || '';
          throw new Error(`Ollama API响应错误: ${status} ${statusText}`);
        }
      }

      // 处理响应数据 - 兼容不同的响应格式
      let data: any;
      if (typeof response.json === 'function') {
        // 如果是标准的Response对象，解析JSON
        data = await response.json();
      } else if (typeof response === 'object' && response !== null) {
        // 如果已经是解析后的对象，直接使用
        data = response;
      } else {
        throw new Error('无法解析Ollama API响应');
      }
      
      if (!data.embedding || !Array.isArray(data.embedding)) {
        throw new Error('Ollama API返回的嵌入格式无效');
      }

      return data.embedding;
    } catch (error) {
      throw new EmbeddingGenerationError(
        `生成单个嵌入失败: ${error instanceof Error ? error.message : String(error)}`,
        [text]
      );
    }
  }

  async cleanup(): Promise<void> {
    try {
      this.isInitialized = false;
      console.log('Ollama嵌入策略已清理');
    } catch (error) {
      console.error('清理Ollama嵌入策略失败:', error);
      throw new EmbeddingError(
        `清理失败: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 检查服务是否已初始化
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * 获取配置信息
   */
  getConfig(): {
    apiUrl: string;
    modelName: string;
    dimension: number;
    isInitialized: boolean;
  } {
    return {
      apiUrl: this.config.apiUrl,
      modelName: this.config.modelName,
      dimension: this.dimension,
      isInitialized: this.isInitialized,
    };
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await tauriFetch(`${this.config.apiUrl}/api/tags`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        danger: { acceptInvalidCerts: true, acceptInvalidHostnames: true },
        signal: AbortSignal.timeout(5000),
      });
      
      // 检查响应状态 - 兼容Tauri HTTP响应对象
      // 如果响应对象有ok属性，说明是标准的Response对象
      if ((response).ok !== undefined) {
        return (response).ok;
      } else {
        // 兼容旧的响应格式，直接检查状态码
        const status = (response).status || (response).statusCode;
        return status === 200;
      }
    } catch {
      return false;
    }
  }
} 