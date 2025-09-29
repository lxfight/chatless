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
    case 'indexed': return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-800/30';
    case 'indexing': return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-800/30';
    case 'pending': return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/30';
    case 'failed': return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-800/30';
    default: return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/30';
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
      // 与 AttachedDocumentView 统一的卡片基线：尺寸、圆角、边框、阴影、模糊；仅配色不同
      "w-full max-w-full overflow-hidden rounded-xl border backdrop-blur-[2px] shadow-sm p-4 \
       border-indigo-200/70 dark:border-indigo-700/40 bg-gradient-to-r from-indigo-50/70 to-purple-50/70 \
       dark:from-indigo-900/25 dark:to-purple-900/25",
      className
    )}>
      {/* X按钮 - 右上角 */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-white/80 dark:bg-gray-800/70 shadow-sm border border-gray-200/70 dark:border-gray-600/60 text-gray-400 hover:text-red-500 hover:bg-red-50/80 dark:hover:bg-red-900/30 transition-all duration-200 z-10"
        title="移除知识库"
      >
        <X className="w-3 h-3" />
      </Button>

      <div className="flex items-start gap-3 pr-1 min-w-0">
        {/* 知识库图标 */}
        <div className="flex-shrink-0 w-7 h-7 rounded-md bg-indigo-100 dark:bg-indigo-800/50 flex items-center justify-center">
          <IconComponent className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-300" />
        </div>
        
        {/* 知识库信息 */}
        <div className="flex-1 min-w-0">
          {/* 与文档卡片统一：左侧标签 + 次要信息 */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-800/40 dark:text-indigo-300">🧠 已附加</span>
            {/* 文档数量：可点击展开 */}
            <button
              onClick={handleToggleDocuments}
              className="text-xs text-gray-500 dark:text-gray-400 font-mono hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer flex items-center gap-1"
              title="点击查看文档列表"
            >
              {documentCount}个文档 {isExpanded ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>}
            </button>
          </div>

          <h4 className="font-medium text-gray-800 dark:text-gray-200 text-[13px] leading-tight truncate mb-0.5 max-w-full" title={knowledgeBase.name}>
            <span className="block truncate">{knowledgeBase.name}</span>
          </h4>
        </div>

        {/* 管理按钮：与文档卡片的删除按钮尺寸一致的紧凑风格 */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleGoToKnowledgeBase}
          className="mt-0.5 h-6 px-2 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-800/30"
          title="打开知识库详情页面"
        >
          <Settings className="w-3 h-3 mr-1" />
          管理
        </Button>
      </div>

      {/* 展开的文档列表 */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-indigo-200/50 dark:border-indigo-700/30">
          <div className="flex items-center justify-between mb-2">
            <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300">文档列表</h5>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGoToKnowledgeBase}
              className="h-5 px-2 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-800/30"
            >
              <ExternalLink className="w-2.5 h-2.5 mr-1" />
              详情页
            </Button>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center py-3">
              <div className="text-xs text-gray-500 dark:text-gray-400">加载中...</div>
            </div>
          ) : documents.length > 0 ? (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {documents.map((doc) => (
                <div key={doc.document_id} className="flex items-center gap-2 p-2 bg-white/50 dark:bg-gray-800/50 rounded-md">
                  <FileText className="w-3 h-3 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate" title={doc.name}>
                      {doc.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn("text-xs px-1.5 py-0.5 rounded-full", getStatusColor(doc.status))}>
                        {getStatusText(doc.status)}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {formatTimeAgo(doc.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-3">
              暂无文档
            </div>
          )}
        </div>
      )}
    </div>
  );
} 