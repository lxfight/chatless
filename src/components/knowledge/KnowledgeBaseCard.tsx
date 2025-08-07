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
      <div className="relative">
        <SectionCard
          onClick={handleCardClick}
          className="flex flex-col p-4 min-h-32 transition-colors hover:bg-gray-50 dark:hover:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-600">
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 shrink-0 text-slate-500 dark:text-slate-400" />
            <p className="truncate font-medium text-sm flex-1 pr-8 text-gray-900 dark:text-gray-100">{kb.name}</p>
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{desc || '暂无描述'}</p>

          <div className="mt-4 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {kb.documentCount ?? 0} 文档
            </span>
            <span className="flex items-center gap-1">
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
              size="icon"
              className="absolute top-2 right-2 h-6 w-6 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-0 focus:ring-offset-0"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem 
              onClick={(e) => handleMenuClick(e, () => onRename?.(kb))}
              className="flex items-center gap-2 px-3 py-2 cursor-pointer"
            >
              <Edit className="w-3 h-3" />
              重命名
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={(e) => handleMenuClick(e, () => onEditDesc?.(kb) ?? onRename?.(kb))}
              className="flex items-center gap-2 px-3 py-2 cursor-pointer"
            >
              <Edit className="w-3 h-3" />
              修改描述
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={(e) => handleMenuClick(e, () => onDelete?.(kb))}
              className="flex items-center gap-2 px-3 py-2 cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
            >
              <Trash2 className="w-3 h-3" />
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </ContextMenu>
  );
} 