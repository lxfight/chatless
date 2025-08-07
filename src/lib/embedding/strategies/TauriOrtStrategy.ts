import { invoke } from '@tauri-apps/api/core';
import { EmbeddingStrategy, EmbeddingError } from '../types';

/**
 * Tauri ORT 策略
 * - 不关心模型或分词器路径。
 * - 假设Rust后端能够通过自身状态管理当前激活的模型。
 * - 直接将文本传递给后端，由后端完成分词和嵌入生成。
 */
export class TauriOrtStrategy implements EmbeddingStrategy {
  private isInitialized = false;
  private readonly dimension = 384; // 假设所有模型维度一致

  getName(): string {
    return 'TauriOrtStrategy';
  }

  getDimension(): number {
    return this.dimension;
  }

  async initialize(): Promise<void> {
    // Rust后端在启动时已自行初始化，此处无需操作。
    // 只需设置一个标记，表示前端策略已准备就绪。
    this.isInitialized = true;
    console.log('TauriOrtStrategy initialized.');
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.isInitialized) {
      throw new EmbeddingError('TauriOrtStrategy not initialized');
    }

    if (texts.length === 0) {
      return [];
    }

    try {
      // 直接调用后端命令，传递文本数组
      const embeddings: number[][] = await invoke('generate_embedding_command', {
        texts,
      });
      return embeddings;
    } catch (error) {
      console.error('Failed to generate embeddings via Tauri:', error);
      // 将底层的错误包装为 EmbeddingError
      throw new EmbeddingError(`Tauri command failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async cleanup(): Promise<void> {
    // Rust后端会话的生命周期由其自身管理，前端无需干预。
    this.isInitialized = false;
  }
} 