"use client";

import React, { useState } from 'react';
import { FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getCurrentKnowledgeBaseConfig } from '@/lib/knowledgeBaseConfig';
import { estimateTokens } from '@/lib/utils/tokenBudget';
import { toast } from '@/components/ui/sonner';
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
    <div className={cn("w-full max-w-full overflow-hidden rounded-xl border border-emerald-200/60 dark:border-emerald-700/50 bg-gradient-to-br from-emerald-50/80 via-teal-50/60 to-emerald-50/80 dark:from-emerald-900/30 dark:via-teal-900/25 dark:to-emerald-900/30 backdrop-blur-sm shadow-md", className)}>
      <div className="flex items-start gap-3 p-3">
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-800/60 dark:to-teal-800/50 flex items-center justify-center shadow-sm">
          <FileText className="w-4 h-4 text-emerald-700 dark:text-emerald-300" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-700 dark:from-emerald-800/60 dark:to-teal-800/50 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-700/50">📎 已附加</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{formatFileSize(document.fileSize)}</span>
          </div>
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-tight truncate mb-1 max-w-full" title={document.name}>
            <span className="block truncate">{titleText}</span>
          </h4>
          {document.summary && (
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed max-w-full"><span className="block truncate">{summary}</span></p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          className="mt-0.5 rounded-lg bg-white/90 dark:bg-gray-800/80 shadow-sm border border-gray-200/60 dark:border-gray-600/50 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/40 hover:border-red-300 dark:hover:border-red-700"
          title="移除文档"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {(isBigFile || isBigToken) && (
        <div className="mt-0 px-3 pb-3">
          <div className="px-3 py-2 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50/80 dark:from-blue-900/30 dark:to-indigo-900/25 border border-blue-200/60 dark:border-blue-800/50 text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between gap-2 min-w-0 shadow-sm backdrop-blur-sm">
            <div className="flex-1 min-w-0 truncate">检测到大文档，推荐转入知识库以获得更稳定的问答体验</div>
            <div className="flex-shrink-0 flex items-center gap-1">
              <Button size="sm" variant="soft" className="h-7 px-3 text-xs" onClick={handleQuickIndex} disabled={indexing}>
                {indexing ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Database className="w-3.5 h-3.5"/>}
                <span className="ml-1">一键索引并引用</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 