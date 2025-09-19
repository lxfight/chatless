'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Filter, Star, SortAsc, X } from "lucide-react";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { PromptEditorDialog } from "./PromptEditorDialog";
import { useState, useMemo } from "react";
import { usePromptStore } from "@/store/promptStore";
import { PromptImportExport } from "./PromptImportExport";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function PromptsHeader() {
  const [open, setOpen] = useState(false);
  const createPrompt = usePromptStore((s) => s.createPrompt);
  const prompts = usePromptStore((s) => s.prompts);
  const ui = usePromptStore((s)=>s.ui);
  const setSearchQuery = usePromptStore((s)=>s.setSearchQuery);
  const setFavoriteOnly = usePromptStore((s)=>s.setFavoriteOnly);
  const setTagFilter = usePromptStore((s)=>s.setTagFilter);
  const setSortBy = usePromptStore((s)=>s.setSortBy);

  // 从实际提示词中提取标签，并按使用频率排序，只取前5个
  const topTags = useMemo(() => {
    const tagCount: Record<string, number> = {};
    prompts.forEach(prompt => {
      (prompt.tags || []).forEach(tag => {
        tagCount[tag] = (tagCount[tag] || 0) + 1;
      });
    });
    
    return Object.entries(tagCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([tag, count]) => ({ tag, count }));
  }, [prompts]);

  // 预定义的常用标签选项
  const commonTags = ['写作', '编程', '翻译', '总结', '创意'];

  return (
    <div className="px-6 py-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-6xl mx-auto space-y-2">
        {/* 主要操作区域 */}
        <div className="flex items-center justify-between gap-4">
          {/* 左侧：搜索和筛选 */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* 搜索框 */}
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
              <Input 
                type="text" 
                placeholder="搜索提示词..." 
                value={ui?.searchQuery || ''}
                onChange={(e)=>setSearchQuery(e.target.value)}
                className="pl-10 pr-3 py-1.5 text-[13px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg w-full focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:ring-offset-0 transition-all duration-200"
              />
            </div>

            {/* 标签筛选器 - 使用下拉菜单 */}
            <div className="relative">
              <Select value={ui?.tagFilter || '__all__'} onValueChange={(v)=>setTagFilter(v === '__all__' ? null : v)}>
                <SelectTrigger className="h-8 px-3 text-[13px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:ring-offset-0 transition-all duration-200 min-w-[9rem]">
                  <Filter className="w-4 h-4 mr-2 text-gray-500" />
                  <SelectValue placeholder="选择标签" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="__all__">全部标签</SelectItem>
                  {commonTags.map((tag) => (
                    <SelectItem key={tag} value={tag} className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{tag}</Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 收藏筛选器 */}
            <button
              onClick={()=>setFavoriteOnly(!ui?.favoriteOnly)}
              className={cn(
                "h-8 px-2.5 rounded-lg border flex items-center gap-1.5 text-[13px]",
                ui?.favoriteOnly ? "bg-yellow-50 text-yellow-700 border-yellow-200" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700"
              )}
            >
              <Star className={cn("w-4 h-4", ui?.favoriteOnly && "fill-current text-yellow-600")}/>
              <span className="">{ui?.favoriteOnly ? '收藏中' : '只看收藏'}</span>
            </button>
          </div>

          {/* 右侧：新建按钮 */}
          <button
            onClick={() => setOpen(true)}
            className="h-8 px-3 rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 flex items-center gap-2 text-[13px]"
          >
            <Plus className="w-4 h-4" />
            <span className="">新建提示词</span>
          </button>
        </div>

        {/* 次要操作区域和常用标签 */}
        <div className="flex items-center justify-between gap-4">
          {/* 左侧：导入导出 */}
          <PromptImportExport />
          
          {/* 中间：常用标签 */}
          {topTags.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">常用标签：</span>
              <div className="flex gap-2">
                {topTags.map(({ tag, count }) => (
                  <Badge
                    key={tag}
                    variant={ui?.tagFilter === tag ? "default" : "secondary"}
                    className={cn(
                      "cursor-pointer transition-all duration-200",
                      ui?.tagFilter === tag 
                        ? "bg-blue-500/20 text-blue-700" 
                        : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    )}
                    onClick={() => setTagFilter(ui?.tagFilter === tag ? null : tag)}
                  >
                    {tag} ({count})
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {/* 右侧：排序 */}
          <div className="flex items-center gap-2">
            <SortAsc className="w-4 h-4 text-gray-400" />
            <Select value={ui?.sortBy || 'recent'} onValueChange={(v)=>setSortBy(v as any)}>
              <SelectTrigger className="h-8 px-3 text-[13px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:ring-offset-0 transition-all duration-200">
                <SelectValue placeholder="排序方式" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">按最近更新</SelectItem>
                <SelectItem value="created">按创建时间</SelectItem>
                <SelectItem value="frequency">按使用次数</SelectItem>
                <SelectItem value="name">按名称</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 当前筛选状态显示 */}
        {(ui?.tagFilter || ui?.favoriteOnly || ui?.searchQuery) && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-sm text-gray-500">当前筛选：</span>
            {ui?.tagFilter && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                标签: {ui.tagFilter}
                <button
                  onClick={() => setTagFilter(null)}
                  className="ml-1 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}
            {ui?.favoriteOnly && (
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
                只看收藏
                <button
                  onClick={() => setFavoriteOnly(false)}
                  className="ml-1 hover:bg-yellow-200 dark:hover:bg-yellow-800 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}
            {ui?.searchQuery && (
              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                搜索: {ui.searchQuery}
                <button
                  onClick={() => setSearchQuery('')}
                  className="ml-1 hover:bg-green-200 dark:hover:bg-green-800 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700"
              onClick={() => {
                setSearchQuery('');
                setFavoriteOnly(false);
                setTagFilter(null);
              }}
            >
              清除全部
            </Button>
          </div>
        )}
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