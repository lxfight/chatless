"use client";

import React, { useState } from 'react';
import { FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getCurrentKnowledgeBaseConfig } from '@/lib/knowledgeBaseConfig';
import { estimateTokens } from '@/lib/utils/tokenBudget';
import { toast } from 'sonner';
import { KnowledgeService } from '@/lib/knowledgeService';
import { Loader2, Database } from 'lucide-react';

interface AttachedDocumentViewProps {
  document: {
    name: string;
    summary: string;
    fileSize: number;
  };
  onRemove: () => void;
  className?: string;
  onIndexed?: (knowledgeBaseId: string) => void;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
};

const truncateText = (text: string, maxLength: number): string => {
  if (!text) return '';
  return text.length > maxLength ? `${text.slice(0, Math.max(0, maxLength - 1))}…` : text;
};

export function AttachedDocumentView({ document, onRemove, className, onIndexed }: AttachedDocumentViewProps) {
  const cfg = getCurrentKnowledgeBaseConfig();
  const isBigFile = document.fileSize > cfg.documentProcessing.bigFileSizeMb * 1024 * 1024;
  const tokenEstimate = estimateTokens(document.summary || document.name);
  const isBigToken = tokenEstimate > cfg.documentProcessing.bigTokenThreshold;

  const [indexing, setIndexing] = useState(false);

  const handleQuickIndex = async () => {
    try {
      setIndexing(true);
      await KnowledgeService.initDb();
      // 1) 创建/获取临时知识库（以会话或默认名称）
      const tempKbName = '临时收纳箱';
      const all = await KnowledgeService.getAllKnowledgeBases();
      let kb = all.find(k => k.name === tempKbName);
      if (!kb) {
        kb = await KnowledgeService.createKnowledgeBase(tempKbName, '用于临时索引与引用的知识库');
      }
      // 2) 仅基于当前“解析后的预览内容”生成一个临时文档并索引（轻量）
      const { UnifiedFileService } = await import('@/lib/unifiedFileService');
      // 以 TXT 形式保存“安全预览”文本，避免按原始扩展名走复杂解析（如 epub）
      const base = (document.name || 'document').replace(/\.[^.]+$/, '');
      const previewName = `${base}.preview.txt`;
      const fakeBytes = new TextEncoder().encode(document.summary || document.name);
      const saved = await UnifiedFileService.saveFile(fakeBytes, previewName, 'chat', { knowledgeBaseId: kb.id });
      await KnowledgeService.addDocumentToKnowledgeBase(saved.id, kb.id, {
        onProgress: (p, m) => { if (p % 20 === 0) console.log(`[Indexing] ${p}% ${m}`); },
        skipIfExists: true,
      });
      toast.success('已索引到临时知识库，并自动引用');
      onIndexed?.(kb.id);
    } catch (e) {
      console.error('索引失败', e);
      toast.error('索引失败', { description: e instanceof Error ? e.message : '未知错误' });
    } finally {
      setIndexing(false);
    }
  };
  const TITLE_MAX = 20;
  const SUMMARY_MAX = 40;
  const titleText = truncateText(document.name, TITLE_MAX);
  const summary = truncateText(document.summary, SUMMARY_MAX);
  return (
    <div className={cn(
      "relative w-full max-w-full overflow-hidden mb-2 p-2.5 rounded-lg border border-green-200/80 dark:border-green-700/50", 
      "bg-gradient-to-r from-green-50/80 to-emerald-50/80 dark:from-green-900/20 dark:to-emerald-900/20",
      "shadow-sm hover:shadow-md transition-all duration-200",
      className
    )}>
      {/* X按钮 - 右上角 */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onRemove}
        className="absolute top-1 right-1 h-5 w-5 rounded-full bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-600 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all duration-200 z-10"
              title="移除文档"
            >
        <X className="w-2.5 h-2.5" />
            </Button>

      <div className="flex items-center gap-2.5 pr-1 min-w-0">
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
          
          <h4 className="font-medium text-gray-800 dark:text-gray-200 text-[13px] leading-tight truncate mb-0.5 max-w-full" title={document.name}>
            <span className="block truncate">{titleText}</span>
          </h4>
          
          {document.summary && (
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed max-w-full">
            <span className="block truncate">{summary}</span>
          </p>
          )}
        </div>
      </div>

      {(isBigFile || isBigToken) && (
        <div className="mt-2 px-2 py-1.5 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between gap-2 min-w-0">
          <div className="flex-1 min-w-0 truncate">检测到大文档，推荐转入知识库以获得更稳定的问答体验</div>
          <div className="flex-shrink-0 flex items-center gap-1">
            <Button size="sm" variant="secondary" className="h-7 px-2" onClick={handleQuickIndex} disabled={indexing}>
              {indexing ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Database className="w-3.5 h-3.5"/>}
              <span className="ml-1">一键索引并引用</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
} 