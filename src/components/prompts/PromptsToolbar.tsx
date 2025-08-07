'use client';

import { useState } from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, FolderOpen, LayoutGrid, List, ArrowUpDown } from "lucide-react";

export function PromptsToolbar() {
  const [selectAllChecked, setSelectAllChecked] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  // TODO: Add state/logic for selection and sorting
  const bulkActionsEnabled = selectAllChecked; // Example

  return (
    <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800">
      <div className="flex items-center gap-2">
        <div className="flex items-center">
          <Checkbox 
            id="selectAllPrompts"
            className="mr-2 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            checked={selectAllChecked}
            onCheckedChange={(checked) => setSelectAllChecked(!!checked)}
          />
          <label htmlFor="selectAllPrompts" className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer">全选</label>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className={`px-2 py-1 flex items-center gap-1 text-sm ${bulkActionsEnabled ? "text-gray-600 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-500" : "text-gray-400 dark:text-gray-500 cursor-not-allowed"}`}
          disabled={!bulkActionsEnabled}
        >
          <Trash2 className="h-3.5 w-3.5" /> 删除
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          className={`px-2 py-1 flex items-center gap-1 text-sm ${bulkActionsEnabled ? "text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary" : "text-gray-400 dark:text-gray-500 cursor-not-allowed"}`}
          disabled={!bulkActionsEnabled}
        >
          <FolderOpen className="h-3.5 w-3.5" /> 移动到
        </Button>
      </div>
      
      <div className="flex items-center gap-3">
        {/* View Mode Toggle */}
        <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-none ${viewMode === 'grid' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-none ${viewMode === 'list' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
        {/* Sort Select */}
        <div className="flex items-center gap-1 text-sm">
          <span className="text-gray-600 dark:text-gray-400">排序:</span>
          <Select defaultValue="recent">
            <SelectTrigger className="h-8 w-[120px] text-xs border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800">
              <SelectValue placeholder="选择排序" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent" className="text-xs">最近更新</SelectItem>
              <SelectItem value="frequency" className="text-xs">使用频率</SelectItem>
              <SelectItem value="name" className="text-xs">名称</SelectItem>
              <SelectItem value="created" className="text-xs">创建时间</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
} 