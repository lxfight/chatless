"use client";

import { useState, useEffect } from 'react';
import { ResourceManager } from '@/components/resources/ResourceManager';
import { UnifiedFileService } from '@/lib/unifiedFileService';

export default function ResourcesPage() {
  const [fileCount, setFileCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // 加载文件统计
  const loadFileStatistics = async () => {
    try {
      const stats = await UnifiedFileService.getFileStatistics();
      setFileCount(stats.total);
      console.log(`页面组件成功加载文件统计: ${stats.total} 个文件`);
    } catch (error) {
      console.error('❌ 页面组件加载文件统计失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 处理资源管理器的刷新回调
  const handleResourceManagerRefresh = async () => {
    console.log('收到ResourceManager刷新通知，更新页面统计...');
    await loadFileStatistics();
  };

  useEffect(() => {
    loadFileStatistics();
  }, []);

  return (
    <div className="h-full">
      {/* 资源管理器 */}
      <ResourceManager 
        onRefresh={handleResourceManagerRefresh}
        totalFileCount={fileCount}
        isLoadingStats={isLoading}
      />
    </div>
  );
} 