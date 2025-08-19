'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Edit } from 'lucide-react';
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
}: PromptCardProps) {

  return (
    <div className="prompt-card bg-white/90 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800 rounded-xl shadow-xs hover:shadow-sm transition-all duration-200 hover:-translate-y-0.5 flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-gray-800/80">
        <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate pr-2" title={title}>{title}</h3>
        <div className="flex items-center gap-1.5">
          <Button variant="soft" size="sm" className="h-8 px-3" onClick={() => onApply(id)}>应用</Button>
          <Button variant="ghost" size="icon" className={cn("h-8 w-8", isFavorite ? "text-yellow-500" : "text-gray-400 hover:text-yellow-500")} onClick={() => onToggleFavorite(id)}>
            <Star className={cn("h-4 w-4", isFavorite && "fill-current")} />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-600" onClick={()=>onEdit(id)}>
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="p-3 flex flex-col flex-grow">
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-3 line-clamp-2 flex-shrink-0">{description}</p>
        {/* 内容区域更简洁、柔和 */}
        <div className="p-3 text-sm text-gray-700 dark:text-gray-300 rounded-lg bg-slate-50/70 dark:bg-gray-800/40 ring-1 ring-gray-200/70 dark:ring-gray-700/60 mb-3 overflow-y-auto custom-scrollbar flex-grow max-h-28">
          <pre className="whitespace-pre-wrap break-words text-xs font-mono">{content}</pre>
        </div>
        <div className="flex items-center justify-between mt-auto">
          <div className="flex flex-wrap gap-1">
            {shortcuts && shortcuts.length > 0 && shortcuts.map((s) => (
              <Badge
                key={s}
                variant="secondary"
                className="px-2.5 py-1 rounded-lg text-xs font-normal cursor-default bg-indigo-50/80 text-indigo-600 border border-indigo-200"
                title={`/${s}`}
              >
                /{s}
              </Badge>
            ))}
            {tags.map((tag, index) => (
              <Badge key={index} variant="secondary" className="tag px-2.5 py-1 rounded-lg text-xs font-normal cursor-default bg-slate-50 text-slate-600 border border-slate-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700">
                {tag}
              </Badge>
            ))}
          </div>
          <div className="flex gap-3 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
            <span>使用 {usageCount} 次</span>
            <span>{lastUpdated}</span>
          </div>
        </div>
      </div>
    </div>
  );
} 