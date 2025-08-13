'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bookmark, Search, Plus } from "lucide-react";
import { PromptEditorDialog } from "./PromptEditorDialog";
import { useState } from "react";
import { usePromptStore } from "@/store/promptStore";
import { PromptImportExport } from "./PromptImportExport";
import { cn } from "@/lib/utils";

export function PromptsHeader() {
  const [open, setOpen] = useState(false);
  const createPrompt = usePromptStore((s) => s.createPrompt);
  const ui = usePromptStore((s)=>s.ui);
  const setSearchQuery = usePromptStore((s)=>s.setSearchQuery);
  const setFavoriteOnly = usePromptStore((s)=>s.setFavoriteOnly);
  const setTagFilter = usePromptStore((s)=>s.setTagFilter);
  return (
    <div className="px-4 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white flex items-center justify-center shadow-md">
            <Bookmark className="w-5 h-5" />
          </div>
          <span className="font-semibold text-base text-gray-800 dark:text-gray-200">提示词库</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
            <Input 
              type="text" 
              placeholder="搜索提示词..." 
              value={ui?.searchQuery || ''}
              onChange={(e)=>setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg w-64 focus-visible:ring-primary focus-visible:ring-offset-0 focus-visible:ring-2 h-8"
            />
            {/* TODO: Add search suggestions dropdown */}
          </div>
          <div className="hidden md:flex items-center gap-1">
            {['写作','编程','翻译'].map((t) => (
              <button key={t} className={cn('px-2 py-1 rounded-md text-xs border', ui?.tagFilter===t ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50')} onClick={()=>setTagFilter(ui?.tagFilter===t?null:t)}>{t}</button>
            ))}
          </div>
          <button className={cn('text-xs px-2 py-1 rounded-md border', ui?.favoriteOnly ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'text-gray-500 border-gray-200 hover:bg-gray-50')} onClick={()=>setFavoriteOnly(!ui?.favoriteOnly)}>只看收藏</button>
          <PromptImportExport />
          <Button size="sm" className="h-8 flex items-center gap-1 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> 新建提示词
          </Button>
        </div>
      </div>
      <PromptEditorDialog
        open={open}
        onOpenChange={setOpen}
        initial={null}
        onSubmit={(data) => {
          createPrompt(data);
        }}
      />
    </div>
  );
} 