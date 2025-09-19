"use client";

import { useState } from 'react';
import { Copy, Pencil, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DocumentReference } from './DocumentReference';
import { cn } from '@/lib/utils';

// 帮助函数: 检查文档引用是否有效
const isValidDocumentReference = (ref: any): boolean => {
  if (!ref || typeof ref !== 'object' || Array.isArray(ref)) {
    return false;
  }
  
  const requiredFields = {
    fileName: (val: any) => typeof val === 'string' && val.length > 0,
    fileType: (val: any) => typeof val === 'string' && val.length > 0,
    fileSize: (val: any) => typeof val === 'number' && val >= 0,
    summary: (val: any) => typeof val === 'string'
  };
  
  return Object.entries(requiredFields).every(([field, validator]) => validator(ref[field]));
};

// 通过base64数据的特征推断图片格式
const detectImageFormat = (base64Data: string): string => {
  // 检查base64数据的特征来推断格式
  const firstBytes = atob(base64Data).slice(0, 4);
  const bytes = new Uint8Array(firstBytes.length);
  for (let i = 0; i < firstBytes.length; i++) {
    bytes[i] = firstBytes.charCodeAt(i);
  }
  
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return 'image/png';
  }
  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return 'image/jpeg';
  }
  // GIF: 47 49 46 38
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return 'image/gif';
  }
  // WebP: 52 49 46 46 ... 57 45 42 50
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    return 'image/webp';
  }
  
  // 默认使用PNG（更通用的格式）
  return 'image/png';
};

interface UserMessageBlockProps {
  id: string;
  content: string;
  documentReference?: {
    fileName: string;
    fileType: string;
    fileSize: number;
    summary: string;
  };
  contextData?: string;
  knowledgeBaseReference?: {
    id: string;
    name: string;
  };
  images?: string[];
  onEdit?: (id: string) => void;
  onCopy?: (content: string) => void;
}

export const UserMessageBlock = ({
  id,
  content,
  documentReference,
  contextData,
  knowledgeBaseReference,
  onEdit,
  images = [],
  onCopy,
}: UserMessageBlockProps) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async (content: string) => {
    try {
      if (onCopy) {
        onCopy(content);
      } else {
        await navigator.clipboard.writeText(content);
      }
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  return (
    <div className="relative max-w-full will-change-auto">
      {/* 去除内层气泡底色与边框，避免与外层气泡叠加造成“深外浅内”的观感 */}
      <div className="max-w-full text-blue-900 dark:text-blue-50 transition-all duration-200">
        {/* 知识库引用部分 - 使用 flex 和 truncate 优化布局 */}
        {knowledgeBaseReference && (
          <div className="mb-3 p-2.5 bg-blue-500/5 dark:bg-blue-400/5 border border-blue-500/10 dark:border-blue-400/10 rounded-xl">
            <div className="flex items-center gap-2 text-sm min-w-0">
              <div className="w-4 h-4 text-blue-500/80 dark:text-blue-400/80 shrink-0">🧠</div>
              <span className="text-blue-600/90 dark:text-blue-300/90 font-medium whitespace-nowrap shrink-0">引用知识库:</span>
              <span className="text-blue-700 dark:text-blue-200 font-semibold truncate">{knowledgeBaseReference.name}</span>
            </div>
          </div>
        )}
        
        {/* 文档引用部分 */}
        {documentReference && isValidDocumentReference(documentReference) && (
          <DocumentReference
            fileName={documentReference.fileName}
            fileType={documentReference.fileType}
            fileSize={documentReference.fileSize}
            summary={documentReference.summary}
            fullContent={contextData}
            variant="user-message"
            className="mb-3"
          />
        )}
        
        {/* 用户消息内容 - 优化文本显示 */}
        {content && (
          <div className="whitespace-pre-wrap break-words overflow-wrap-anywhere max-w-full">
            {content}
          </div>
        )}

        {images && images.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {images.map((src, idx) => {
              // 将纯base64数据转换为Data URL格式
              const imageSrc = src.startsWith('data:') ? src : `data:${detectImageFormat(src)};base64,${src}`;
              return (
                <img key={idx} src={imageSrc} alt="img" className="w-24 h-24 object-cover rounded" />
              );
            })}
          </div>
        )}
        
        {/* 默认提示文本 - 使用 truncate 实现单行显示 */}
        {!content && (documentReference || knowledgeBaseReference) && (
          <div className="text-blue-600/80 dark:text-blue-300/80 italic text-sm truncate">
            {documentReference && knowledgeBaseReference ? 
              "请基于上述文档和知识库为我解答问题" :
              documentReference ? 
                "请基于上述文档为我解答问题" :
                "请基于知识库为我解答问题"
            }
          </div>
        )}
      </div>
      
      {/* 操作按钮部分 - 优化定位和布局 */}
      <div className="absolute top-1/2 -translate-y-1/2 -left-3 md:-left-4 transform -translate-x-full z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 will-change-transform">
        {onEdit && id && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(id)}
            className="h-6 w-6 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 shrink-0"
            title="编辑"
          >
            <Pencil className="w-4 h-4" />
          </Button>
        )}
        {onCopy && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleCopy(content)}
            className={cn(
              "h-6 w-6 shrink-0 transition-all duration-200",
              isCopied
                ? "text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            )}
            title={isCopied ? "已复制" : "复制"}
          >
            {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
        )}
      </div>
      
    </div>
  );
}; 