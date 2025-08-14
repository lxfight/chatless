"use client";

import { useState } from 'react';
import { FileText, ChevronDown, ChevronRight, File, FileType } from 'lucide-react';
import { cn } from "@/lib/utils";

interface DocumentReferenceProps {
  fileName: string;
  fileType: string;
  fileSize: number;
  summary: string;
  fullContent?: string;
  className?: string;
  variant?: 'default' | 'user-message' | 'ai-message';
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const truncateText = (text: string, maxLength: number): string => {
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, Math.max(0, maxLength - 1))}…` : text;
};

const getFileIcon = (fileType: string, variant: string = 'default') => {
  const type = fileType.toLowerCase();
  let iconColor = "";
  
  switch (variant) {
    case 'user-message':
      iconColor = "text-blue-500/80 dark:text-blue-400/80";
      break;
    case 'ai-message':
      iconColor = "text-slate-600 dark:text-slate-400";
      break;
    default:
      iconColor = "text-blue-600 dark:text-blue-400";
      break;
  }
  
  if (type === 'pdf') return <FileType className={`w-4 h-4 ${iconColor}`} />;
  if (type === 'docx' || type === 'doc') return <FileText className={`w-4 h-4 ${iconColor}`} />;
  if (type === 'txt' || type === 'md' || type === 'markdown') return <File className={`w-4 h-4 ${iconColor}`} />;
  return <FileText className={`w-4 h-4 ${iconColor}`} />;
};

export function DocumentReference({
  fileName,
  fileType,
  fileSize,
  summary,
  fullContent,
  className,
  variant = 'default'
}: DocumentReferenceProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // 根据变体选择样式
  const getVariantStyles = () => {
    switch (variant) {
      case 'user-message':
        return {
          container: "border border-blue-500/10 dark:border-blue-400/10 rounded-xl bg-blue-500/5 dark:bg-blue-400/5 p-3 my-2",
          fileName: "font-medium text-blue-900 dark:text-blue-100 text-sm truncate block",
          fileType: "text-xs text-blue-600 dark:text-blue-300 bg-blue-500/10 dark:bg-blue-400/10 px-2 py-0.5 rounded-lg",
          fileSize: "text-xs text-blue-600/70 dark:text-blue-300/70",
          summary: "text-sm text-blue-800/90 dark:text-blue-200/90 truncate",
          expandButton: "text-xs text-blue-600/80 dark:text-blue-300/80 hover:text-blue-700 dark:hover:text-blue-200",
          expandedHeader: "text-xs text-blue-600/70 dark:text-blue-300/70 mb-2",
          expandedContent: "text-sm text-blue-900 dark:text-blue-100 bg-white dark:bg-slate-800 p-3 rounded-xl border border-blue-100 dark:border-blue-800 max-h-60 overflow-y-auto"
        };
      case 'ai-message':
        return {
          container: "border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 my-2",
          fileName: "font-medium text-slate-900 dark:text-slate-100 text-sm truncate block",
          fileType: "text-xs text-slate-600 dark:text-slate-300 bg-slate-200/50 dark:bg-slate-700/50 px-2 py-0.5 rounded-lg",
          fileSize: "text-xs text-slate-500 dark:text-slate-400",
          summary: "text-sm text-slate-700 dark:text-slate-300 truncate",
          expandButton: "text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200",
          expandedHeader: "text-xs text-slate-600 dark:text-slate-400 mb-2",
          expandedContent: "text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 max-h-60 overflow-y-auto"
        };
      default:
        return {
          container: "border border-blue-200 dark:border-blue-800 rounded-xl bg-blue-50 dark:bg-blue-900/20 p-3 my-2",
          fileName: "font-medium text-blue-900 dark:text-blue-100 text-sm truncate block",
          fileType: "text-xs text-blue-600 dark:text-blue-300 bg-blue-100 dark:bg-blue-800/50 px-2 py-0.5 rounded-lg",
          fileSize: "text-xs text-slate-500 dark:text-slate-400",
          summary: "text-sm text-blue-800 dark:text-blue-200 truncate",
          expandButton: "text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300",
          expandedHeader: "text-xs text-slate-600 dark:text-slate-400 mb-2",
          expandedContent: "text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 p-3 rounded-xl border border-blue-100 dark:border-blue-800 max-h-60 overflow-y-auto"
        };
    }
  };
  
  const styles = getVariantStyles();
  
  return (
    <div className={cn(
      styles.container,
      "will-change-auto transform-gpu transition-all duration-200 min-w-0",
      className
    )}>
      {/* 文档引用头部 */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {getFileIcon(fileType, variant)}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={styles.fileName} title={fileName}>
              📎 {truncateText(fileName, 18)}
            </span>
            <span className={styles.fileType}>
              {fileType.toUpperCase()}
            </span>
            <span className={styles.fileSize}>
              {formatFileSize(fileSize)}
            </span>
          </div>
          
          <p className={styles.summary} title={summary}>
            {truncateText(summary, 36)}
          </p>
          
          {/* 展开/收起按钮 */}
          {fullContent && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={cn(
                "flex items-center gap-1 mt-2.5 transition-colors duration-200",
                styles.expandButton
              )}
            >
              {isExpanded ? (
                <>
                  <ChevronDown className="w-3 h-3" />
                  收起完整内容
                </>
              ) : (
                <>
                  <ChevronRight className="w-3 h-3" />
                  查看完整内容
                </>
              )}
            </button>
          )}
        </div>
      </div>
      
      {/* 展开的完整内容 */}
      {isExpanded && fullContent && (
        <div className={cn(
          "mt-3 pt-3",
          variant === 'user-message'
            ? "border-t border-blue-500/10 dark:border-blue-400/10"
            : "border-t border-slate-200 dark:border-slate-700"
        )}>
          <div className={styles.expandedHeader}>文档完整内容：</div>
          <div className={styles.expandedContent}>
            <pre className="whitespace-pre-wrap break-words font-sans">{fullContent}</pre>
          </div>
        </div>
      )}
    </div>
  );
} 