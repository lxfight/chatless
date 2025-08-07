'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Star, MoreVertical, Edit, Copy, FolderOpen, Trash2 } from 'lucide-react';
import { cn } from "@/lib/utils";

export interface Prompt {
  id: string;
  title: string;
  description: string;
  content: string;
  tags: string[];
  usageCount: number;
  lastUpdated: string; // e.g., "2小时前更新"
  isFavorite: boolean;
}

interface PromptCardProps extends Prompt {
  isSelected?: boolean;
  onSelectChange?: (id: string, selected: boolean) => void;
  onToggleFavorite?: (id: string) => void;
  onEdit?: (id: string) => void;
  onCopy?: (id: string) => void;
  onMove?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function PromptCard({
  id,
  title,
  description,
  content,
  tags,
  usageCount,
  lastUpdated,
  isFavorite,
  isSelected = false,
  onSelectChange = () => {},
  onToggleFavorite = () => {},
  onEdit = () => {},
  onCopy = () => {},
  onMove = () => {},
  onDelete = () => {},
}: PromptCardProps) {

  return (
    <div className="prompt-card bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden hover:shadow-md transition-shadow duration-200 flex flex-col h-full">
      <div className="relative flex-shrink-0">
        <div className="absolute top-3 left-3 z-10">
          <Checkbox 
            id={`select-prompt-${id}`} 
            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary" 
            checked={isSelected}
            onCheckedChange={(checked) => onSelectChange(id, !!checked)}
            aria-label={`Select prompt ${title}`}
          />
        </div>
        <div className="flex items-center justify-between p-3 pl-12 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-medium text-gray-800 dark:text-gray-200 truncate pr-2" title={title}>{title}</h3>
          <div className="flex items-center flex-shrink-0">
            <Button 
              variant="ghost" 
              size="icon" 
              className={cn(
                "action-btn p-1.5 h-7 w-7", 
                isFavorite ? "text-yellow-500 hover:text-yellow-600" : "text-gray-400 hover:text-yellow-500"
              )}
              title={isFavorite ? "取消收藏" : "收藏"}
              onClick={() => onToggleFavorite(id)}
            >
              <Star className={cn("h-4 w-4", isFavorite ? "fill-current" : "")} />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="action-btn p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 h-7 w-7 focus:outline-none focus:ring-0 focus:ring-offset-0"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => onEdit(id)}><Edit className="mr-2 h-4 w-4" /><span>编辑</span></DropdownMenuItem>
                <DropdownMenuItem onClick={() => onCopy(id)}><Copy className="mr-2 h-4 w-4" /><span>复制</span></DropdownMenuItem>
                <DropdownMenuItem onClick={() => onMove(id)}><FolderOpen className="mr-2 h-4 w-4" /><span>移动</span></DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete(id)} className="text-red-600 dark:text-red-500"><Trash2 className="mr-2 h-4 w-4" /><span>删除</span></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      <div className="p-3 flex flex-col flex-grow">
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-3 flex-shrink-0">{description}</p>
        {/* Scrollable content area */}
        <div className="bg-gray-50 dark:bg-gray-700 p-3 text-sm text-gray-700 dark:text-gray-300 rounded-lg border border-gray-200 dark:border-gray-600 mb-3 overflow-y-auto custom-scrollbar flex-grow max-h-28">
          {/* Displaying content - could add formatting/highlighting later */}
          <pre className="whitespace-pre-wrap break-words text-xs font-mono">{content}</pre>
        </div>
        <div className="flex items-center justify-between mt-auto flex-shrink-0">
          <div className="flex flex-wrap gap-1">
            {tags.map((tag, index) => (
              <Badge key={index} variant="secondary" className="tag px-2.5 py-1 rounded-lg text-xs font-normal cursor-default bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-600 dark:to-gray-700 text-gray-600 dark:text-gray-300">
                {tag}
              </Badge>
            ))}
          </div>
          <div className="flex gap-3 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 whitespace-nowrap">
            <span>使用 {usageCount} 次</span>
            <span>{lastUpdated}</span>
          </div>
        </div>
      </div>
    </div>
  );
} 