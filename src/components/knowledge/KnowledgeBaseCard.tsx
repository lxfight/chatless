import { BrainCircuit, FileText, Clock, MoreVertical, Edit, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ContextMenu } from '@/components/ui/context-menu';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import type { KnowledgeBase } from '@/lib/knowledgeService';
import { createKnowledgeMenuItems } from './knowledgeMenu';
import { SectionCard } from '@/components/ui/section-card';

interface KnowledgeBaseCardProps {
  kb: KnowledgeBase & { documentCount?: number };
  onClick: (id: string) => void;
  onRename?: (kb: KnowledgeBase) => void;
  onEditDesc?: (kb: KnowledgeBase) => void;
  onDelete?: (kb: KnowledgeBase) => void;
}

export function KnowledgeBaseCard({ kb, onClick, onRename, onEditDesc, onDelete }: KnowledgeBaseCardProps) {
  const desc = (kb.description || '').replace(/(\\n|\\r|\\t)/g, ' ').replace(/(\r?\n|\r)/g, ' ').trim();

  const menuItems = createKnowledgeMenuItems(kb, { onRename, onEditDesc, onDelete });

  const handleCardClick = () => {
    onClick(kb.id);
  };

  const handleMenuClick = (e: React.MouseEvent, action?: () => void) => {
    e.stopPropagation(); // 防止触发卡片点击
    action?.();
  };

  return (
    <ContextMenu menuItems={menuItems}>
      <div className="relative group">
        <SectionCard
          onClick={handleCardClick}
          className="flex flex-col p-5 min-h-36 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 bg-white/95 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200/60 dark:border-gray-800/50 hover:border-blue-300/60 dark:hover:border-blue-600/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/30 flex items-center justify-center shadow-sm">
              <BrainCircuit className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="truncate font-semibold text-sm flex-1 pr-8 text-gray-900 dark:text-gray-100">{kb.name}</p>
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{desc || '暂无描述'}</p>

          <div className="mt-auto pt-4 flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 font-mono">
            <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-gradient-to-r from-gray-100 to-slate-100 dark:from-gray-800 dark:to-slate-800 border border-gray-200/50 dark:border-gray-700/50">
              <FileText className="h-3 w-3" />
              {kb.documentCount ?? 0} 文档
            </span>
            <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-gradient-to-r from-gray-100 to-slate-100 dark:from-gray-800 dark:to-slate-800 border border-gray-200/50 dark:border-gray-700/50">
              <Clock className="h-3 w-3" />
              {new Date(kb.updatedAt).toLocaleDateString('zh-CN')}
            </span>
          </div>
        </SectionCard>

        {/* 三个点菜单 - 右上角 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-200 rounded-lg shadow-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem 
              onClick={(e) => handleMenuClick(e, () => onRename?.(kb))}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Edit className="w-3.5 h-3.5" />
              重命名
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={(e) => handleMenuClick(e, () => onEditDesc?.(kb) ?? onRename?.(kb))}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Edit className="w-3.5 h-3.5" />
              修改描述
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={(e) => handleMenuClick(e, () => onDelete?.(kb))}
              className="flex items-center gap-2 cursor-pointer text-red-600 dark:text-red-400"
            >
              <Trash2 className="w-3.5 h-3.5" />
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </ContextMenu>
  );
} 