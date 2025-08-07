// 文本分块相关类型定义

export interface TextChunk {
  id: string;
  content: string;
  startIndex: number;
  endIndex: number;
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  documentId?: string;
  chunkIndex: number;
  totalChunks?: number;
  wordCount: number;
  characterCount: number;
  overlap?: number;
  sourceSection?: string;
  pageNumber?: number;
  createdAt: Date;
}

export interface ChunkingOptions {
  chunkSize: number;
  overlap: number;
  separators?: string[];
  preserveSentences?: boolean;
  preserveParagraphs?: boolean;
  minChunkSize?: number;
  maxChunkSize?: number;
}

export interface ChunkingStrategy {
  /**
   * 将文本分块
   * @param text 要分块的文本
   * @param options 分块选项
   * @returns 分块结果
   */
  chunkText(text: string, options: ChunkingOptions): TextChunk[];
  
  /**
   * 策略名称
   */
  getName(): string;
  
  /**
   * 获取默认选项
   */
  getDefaultOptions(): ChunkingOptions;
}

export interface ChunkingResult {
  chunks: TextChunk[];
  totalChunks: number;
  totalCharacters: number;
  averageChunkSize: number;
  metadata: {
    strategy: string;
    options: ChunkingOptions;
    processedAt: Date;
  };
}

// 错误类型
export class ChunkingError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'ChunkingError';
  }
}

export class InvalidChunkSizeError extends ChunkingError {
  constructor(chunkSize: number) {
    super(`无效的分块大小: ${chunkSize}`);
    this.name = 'InvalidChunkSizeError';
  }
}

export class TextTooShortError extends ChunkingError {
  constructor(textLength: number, minLength: number) {
    super(`文本太短无法分块: ${textLength} < ${minLength}`);
    this.name = 'TextTooShortError';
  }
} 