'use client';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { FileText, FileJson, FileCode, Database, Trash2, Clock, HardDrive, Layers, Info, Eye, MoreVertical } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { ResourceDocument } from './types';
import { useState } from 'react';
import { SectionCard } from '@/components/ui/section-card';

// 根据扩展名返回简洁图标
const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'json':
      return <FileJson className="h-5 w-5 text-slate-500 dark:text-slate-400" />;
    case 'md':
    case 'markdown':
    case 'txt':
      return <FileCode className="h-5 w-5 text-slate-500 dark:text-slate-400" />;
    default:
      return <FileText className="h-5 w-5 text-slate-500 dark:text-slate-400" />;
  }
};

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

// 扩展资源项目属性接口
interface ExtendedResourceItemProps extends ResourceDocument {
  onView?: (id: string) => void;
  onAddToKnowledgeBase?: (id: string) => void;
  onDelete?: (id: string) => void;
  onAddNote?: (id: string) => void;
  onComment?: (id: string) => void;
  hideIndexedStatus?: boolean; // 新增：是否隐藏"已入库"状态
}

export function ResourceItem({
  id,
  title,
  filePath,
  fileSize,
  createdAt,
  onView,
  onAddToKnowledgeBase,
  onDelete,
  isIndexed,
  chunkCount,
  knowledgeBases = [],
  hideIndexedStatus = false, // 新增参数，默认为false
  source,
  conversationId,
}: ExtendedResourceItemProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  
  // 检查是否为聊天文件 - 修复检测逻辑
  const isChatFile = source === 'chat';

  // 处理跳转到对话的功能
  const handleJumpToConversation = async () => {
    if (conversationId) {
      try {
        const { useChatStore } = await import('@/store/chatStore');
        const { setCurrentConversation } = useChatStore.getState();
        setCurrentConversation(conversationId);
        // 使用window.location进行跳转，确保状态已设置
        window.location.href = '/chat';
      } catch (error) {
        console.error('跳转到对话失败:', error);
        // 备用方案：使用URL参数跳转
        window.location.href = `/chat?conversationId=${conversationId}`;
      }
    }
  };

  return (
    <TooltipProvider delayDuration={100}>
      <SectionCard
        onClick={() => {}}
        hoverable
        className="flex items-center gap-3 p-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-600">
        {/* 文件图标 */}
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-700 flex-shrink-0">
          {getFileIcon(title)}
        </div>

        {/* 文件信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
          <p className="truncate font-medium text-sm text-gray-900 dark:text-gray-100">
            {title}
            </p>
            {isChatFile && (
              <span className="rounded px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-800/60 dark:text-blue-300">
                💬 聊天文件
              </span>
            )}
            {/* 显示知识库标签 - 移除对聊天文件的限制 */}
            {!hideIndexedStatus && knowledgeBases && knowledgeBases.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {knowledgeBases.map((kb, index) => (
                  <span 
                    key={`${kb.id}-${index}`} 
                    className={`rounded px-1.5 py-0.5 text-xs ${
                      kb.status === 'indexed' 
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-800/60 dark:text-emerald-300'
                        : kb.status === 'pending' || kb.status === 'indexing'
                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-800/60 dark:text-yellow-300'
                        : 'bg-red-100 text-red-700 dark:bg-red-800/60 dark:text-red-300'
                    }`}
                    title={`状态: ${kb.status === 'indexed' ? '已索引' : kb.status === 'pending' ? '待处理' : kb.status === 'indexing' ? '处理中' : '失败'}`}
                  >
                    {kb.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <HardDrive className="h-3 w-3" />
              {formatFileSize(fileSize)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(createdAt).toLocaleDateString('zh-CN')}
            </span>
            {/* 只有非聊天文件才显示分片信息 */}
            {!isChatFile && typeof chunkCount === 'number' && (
              <span className="flex items-center gap-1">
                <Layers className="h-3 w-3" />
                {chunkCount} 个分片
              </span>
            )}
            {/* 聊天文件显示可点击的"来自对话" */}
            {isChatFile && conversationId && (
              <span 
                className="flex items-center gap-1 text-blue-500 dark:text-blue-400 cursor-pointer hover:text-blue-600 dark:hover:text-blue-300 hover:underline"
                onClick={handleJumpToConversation}
                title="点击跳转到对话"
              >
                💬 来自对话
              </span>
            )}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-1">
          {/* 查看按钮 - 对于聊天文件显示为"跳转到对话" */}
          {onView && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onView(id)}
                  className="h-7 w-7 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isChatFile ? '跳转到对话' : '查看文档'}</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* 添加到知识库按钮 */}
          {onAddToKnowledgeBase && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onAddToKnowledgeBase(id)}
                  className="h-7 w-7"
                >
                  <Database className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{knowledgeBases && knowledgeBases.length > 0 ? '添加到其他知识库' : '添加到知识库'}</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* 更多操作菜单 - 聊天文件显示"移除"而不是"删除" */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 focus:outline-none focus:ring-0 focus:ring-offset-0"
              >
                <MoreVertical className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => setDetailOpen(true)} className="cursor-pointer">
                <Info className="h-4 w-4 mr-2" />
                查看详情
              </DropdownMenuItem>
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => onDelete(id)} 
                    className="cursor-pointer"
                    variant="destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {isChatFile ? '移除文件' : '删除文件'}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SectionCard>

      {/* 详情对话框 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg dark:bg-slate-900 dark:border-slate-600">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold truncate pr-8 text-gray-900 dark:text-gray-100">{title}</DialogTitle>
          </DialogHeader>
          <div className="text-sm space-y-4 max-h-96 overflow-y-auto text-gray-700 dark:text-gray-300">
            <div className="space-y-2">
              <p><strong>文件大小:</strong> {formatFileSize(fileSize)}</p>
              <p><strong>创建时间:</strong> {new Date(createdAt).toLocaleString('zh-CN')}</p>
              {typeof chunkCount === 'number' && <p><strong>分片数量:</strong> {chunkCount} 个</p>}
            </div>
            
            {!hideIndexedStatus && knowledgeBases && knowledgeBases.length > 0 && (
              <div>
                <p className="font-medium mb-3">关联的知识库:</p>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {knowledgeBases.map((kb, index) => (
                    <div key={`${kb.id}-${index}`} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm">
                      <span className="truncate mr-2">{kb.name}</span>
                      <span className={`text-xs px-2 py-1 rounded flex-shrink-0 ${
                        kb.status === 'indexed' 
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-800/60 dark:text-emerald-300'
                          : kb.status === 'pending' || kb.status === 'indexing'
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-800/60 dark:text-yellow-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-800/60 dark:text-red-300'
                      }`}>
                        {kb.status === 'indexed' ? '已索引' : kb.status === 'pending' ? '待处理' : kb.status === 'indexing' ? '处理中' : '失败'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {!hideIndexedStatus && (!knowledgeBases || knowledgeBases.length === 0) && (
              <div className="text-center py-4">
                <p className="text-gray-500 dark:text-gray-400">尚未添加到任何知识库</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
} 