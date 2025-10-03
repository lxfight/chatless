"use client";

import React, { useState, useEffect } from 'react';
import { Database, X, ChevronDown, ChevronUp, FileText, Clock, Settings, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { KnowledgeService } from '@/lib/knowledgeService';
import type { KnowledgeBase } from '@/lib/knowledgeService';
import { useRouter } from 'next/navigation';

interface SelectedKnowledgeBaseViewProps {
  knowledgeBase: KnowledgeBase;
  onRemove: () => void;
  className?: string;
}

interface DocumentInfo {
  document_id: string;
  name: string;
  file_path: string;
  created_at: string;
  status: 'pending' | 'indexing' | 'indexed' | 'failed';
}

const getKnowledgeBaseIcon = (iconName?: string) => {
  // Simple mapping for now. Can be expanded.
  // For now, we always return the Database icon.
  return Database;
};

const formatTimeAgo = (timestamp: string): string => {
  const now = Date.now();
  const time = new Date(timestamp).getTime();
  const diff = now - time;
  
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days > 0) return `${days}天前`;
  if (hours > 0) return `${hours}小时前`;
  if (minutes > 0) return `${minutes}分钟前`;
  return '刚刚';
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'indexed': return '已索引';
    case 'indexing': return '索引中';
    case 'pending': return '待处理';
    case 'failed': return '失败';
    default: return '未知';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'indexed': return 'text-emerald-700 dark:text-emerald-300 bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-900/40 dark:to-teal-900/30 border border-emerald-200/50 dark:border-emerald-700/40';
    case 'indexing': return 'text-amber-700 dark:text-amber-300 bg-gradient-to-r from-amber-100 to-yellow-100 dark:from-amber-900/40 dark:to-yellow-900/30 border border-amber-200/50 dark:border-amber-700/40';
    case 'pending': return 'text-gray-700 dark:text-gray-300 bg-gradient-to-r from-gray-100 to-slate-100 dark:from-gray-800/40 dark:to-slate-800/30 border border-gray-200/50 dark:border-gray-700/40';
    case 'failed': return 'text-red-700 dark:text-red-300 bg-gradient-to-r from-red-100 to-rose-100 dark:from-red-900/40 dark:to-rose-900/30 border border-red-200/50 dark:border-red-700/40';
    default: return 'text-gray-700 dark:text-gray-300 bg-gradient-to-r from-gray-100 to-slate-100 dark:from-gray-800/40 dark:to-slate-800/30 border border-gray-200/50 dark:border-gray-700/40';
  }
};

export function SelectedKnowledgeBaseView({ knowledgeBase, onRemove, className }: SelectedKnowledgeBaseViewProps) {
  const IconComponent = getKnowledgeBaseIcon(knowledgeBase.icon);
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [documentCount, setDocumentCount] = useState<number>(0);
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [loading, setLoading] = useState(false);

  // 获取文档数量
  useEffect(() => {
    const loadDocumentCount = async () => {
      try {
        const stats = await KnowledgeService.getKnowledgeBaseStats(knowledgeBase.id);
        setDocumentCount(stats.documentCount);
      } catch (error) {
        console.error('获取文档数量失败:', error);
        setDocumentCount(0);
      }
    };

    loadDocumentCount();
  }, [knowledgeBase.id]);

  // 点击文档数量展开/收起文档列表
  const handleToggleDocuments = async () => {
    if (!isExpanded && documents.length === 0) {
      setLoading(true);
      try {
        const docList = await KnowledgeService.getDocumentsInKnowledgeBase(knowledgeBase.id);
        const formattedDocs: DocumentInfo[] = docList.map((item: any) => ({
          document_id: item.document.id,
          name: item.document.name || '未命名文档',
          file_path: item.document.file_path || '',
          created_at: item.mapping.created_at,
          status: item.mapping.status || 'indexed'
        }));
        setDocuments(formattedDocs);
      } catch (error) {
        console.error('获取文档列表失败:', error);
      } finally {
        setLoading(false);
      }
    }
    setIsExpanded(!isExpanded);
  };

  // 跳转到知识库详情页面
  const handleGoToKnowledgeBase = () => {
    router.push(`/knowledge/detail?id=${knowledgeBase.id}`);
  };

  return (
    <div className={cn(
      "relative w-full max-w-full overflow-hidden rounded-xl border border-indigo-200/60 dark:border-indigo-700/50 bg-gradient-to-br from-indigo-50/80 via-purple-50/60 to-indigo-50/80 dark:from-indigo-900/30 dark:via-purple-900/25 dark:to-indigo-900/30 backdrop-blur-sm shadow-md",
      className
    )}>
      <div className="flex items-start gap-3 p-3">
        {/* 知识库图标 */}
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-800/60 dark:to-purple-800/50 flex items-center justify-center shadow-sm">
          <IconComponent className="w-4 h-4 text-indigo-700 dark:text-indigo-300" />
        </div>
        
        {/* 知识库信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700 dark:from-indigo-800/60 dark:to-purple-800/50 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-700/50">🧠 已附加</span>
            {/* 文档数量：可点击展开 */}
            <button
              onClick={handleToggleDocuments}
              className="text-xs text-gray-500 dark:text-gray-400 font-mono hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200 flex items-center gap-1 rounded-lg px-1.5 py-0.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
              title="点击查看文档列表"
            >
              {documentCount}个文档 {isExpanded ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>}
            </button>
          </div>

          <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-tight truncate mb-1 max-w-full" title={knowledgeBase.name}>
            <span className="block truncate">{knowledgeBase.name}</span>
          </h4>
        </div>

        {/* 按钮组 */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleGoToKnowledgeBase}
            className="h-7 px-2 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100/80 dark:hover:bg-indigo-800/40 rounded-lg transition-all duration-200"
            title="打开知识库详情页面"
          >
            <Settings className="w-3 h-3 mr-1" />
            管理
          </Button>
          
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRemove}
            className="rounded-lg bg-white/90 dark:bg-gray-800/80 shadow-sm border border-gray-200/60 dark:border-gray-600/50 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/40 hover:border-red-300 dark:hover:border-red-700 transition-all duration-200"
            title="移除知识库"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* 展开的文档列表 */}
      {isExpanded && (
        <div className="mt-0 px-3 pb-3">
          <div className="pt-3 border-t border-indigo-200/50 dark:border-indigo-700/30">
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300">文档列表</h5>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGoToKnowledgeBase}
                className="h-6 px-2 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100/80 dark:hover:bg-indigo-800/40 rounded-lg"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                详情页
              </Button>
            </div>
            
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <div className="text-xs text-gray-500 dark:text-gray-400">加载中...</div>
              </div>
            ) : documents.length > 0 ? (
              <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                {documents.map((doc) => (
                  <div key={doc.document_id} className="flex items-center gap-2.5 p-2.5 bg-white/80 dark:bg-gray-800/60 rounded-lg border border-indigo-100/50 dark:border-indigo-800/40 hover:bg-white dark:hover:bg-gray-800/80 transition-all duration-200 backdrop-blur-sm">
                    <div className="w-7 h-7 rounded-md bg-gradient-to-br from-gray-100 to-slate-100 dark:from-gray-700/50 dark:to-slate-700/40 flex items-center justify-center shrink-0">
                      <FileText className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate" title={doc.name}>
                        {doc.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", getStatusColor(doc.status))}>
                          {getStatusText(doc.status)}
                        </span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {formatTimeAgo(doc.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">
                暂无文档
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 