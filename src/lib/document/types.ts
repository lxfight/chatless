// 文档处理相关类型定义

export interface DocumentExtractor {
  /**
   * 支持的文件类型
   */
  supportedTypes: string[];
  
  /**
   * 提取文档文本内容
   * @param filePath 文件路径
   * @returns 提取的文本内容
   */
  extractText(filePath: string): Promise<string>;
  
  /**
   * 提取器名称
   */
  getName(): string;
  
  /**
   * 检查是否支持指定文件类型
   * @param fileType 文件类型
   */
  supports(fileType: string): boolean;
}

export interface ExtractionResult {
  text: string;
  metadata: DocumentMetadata;
  success: boolean;
  error?: string;
}

export interface ExtractedDocument {
  content: string;
  metadata: ExtractedDocumentMetadata;
}

export interface ExtractedDocumentMetadata {
  fileName: string;
  filePath: string;
  fileType: string;
  extractedAt: Date;
  extractorType: string;
  wordCount: number;
  characterCount: number;
}

export interface DocumentMetadata {
  title?: string;
  author?: string;
  createdAt?: Date;
  modifiedAt?: Date;
  pageCount?: number;
  wordCount?: number;
  language?: string;
  fileSize: number;
  fileType: string;
  extractedAt: Date;
}

export interface ExtractionOptions {
  preserveFormatting?: boolean;
  extractImages?: boolean;
  extractTables?: boolean;
  maxLength?: number;
  encoding?: string;
}

// 错误类型
export class DocumentExtractionError extends Error {
  constructor(message: string, public fileType?: string, public cause?: Error) {
    super(message);
    this.name = 'DocumentExtractionError';
  }
}

export class UnsupportedFileTypeError extends DocumentExtractionError {
  constructor(fileType: string) {
    super(`不支持的文件类型: ${fileType}`, fileType);
    this.name = 'UnsupportedFileTypeError';
  }
}

export class FileReadError extends DocumentExtractionError {
  constructor(filePath: string, cause?: Error) {
    super(`无法读取文件: ${filePath}`, undefined, cause);
    this.name = 'FileReadError';
  }
} 