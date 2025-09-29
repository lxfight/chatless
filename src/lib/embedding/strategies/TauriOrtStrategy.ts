import { invoke } from '@tauri-apps/api/core';
import { EmbeddingStrategy, EmbeddingError } from '../types';
import { modelConfigService } from '../ModelConfigService';

/**
 * Tauri ORT 策略
 * - 不关心模型或分词器路径。
 * - 假设Rust后端能够通过自身状态管理当前激活的模型。
 * - 直接将文本传递给后端，由后端完成分词和嵌入生成。
 * - 使用ModelConfigService统一管理模型配置，避免硬编码。
 */
export class TauriOrtStrategy implements EmbeddingStrategy {
  private isInitialized = false;
  private modelId: string;
  private dimension: number = 384; // 默认维度，初始化时会更新

  constructor(modelName?: string) {
    this.modelId = modelName || 'all-minilm-l6-v2'; // 默认模型（修正后的正确ID）
    console.log(`[TauriOrtStrategy] 初始化，模型ID: ${this.modelId}`);
  }

  getName(): string {
    return 'TauriOrtStrategy';
  }

  getDimension(): number {
    return this.dimension;
  }

  async initialize(): Promise<void> {
    try {
      // 1. 从ModelConfigService获取正确的维度信息
      this.dimension = await modelConfigService.getModelDimensions(this.modelId);
      console.log(`[TauriOrtStrategy] 模型 ${this.modelId} 维度已确定: ${this.dimension}`);
      
      // 2. Rust后端在启动时已自行初始化，此处无需额外操作
      this.isInitialized = true;
      console.log('[TauriOrtStrategy] 初始化完成');
    } catch (error) {
      console.error('[TauriOrtStrategy] 初始化失败:', error);
      // 使用默认维度继续初始化
      this.isInitialized = true;
      console.warn(`[TauriOrtStrategy] 使用默认维度 ${this.dimension} 继续初始化`);
    }
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