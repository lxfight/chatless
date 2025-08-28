"use client";

import { KnowledgeLayout } from "@/components/knowledge/KnowledgeLayout";
import { RecentKnowledgeList } from "@/components/knowledge/RecentKnowledgeList";
import { RAGQueryInterface } from "@/components/knowledge/RAGQueryInterface";
import { useEffect, useState, useCallback, useRef } from 'react';
import { KnowledgeService, KnowledgeBase } from "@/lib/knowledgeService";
import { UnifiedFileService } from '@/lib/unifiedFileService';
import { initializeSampleDataIfNeeded } from '@/lib/sampleDataInitializer';
import { Loader2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { KnowledgeBaseItem } from "@/components/knowledge/KnowledgeBaseItem";
import { CreateKnowledgeDialog } from '@/components/knowledge/CreateKnowledgeDialog';
import { AlertDialog, AlertDialogHeader, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { KnowledgeBaseCard } from "@/components/knowledge/KnowledgeBaseCard";
import { EditKnowledgeDialog } from '@/components/knowledge/EditKnowledgeDialog';
import { motion } from "framer-motion";
import { Database, Plus, Sparkles } from "lucide-react";

// 扩展知识库类型，添加文档数量
interface KnowledgeBaseWithCount extends KnowledgeBase {
  documentCount: number;
}

export default function KnowledgePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('my'); // 'my', 'shared', 'templates', 'query'
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'online', 'local'
  const [sortBy, setSortBy] = useState('recent'); // 'recent', 'name', 'docs'
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseWithCount[]>([]);
  const [selectedKB, setSelectedKB] = useState<KnowledgeBase | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [recentDocuments, setRecentDocuments] = useState<any[]>([]);
  const [deleteKbDialogOpen, setDeleteKbDialogOpen] = useState(false);
  const [kbToDelete, setKbToDelete] = useState<KnowledgeBase | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [kbEditing, setKbEditing] = useState<KnowledgeBase | null>(null);
  
  // 使用 ref 来防止重复初始化（防止 React Strict Mode 导致的重复调用）
  const hasInitializedRef = useRef(false);

  // 页面加载时自动加载知识库
  useEffect(() => {
    // 防止 React Strict Mode 导致的重复初始化
    if (hasInitializedRef.current) {
      console.log('⚠️ [KnowledgePage] 跳过重复初始化（React Strict Mode）');
      return;
    }

    hasInitializedRef.current = true;
    loadKnowledgeBases();
  }, []);

  const loadKnowledgeBases = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // 首先检查是否已有任何知识库或文档
      const kbs = await KnowledgeService.getAllKnowledgeBases();
      const allFiles = await UnifiedFileService.getAllFiles();
      
      // 只有当没有任何知识库和文档时才初始化示例数据
      if (kbs.length === 0 && allFiles.length === 0) {
        console.log('📋 [KnowledgePage] 检测到空数据库，开始初始化示例数据...');
        try {
          await initializeSampleDataIfNeeded((step, progress) => {
            console.log(`[示例数据初始化] ${step}: ${progress}%`);
          });
          console.log('✅ [KnowledgePage] 示例数据初始化完成');
          
          // 重新获取知识库列表（因为初始化可能创建了新的知识库）
          const updatedKbs = await KnowledgeService.getAllKnowledgeBases();
          kbs.push(...updatedKbs);
        } catch (initError) {
          console.warn('[示例数据初始化] 初始化失败，但不影响知识库加载:', initError);
          // 如果初始化失败，重置标志允许重试
          hasInitializedRef.current = false;
        }
      } else {
        console.log('📋 [KnowledgePage] 检测到已有数据，跳过示例数据初始化');
        console.log(`   - 知识库数量: ${kbs.length}`);
        console.log(`   - 文档数量: ${allFiles.length}`);
      }
      
      // 为每个知识库加载文档数量
      const kbsWithCounts: KnowledgeBaseWithCount[] = await Promise.all(
        kbs.map(async (kb) => {
          try {
            // 使用正确的方法：从数据库映射表获取文档数量
            const stats = await KnowledgeService.getKnowledgeBaseStats(kb.id);
            return { ...kb, documentCount: stats.documentCount };
          } catch (error) {
            console.warn(`获取知识库 ${kb.name} 的文档数量失败:`, error);
            return { ...kb, documentCount: 0 };
          }
        })
      );
      
      setKnowledgeBases(kbsWithCounts);
      
      // 如果当前选中的知识库被删除了，清除选择
      if (selectedKB && !kbsWithCounts.find(kb => kb.id === selectedKB.id)) {
        setSelectedKB(null);
      }
      
      // 加载最近的文档
      try {
        const files = await UnifiedFileService.getAllFiles();
        setRecentDocuments(files.slice(0, 3));
        console.log('[Knowledge] 加载到文档:', files.length, '个');
      } catch (docError) {
        console.error('[Knowledge] 加载文档失败:', docError);
        // 文档加载失败不影响知识库显示
      }
    } catch (error) {
      console.error('加载知识库失败:', error);
      setKnowledgeBases([]);
      // 如果加载失败，重置标志允许重试
      hasInitializedRef.current = false;
    } finally {
      setIsLoading(false);
    }
  }, [selectedKB]);

  // 处理知识库查看
  const handleViewKnowledgeBase = (id: string) => {
    console.log('查看知识库:', id);
    router.push(`/knowledge/detail?id=${id}`);
  };

  // 处理知识库使用
  const handleUseKnowledgeBase = (id: string) => {
    console.log('使用知识库:', id);
    
    toast.info('知识库启用成功', {
      description: '已在聊天中启用该知识库，现在您可以向AI提问相关内容'
    });
    
    // 跳转到聊天页面并使用该知识库
    router.push(`/chat?knowledgeBase=${id}`);
  };

  // 处理创建知识库
  const createKnowledgeBase = async (name: string, description: string) => {
    const kb = await KnowledgeService.createKnowledgeBase(name, description, 'database', false);
    setKnowledgeBases(prev => [...prev, { ...kb, documentCount: 0 }]);
    toast.success('知识库创建成功');
  };

  // 根据筛选和排序处理知识库列表
  const filteredKnowledgeBases = knowledgeBases
    .filter(kb => {
      if (activeFilter === 'all') return true;
      // 暂时所有知识库都是本地的
      return activeFilter === 'local';
    })
    .sort((a, b) => {
      if (sortBy === 'recent') {
        return b.updatedAt - a.updatedAt;
      } else if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'docs') {
        return b.documentCount - a.documentCount;
      }
      return 0;
    });

  // 获取最近使用的知识库
  const recentKnowledgeBases = filteredKnowledgeBases.slice(0, 3).map(kb => ({
    id: kb.id,
    name: kb.name,
    icon: kb.icon || 'database',
    iconBg: kb.icon === 'folder' ? 'from-blue-400 to-blue-600' : 
            kb.icon === 'book' ? 'from-green-400 to-green-600' : 
            kb.icon === 'code' ? 'from-purple-400 to-purple-600' : 
            'from-gray-400 to-gray-600',
    source: '本地',
    docCount: kb.documentCount,
    description: kb.description || '',
    lastUpdated: new Date(kb.updatedAt).toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    }),
    isEncrypted: kb.isEncrypted
  }));

  // add handler functions
  const handleDeleteKnowledgeBase = (kb: KnowledgeBase) => {
    setKbToDelete(kb);
    setDeleteKbDialogOpen(true);
  };

  const confirmDeleteKb = async () => {
    if (!kbToDelete) return;
    try {
      await KnowledgeService.deleteKnowledgeBase(kbToDelete.id);
      setKnowledgeBases(prev => prev.filter(item => item.id !== kbToDelete.id));
      toast.success('知识库已删除');
    } catch (e) {
      console.error(e);
      toast.error('删除失败');
    } finally {
      setDeleteKbDialogOpen(false);
      setKbToDelete(null);
    }
  };

  const openEditDialog = (kb: KnowledgeBase) => { setKbEditing(kb); setEditDialogOpen(true); };

  const handleRenameKnowledgeBase = (kb: KnowledgeBase) => { openEditDialog(kb); };

  const handleSaveEditKb = async (name: string, description: string) => {
    if (!kbEditing) return;
    try {
      const updated = await KnowledgeService.updateKnowledgeBase(kbEditing.id, { name, description });
      setKnowledgeBases(prev => prev.map(item => item.id===kbEditing.id? { ...item, name: updated?.name ?? name, description: updated?.description ?? description }: item));
      toast.success('已保存');
    } catch(e){ toast.error('保存失败'); }
  };

  return (
    <KnowledgeLayout 
      activeTab={activeTab} 
      onTabChange={setActiveTab}
      activeFilter={activeFilter}
      onFilterChange={setActiveFilter}
      sortBy={sortBy}
      onSortChange={setSortBy}
      onCreateKnowledgeBase={() => setShowCreateDialog(true)}
    >
      {isLoading ? (
        <div className="flex items-center justify-center w-full py-12">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-sm text-gray-600">正在加载知识库...</p>
          </div>
        </div>
      ) : (
        <>
          {/* RAG查询界面 */}
          {activeTab === 'query' ? (
            <RAGQueryInterface />
          ) : (
            <>
              <div className="flex h-full flex-col">
                {/* 新建知识库按钮 - 移动设备上显示 */}
                <div className="md:hidden mb-4 shrink-0">
                  <Button className="w-full" onClick={() => setShowCreateDialog(true)}>
                    新建知识库
                  </Button>
                </div>

                {/* 列表主体 */}
                <div className="flex-1 overflow-auto">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {filteredKnowledgeBases.map((kb) => (
                      <KnowledgeBaseCard
                        key={kb.id}
                        kb={kb}
                        onClick={handleViewKnowledgeBase}
                        onDelete={handleDeleteKnowledgeBase}
                        onRename={handleRenameKnowledgeBase}
                        onEditDesc={openEditDialog}
                      />
                    ))}
                  </div>
                  {filteredKnowledgeBases.length === 0 && knowledgeBases.length > 0 && (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-center">
                        <div className="w-12 h-12 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center">
                          <Database className="w-6 h-6 text-gray-400 dark:text-gray-500" strokeWidth={1.5} />
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">暂无匹配的知识库</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* 底部 最近使用 */}
                {recentKnowledgeBases.length > 0 && (
                  <div className="shrink-0 pt-6">
                    <RecentKnowledgeList items={recentKnowledgeBases} onUseKnowledgeBase={handleUseKnowledgeBase} />
                  </div>
                )}

                {/* 空状态 (当完全无知识库时显示并占据中间) */}
                {knowledgeBases.length === 0 && (
                  <div className="flex flex-1 items-center justify-center py-8">
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                      className="text-center max-w-sm mx-auto"
                    >
                      {/* 图标 */}
                      <motion.div
                        initial={{ scale: 0.9 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.4, delay: 0.1 }}
                        className="mb-6"
                      >
                        <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center">
                          <Database className="w-8 h-8 text-gray-400 dark:text-gray-500" strokeWidth={1.5} />
                        </div>
                      </motion.div>

                      {/* 文字内容 */}
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.2 }}
                        className="mb-8"
                      >
                        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                          暂无知识库
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          创建您的第一个知识库来开始使用
                        </p>
                      </motion.div>

                      {/* 按钮 */}
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.3 }}
                      >
                        <Button 
                          onClick={() => setShowCreateDialog(true)}
                          className="bg-blue-500 hover:bg-blue-600 text-white shadow-sm hover:shadow-md transition-all duration-200 px-5 py-2.5 rounded-lg font-medium"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          创建知识库
                        </Button>
                      </motion.div>
                    </motion.div>
                  </div>
                )}
              </div>
            </>
          )}
          <CreateKnowledgeDialog
            open={showCreateDialog}
            onOpenChange={setShowCreateDialog}
            onCreate={createKnowledgeBase}
          />
          <AlertDialog open={deleteKbDialogOpen} onOpenChange={setDeleteKbDialogOpen}>
            <AlertDialogContent>
              {/* 右上角关闭按钮 */}
              <button
                onClick={() => setDeleteKbDialogOpen(false)}
                className="absolute top-4 right-4 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 cursor-pointer"
                aria-label="关闭"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              
              <AlertDialogHeader className="pr-8">
                <AlertDialogTitle>确认删除知识库</AlertDialogTitle>
                <AlertDialogDescription>
                  确定要删除知识库 "{kbToDelete?.name}" 吗？此操作不可撤销。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDeleteKb}>删除</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <EditKnowledgeDialog open={editDialogOpen} kb={kbEditing} onOpenChange={setEditDialogOpen} onSave={handleSaveEditKb} />
        </>
      )}
    </KnowledgeLayout>
  );
} 