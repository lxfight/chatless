'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus } from "lucide-react";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { PromptEditorDialog } from "./PromptEditorDialog";
import { useState } from "react";
import { usePromptStore } from "@/store/promptStore";
import { PromptImportExport } from "./PromptImportExport";
import { cn } from "@/lib/utils";
// import { IconButton } from "@/components/ui/icon-button";

export function PromptsHeader() {
  const [open, setOpen] = useState(false);
  const createPrompt = usePromptStore((s) => s.createPrompt);
  const ui = usePromptStore((s)=>s.ui);
  const setSearchQuery = usePromptStore((s)=>s.setSearchQuery);
  const setFavoriteOnly = usePromptStore((s)=>s.setFavoriteOnly);
  const setTagFilter = usePromptStore((s)=>s.setTagFilter);
  const setSortBy = usePromptStore((s)=>s.setSortBy);
  return (
    <div className="px-4 py-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
            <Input 
              type="text" 
              placeholder="搜索提示词..." 
              value={ui?.searchQuery || ''}
              onChange={(e)=>setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg w-72 focus-visible:ring-primary focus-visible:ring-offset-0 focus-visible:ring-2 h-8"
            />
            {/* TODO: Add search suggestions dropdown */}
          </div>
          <div className="hidden md:flex items-center gap-2">
            {['写作','编程','翻译'].map((t) => (
              <button
                key={t}
                className={cn(
                  'px-3 py-1 rounded-full text-xs border transition-colors',
                  ui?.tagFilter===t
                    ? 'bg-indigo-100/70 border-indigo-300 text-indigo-700 dark:bg-indigo-400/15 dark:border-indigo-500/40 dark:text-indigo-200'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-slate-800'
                )}
                onClick={()=>setTagFilter(ui?.tagFilter===t?null:t)}
              >{t}</button>
            ))}
          </div>
          <Button variant={ui?.favoriteOnly ? "secondary" : "outline"} size="sm" className={cn('h-8', ui?.favoriteOnly ? 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100' : '')} onClick={()=>setFavoriteOnly(!ui?.favoriteOnly)}>只看收藏</Button>
          <PromptImportExport />
          <Select value={ui?.sortBy || 'recent'} onValueChange={(v)=>setSortBy(v as any)}>
            <SelectTrigger data-size="sm"><SelectValue placeholder="排序" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">按最近更新</SelectItem>
              <SelectItem value="created">按创建时间</SelectItem>
              <SelectItem value="frequency">按使用次数</SelectItem>
              <SelectItem value="name">按名称</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="soft" size="sm" className="h-8 px-3" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4" />
          新建提示词
        </Button>
      </div>
      <PromptEditorDialog
        open={open}
        onOpenChange={setOpen}
        initial={null}
        onSubmit={(data) => {
          // 显式传递 shortcuts，避免某些情况下丢失可选字段
          createPrompt({ ...(data as any), shortcuts: (data as any).shortcuts || [] });
        }}
      />
    </div>
  );
} 