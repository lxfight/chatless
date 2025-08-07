// 文档解析相关类型定义

export interface DocumentParseResult {
  success: boolean;
  content?: string;
  error?: string;
  fileType?: string;
  fileName?: string;
  fileSize?: number;
}

export interface DocumentParseOptions {
  // 最大文件大小（字节），默认 50MB
  maxFileSize?: number;
  // 是否保留格式信息
  preserveFormatting?: boolean;
}

export type SupportedFileType = 'pdf' | 'docx' | 'md' | 'markdown' | 'txt';

export interface DocumentMetadata {
  fileName: string;
  fileSize: number;
  fileType: string;
  lastModified: Date;
  filePath: string;
} 