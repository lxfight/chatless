'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Edit, MoreVertical, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from "@/lib/utils";

export interface Prompt {
  id: string;
  title: string;
  description: string;
  content: string;
  tags: string[];
  shortcuts?: string[];
  usageCount: number;
  lastUpdated: string; // e.g., "2小时前更新"
  isFavorite: boolean;
}

interface PromptCardProps extends Prompt {
  onToggleFavorite?: (id: string) => void;
  onApply?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function PromptCard({
  id,
  title,
  description,
  content,
  tags,
  shortcuts = [],
  usageCount,
  lastUpdated,
  isFavorite,
  onToggleFavorite = () => {},
  onApply = () => {},
  onEdit = () => {},
  onDelete = () => {},
}: PromptCardProps) {

  return (
    <div className="prompt-card bg-white/95 dark:bg-gray-900/70 border border-gray-200/70 dark:border-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col">
      {/* 头部 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800/80">
        <h3 className="font-medium text-[14px] text-gray-900 dark:text-gray-100 truncate pr-2" title={title}>{title}</h3>
        <div className="flex items-center gap-1.5">
          <button className="h-7 px-2.5 rounded-md border text-[13px] leading-7 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => onApply(id)}>应用</button>
          <button aria-label="收藏" className={cn("h-8 w-8 rounded-md flex items-center justify-center", isFavorite ? "text-yellow-500" : "text-gray-400 hover:text-yellow-500")} onClick={() => onToggleFavorite(id)}>
            <Star className={cn("h-4 w-4", isFavorite && "fill-current")} />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-8 w-8 rounded-md text-gray-400 hover:text-gray-600 flex items-center justify-center">
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-28">
              <DropdownMenuItem onClick={()=>onEdit(id)}>
                <Edit className="h-4 w-4 mr-2" /> 编辑
              </DropdownMenuItem>
              <DropdownMenuItem className="text-red-600" onClick={()=>onDelete(id)}>
                <Trash2 className="h-4 w-4 mr-2" /> 删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 主体 */}
      <div className="p-3 flex flex-col gap-2 flex-grow">
        {description ? (
          <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2">{description}</p>
        ) : null}

        {/* 内容预览：使用 line-clamp 提升空间利用 */}
        <div className="rounded-lg bg-slate-50/70 dark:bg-gray-800/40 ring-1 ring-gray-200/70 dark:ring-gray-700/60 px-3 py-2">
          <pre className="whitespace-pre-wrap break-words text-[12px] leading-5 text-gray-800 dark:text-gray-200 line-clamp-5">{content}</pre>
        </div>

        {/* 标签与快捷键 */}
        <div className="flex items-start justify-between gap-2 mt-auto">
          <div className="flex flex-wrap gap-1.5">
            {shortcuts && shortcuts.length > 0 && shortcuts.map((s) => (
              <Badge
                key={s}
                variant="secondary"
                className="px-2 py-0.5 rounded-md text-[11px] font-normal cursor-default bg-indigo-50/80 text-indigo-700 border border-indigo-200"
                title={`/${s}`}
              >
                /{s}
              </Badge>
            ))}
            {tags.map((tag, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="px-2 py-0.5 rounded-md text-[11px] font-normal cursor-default bg-slate-50 text-slate-600 border border-slate-200 dark:bg-slate-700/70 dark:text-slate-200 dark:border-slate-600/60"
              >
                {tag}
              </Badge>
            ))}
          </div>
          <div className="shrink-0 text-[11px] text-gray-500 dark:text-gray-500 leading-5 whitespace-nowrap">
            使用 {usageCount} 次 · {lastUpdated}
          </div>
        </div>
      </div>
    </div>
  );
} 