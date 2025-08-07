"use client";

import { FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AttachedDocumentViewProps {
  document: {
    name: string;
    summary: string;
    fileSize: number;
  };
  onRemove: () => void;
  className?: string;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
};

export function AttachedDocumentView({ document, onRemove, className }: AttachedDocumentViewProps) {
  return (
    <div className={cn(
      "relative mx-3 mb-2 p-2.5 rounded-lg border border-green-200/80 dark:border-green-700/50", 
      "bg-gradient-to-r from-green-50/80 to-emerald-50/80 dark:from-green-900/20 dark:to-emerald-900/20",
      "shadow-sm hover:shadow-md transition-all duration-200",
      className
    )}>
      {/* X按钮 - 右上角 */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onRemove}
        className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-600 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all duration-200 z-10"
              title="移除文档"
            >
        <X className="w-2.5 h-2.5" />
            </Button>

      <div className="flex items-center gap-2.5 pr-1">
        {/* 文档图标 */}
        <div className="flex-shrink-0 w-7 h-7 rounded-md bg-green-100 dark:bg-green-800/50 flex items-center justify-center">
          <FileText className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
        </div>
        
        {/* 文档信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-medium text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-800/30 px-1.5 py-0.5 rounded-full">
              📎 已附加
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
              {formatFileSize(document.fileSize)}
            </span>
          </div>
          
          <h4 className="font-medium text-gray-800 dark:text-gray-200 text-sm leading-tight truncate mb-0.5" title={document.name}>
            {document.name}
          </h4>
          
          {document.summary && (
            <p className="text-xs text-gray-600 dark:text-gray-400 truncate leading-relaxed">
            {document.summary}
          </p>
          )}
        </div>
      </div>
    </div>
  );
} 