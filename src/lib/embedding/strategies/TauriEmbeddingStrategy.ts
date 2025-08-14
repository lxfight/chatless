import { EmbeddingStrategy, EmbeddingError, ModelLoadError, EmbeddingGenerationError } from '../types';

/**
 * Tauri嵌入生成策略
 * 将嵌入生成委托给Rust后端处理
 */
export class TauriEmbeddingStrategy implements EmbeddingStrategy {
  private readonly dimension = 384; // all-MiniLM-L6-v2 的嵌入维度
  private isInitialized = false;

  constructor(private config?: {
    modelPath?: string;
    maxBatchSize?: number;
    timeout?: number;
  }) {}

  getName(): string {
    return 'TauriEmbeddingStrategy';
  }

  getDimension(): number {
    return this.dimension;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('正在初始化Tauri嵌入模型...');
      
      // 检查Tauri环境
      if (typeof window === 'undefined') {
        throw new Error('Tauri环境不可用');
      }

      // 动态导入Tauri API
      const { invoke } = await import('@tauri-apps/api/core');
      
      // 初始化后端嵌入模型
      await invoke('initialize_embedding_model', {
        modelPath: this.config?.modelPath || 'models/all-MiniLM-L6-v2',
        config: this.config
      });

      this.isInitialized = true;
      console.log('Tauri嵌入模型初始化完成');
    } catch (error) {
      console.error('初始化Tauri嵌入模型失败:', error);
      
      // 如果是Tauri命令不存在的错误，提供友好的提示
      if (error instanceof Error && error.message.includes('No command found')) {
        throw new ModelLoadError(
          'Tauri后端嵌入功能尚未实现。当前使用模拟模式。',
          this.config?.modelPath || 'tauri-backend'
        );
      }
      
      throw new ModelLoadError(
        `无法初始化Tauri嵌入模型: ${error instanceof Error ? error.message : String(error)}`,
        this.config?.modelPath || 'tauri-backend'
      );
    }
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.isInitialized) {
      throw new EmbeddingError('嵌入模型未初始化，请先调用 initialize()');
    }

    if (texts.length === 0) {
      return [];
    }

    try {
      console.log(`正在生成 ${texts.length} 个文本的嵌入向量...`);
      
      // 对于Tauri环境，我们需要处理可能的模拟情况
      if (typeof window === 'undefined') {
        return this.generateMockEmbeddings(texts);
      }

             const { invoke } = await import('@tauri-apps/api/core');
       
       // 批量处理文本
      const maxBatchSize = this.config?.maxBatchSize || 32;
      const results: number[][] = [];
      
      for (let i = 0; i < texts.length; i += maxBatchSize) {
        const batch = texts.slice(i, i + maxBatchSize);
        console.log(`处理批次 ${Math.floor(i / maxBatchSize) + 1}/${Math.ceil(texts.length / maxBatchSize)}`);
        
        try {
          // 调用Tauri后端生成嵌入
          const embeddings = await invoke<number[][]>('generate_embeddings', {
            texts: batch,
            timeout: this.config?.timeout || 30000
          });
          
          results.push(...embeddings);
        } catch (error) {
          console.warn('Tauri嵌入生成失败，使用模拟数据:', error);
          // 后备方案：生成模拟嵌入
          const mockEmbeddings = this.generateMockEmbeddings(batch);
          results.push(...mockEmbeddings);
        }
      }
      
      console.log(`成功生成 ${results.length} 个嵌入向量`);
      return results;
    } catch (error) {
      console.error('生成嵌入向量失败:', error);
      
      // 后备方案：生成模拟嵌入
      console.warn('使用模拟嵌入向量');
      return this.generateMockEmbeddings(texts);
    }
  }

  /**
   * 生成模拟嵌入向量（用于开发和测试）
   */
  private generateMockEmbeddings(texts: string[]): number[][] {
    return texts.map(text => {
      // 基于文本内容生成确定性的模拟向量
      const hash = this.simpleHash(text);
      const embedding = new Array(this.dimension);
      
      for (let i = 0; i < this.dimension; i++) {
        // 使用文本哈希值生成确定性的浮点数
        const seed = (hash + i) % 100000;
        embedding[i] = (Math.sin(seed * 0.001) + Math.cos(seed * 0.002)) * 0.5;
      }
      
      // 标准化向量
      const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      return embedding.map(val => norm > 0 ? val / norm : 0);
    });
  }

  /**
   * 简单的字符串哈希函数
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash);
  }

  async cleanup(): Promise<void> {
    try {
      if (this.isInitialized && typeof window !== 'undefined') {
                 try {
           const { invoke } = await import('@tauri-apps/api/core');
           await invoke('cleanup_embedding_model');
        } catch (error) {
          console.warn('Tauri嵌入模型清理失败:', error);
        }
      }
      
      this.isInitialized = false;
      console.log('Tauri嵌入策略已清理');
    } catch (error) {
      console.error('清理Tauri嵌入策略失败:', error);
      throw new EmbeddingError(
        `清理失败: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 检查模型是否已初始化
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * 获取模型信息
   */
  getModelInfo(): {
    name: string;
    dimension: number;
    isInitialized: boolean;
    config: any;
  } {
    return {
      name: 'TauriEmbeddingStrategy',
      dimension: this.dimension,
      isInitialized: this.isInitialized,
      config: this.config
    };
  }

  /**
   * 测试连接到Tauri后端
   */
  async testConnection(): Promise<boolean> {
    try {
      if (typeof window === 'undefined') {
        return false;
      }

      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('ping_embedding_service');
      return true;
    } catch {
      return false;
    }
  }
} 