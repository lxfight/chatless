'use client';

import { ResourceItem } from './ResourceItem';
import { Loader2 } from 'lucide-react';
import { ResourceListProps } from './types';
import { FileText } from 'lucide-react'; // Added FileText import

// 文档类型扩展名
const DOCUMENT_EXTENSIONS = [
  'txt', 'md', 'markdown', 'pdf', 'doc', 'docx', 
  'ppt', 'pptx', 'xls', 'xlsx', 'rtf', 'odt'
];

// 代码和数据文件扩展名
const FILE_EXTENSIONS = [
  'py', 'js', 'ts', 'jsx', 'tsx', 'java', 'cpp', 'c', 'h', 'cs', 'php', 'rb', 'go', 'rs', 'swift',
  'json', 'xml', 'yaml', 'yml', 'ini', 'cfg', 'toml', 'env',
  'csv', 'sql', 'db', 'sqlite', 'log', 'conf'
];

// 判断文件是否为文档类型
const isDocumentType = (filename: string): boolean => {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? DOCUMENT_EXTENSIONS.includes(ext) : false;
};

// 判断文件是否为代码/数据文件类型
const isFileType = (filename: string): boolean => {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? FILE_EXTENSIONS.includes(ext) : false;
};

export function ResourceList({
  resources,
  type,
  loading,
  onView,
  onAddToKnowledgeBase,
  onDelete,
  onAddNote,
  onComment
}: ResourceListProps) {
  // 根据类型筛选资源
  const filteredResources = type === 'documents'
    ? resources.filter(r => r.source !== 'chat' && isDocumentType(r.title)) // 只显示文档类型，排除聊天文件
      : type === 'files'
      ? resources.filter(r => r.source !== 'chat' && isFileType(r.title)) // 只显示代码/数据文件，排除聊天文件
      : type === 'chat'
        ? resources.filter(r => r.source === 'chat') // 只显示聊天文件
        : type === 'knowledge'
          ? resources.filter(r => r.isIndexed) // 只显示已索引文件
          : resources;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-60">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-sm text-gray-500">加载资源中...</p>
        </div>
      </div>
    );
  }

  if (filteredResources.length === 0) {
    return (
      <div className="flex items-center justify-center h-60">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center">
            <FileText className="w-6 h-6 text-gray-400 dark:text-gray-500" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
            {type === 'documents' && '暂无文档'}
            {type === 'files' && '暂无文件'}
            {type === 'chat' && '暂无聊天附件'}
            {type === 'knowledge' && '知识库中暂无资源'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {type === 'knowledge' 
              ? '在资源卡片上点击"添加到知识库"即可入库' 
              : type === 'chat'
                ? '您在聊天窗口中附加的文件将自动出现在此处' 
                : type === 'documents'
                  ? '支持拖拽 .txt / .md / .pdf 等文档到顶部区域，或点击"上传资源"按钮' 
                  : '支持拖拽代码、数据文件到顶部区域，或点击"上传资源"按钮'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto pb-4 rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900/80">
      {filteredResources.map(resource => (
        <ResourceItem 
          key={resource.id}
          {...resource}
          onView={onView}
          onAddToKnowledgeBase={(id: string) => onAddToKnowledgeBase?.(id)}
          onDelete={onDelete}
          onAddNote={(id: string) => onAddNote?.(id, '')}
          onComment={onComment}
        />
      ))}
    </div>
  );
} 