// 资源类型定义
export interface Resource {
  id: string;
  type: 'document' | 'file';
  name: string;
  path?: string;
  size: string; // 格式化后的文件大小，如 "1.2 MB"
  sizeBytes: number; // 原始字节数
  fileType: string;
  created_at: string;
  updated_at: string;
  tags: string[];
  note?: string;
  is_indexed: boolean;
  knowledge_base_id?: string;
}

// 文件信息接口
export interface FileInfo {
  id: string;
  name: string;
  size: string;
  sizeBytes: number;
  type: string;
  uploadTime: string;
  path: string;
}

// 文档信息接口（继承自documentService）
export interface DocumentInfo {
  id: string;
  title: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
  updatedAt: string;
  tags?: string; // JSON字符串
  folderPath?: string;
  isIndexed: boolean;
  folderId?: string;
}

// 转换函数：将Document转换为Resource
export function documentToResource(doc: DocumentInfo): Resource {
  return {
    id: doc.id,
    type: 'document',
    name: doc.title,
    path: doc.filePath,
    size: formatFileSize(doc.fileSize),
    sizeBytes: doc.fileSize,
    fileType: doc.fileType,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
    tags: doc.tags ? JSON.parse(doc.tags) : [],
    is_indexed: doc.isIndexed,
    knowledge_base_id: doc.folderId
  };
}

// 转换函数：将FileInfo转换为Resource
export function fileToResource(file: FileInfo): Resource {
  return {
    id: file.id,
    type: 'file',
    name: file.name,
    path: file.path,
    size: file.size,
    sizeBytes: file.sizeBytes,
    fileType: file.type,
    created_at: file.uploadTime,
    updated_at: file.uploadTime,
    tags: [],
    is_indexed: false
  };
}

// 文件大小格式化辅助函数
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
} 