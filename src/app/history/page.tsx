'use client'; // Mark as client component if state/interactions are needed

import React from 'react';
import HistoryStats from '@/components/history/HistoryStats';
import HistoryToolbar from '@/components/history/HistoryToolbar';
import HistoryQuickFilter from '@/components/history/HistoryQuickFilter';
import HistoryList from '@/components/history/HistoryList';
import { useHistoryStore } from '@/store/historyStore';

export default function HistoryPage() {
  const { showStats } = useHistoryStore();

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* 顶部栏已移除以简化界面 */}
      
      {/* 统计信息抽屉 - 使用max-height过渡 */}
      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
        showStats ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
      }`}>
        <HistoryStats />
      </div>
      
      {/* 简化的工具栏 - 仅包含搜索、排序、视图控制 */}
      <HistoryToolbar />
      
      {/* 快速筛选栏 - 主要的筛选功能 */}
      <HistoryQuickFilter />
      
      {/* 对话列表 - 可滚动区域，自动调整剩余空间 */}
      <div className="flex-1 min-h-0">
        <HistoryList />
      </div>
    </div>
  );
} 