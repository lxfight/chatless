'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bookmark, Search, FileUp, FileDown, Plus } from "lucide-react";

export function PromptsHeader() {
  // TODO: Add handlers for search, import, export, new
  return (
    <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-gray-800 dark:to-gray-900">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white flex items-center justify-center shadow-md">
            <Bookmark className="w-5 h-5" />
          </div>
          <span className="font-semibold text-lg text-gray-800 dark:text-gray-200">提示词库</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
            <Input 
              type="text" 
              placeholder="搜索提示词..." 
              className="pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg w-64 focus-visible:ring-primary focus-visible:ring-offset-0 focus-visible:ring-2 h-9"
            />
            {/* TODO: Add search suggestions dropdown */}
          </div>
          <Button variant="outline" size="sm" className="h-9 flex items-center gap-1 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300">
            <FileUp className="h-4 w-4" /> 导入
          </Button>
          <Button variant="outline" size="sm" className="h-9 flex items-center gap-1 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300">
            <FileDown className="h-4 w-4" /> 导出
          </Button>
          <Button size="sm" className="h-9 flex items-center gap-1 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white">
            <Plus className="h-4 w-4" /> 新建提示词
          </Button>
        </div>
      </div>
    </div>
  );
} 