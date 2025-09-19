'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox as UICheckbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ResourceUploader } from './ResourceUploader';
import { ResourceList } from './ResourceList';
import { RecentlyReferenced } from './RecentlyReferenced';
import { AddToKnowledgeBase } from './AddToKnowledgeBase';
import { UnifiedFileService, type UnifiedFile } from '@/lib/unifiedFileService';
import { toast } from "@/components/ui/sonner";
import { ResourceDocument, ResourceManagerProps } from './types';
import { FileOpener } from '@/lib/utils/fileOpener';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { useChatStore } from '@/store/chatStore';

// 类型转换：将 UnifiedFile 转换为 ResourceDocument 格式以保持组件接口不变
const convertUnifiedFileToDocument = (file: UnifiedFile): ResourceDocument => ({
  id: file.id,
  title: file.name,
  filePath: file.filePath,
  fileType: file.fileType,
  fileSize: file.fileSize,
  createdAt: file.createdAt,
  updatedAt: file.updatedAt,
  tags: file.tags ? JSON.stringify(file.tags) : undefined,
  isIndexed: file.isIndexed || false,
  folderId: file.knowledgeBaseId,
  lastReferencedAt: file.lastReferencedAt,
});

// 最近引用类型
interface RecentReference {
  id: string;
  type: string;
  name: string;
  context: string;
  time: string;
  conversationId: string;
}

export function ResourceManager({ onRefresh, totalFileCount = 0, isLoadingStats = false }: ResourceManagerProps) {
  const [documents, setDocuments] = useState<ResourceDocument[]>([]);
  const [chatFiles, setChatFiles] = useState<ResourceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("documents");
  
  // 知识库相关状态
  const [addToKnowledgeBaseOpen, setAddToKnowledgeBaseOpen] = useState(false);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [selectedResourceName, setSelectedResourceName] = useState<string>('');
  
  // 备注相关状态 (仅用于文件，不用于文档)
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [resourceToNoteId, setResourceToNoteId] = useState<string | null>(null);
  const [resourceToNoteName, setResourceToNoteName] = useState<string>('');
  const [noteText, setNoteText] = useState<string>('');
  
  // 删除确认相关状态
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resourceToDeleteId, setResourceToDeleteId] = useState<string | null>(null);
  const [resourceToDeleteName, setResourceToDeleteName] = useState<string>('');
  
  // 添加lastRefreshTime状态用于触发刷新
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(Date.now());
  // 添加正在进行操作的标志
  const isOperationInProgress = useRef(false);
  
  // 最近引用状态
  const [recentReferences, setRecentReferences] = useState<RecentReference[]>([]);
  
  // 添加排序相关状态
  const [sortOption, setSortOption] = useState<string>("date");
  const [showIndexedOnly, setShowIndexedOnly] = useState(false);
  
  const router = useRouter();
  const setCurrentConversation = useChatStore((state)=>state.setCurrentConversation);
  
  // 将 ISO 日期转换为"x分钟前"等格式
  const formatRelativeTime = (isoDate: string): string => {
    try {
      return formatDistanceToNow(new Date(isoDate), { addSuffix: true, locale: zhCN });
    } catch {
      return isoDate;
    }
  };
  
  // 加载聊天文件
  const loadChatFiles = async () => {
    try {
      console.log('🔄 开始加载聊天文件...');
      
      // 使用DatabaseService获取聊天文件
      const { DatabaseService } = await import('@/lib/database/services/DatabaseService');
      const db = DatabaseService.getInstance();
      await db.initialize();
      
      const messageRepo = db.getMessageRepository();
      const chatFileData = await messageRepo.getChatAttachedFiles();
      
      console.log('📁 获取到聊天文件数据:', chatFileData);
      
      // 转换为ResourceDocument格式
      const chatDocuments: ResourceDocument[] = chatFileData.map((file, index) => ({
        id: `chat_${file.conversation_id}_${index}`, // 生成唯一ID
        title: file.fileName,
        filePath: `chat/${file.conversation_id}/${file.fileName}`, // 虚拟路径
        fileType: file.fileName.split('.').pop() || 'unknown',
        fileSize: file.fileSize,
        createdAt: file.created_at,
        updatedAt: file.created_at,
        isIndexed: false, // 聊天文件默认未索引
        source: 'chat' as const,
        conversationId: file.conversation_id,
        knowledgeBases: [] // 聊天文件初始时没有关联知识库
      }));
      
      setChatFiles(chatDocuments);
      console.log('聊天文件加载完成:', chatDocuments.length, '个文件');
      
    } catch (error) {
      console.error('❌ 加载聊天文件失败:', error);
      setChatFiles([]);
    }
  };
  
  // 加载文档资源
  useEffect(() => {
    loadDocuments();
    loadChatFiles();
    
    // 添加轮询刷新机制，每30秒刷新一次资源列表
    const refreshInterval = setInterval(() => {
      // 仅在没有操作正在进行时刷新
      if (!isOperationInProgress.current) {
        loadDocuments();
        loadChatFiles();
      }
    }, 30000);
    
    return () => clearInterval(refreshInterval);
  }, [lastRefreshTime]);
  
  const loadDocuments = async () => {
    try {
      setLoading(true);
      const allFiles = await UnifiedFileService.getAllFiles();
      
      // 转换为ResourceDocument格式并去重
      const uniqueDocuments: ResourceDocument[] = [];
      const seenIds = new Set<string>();
      
      allFiles.forEach(file => {
        if (!seenIds.has(file.id)) {
          seenIds.add(file.id);
          uniqueDocuments.push(convertUnifiedFileToDocument(file));
        } else {
          console.warn(`发现重复文件ID: ${file.id}, 已过滤`, file);
        }
      });
      
      // 获取每个文档关联的知识库信息
      try {
        const { DatabaseService } = await import('@/lib/database/services/DatabaseService');
        const db = DatabaseService.getInstance();
        await db.initialize();
        const knowledgeBaseRepo = db.getKnowledgeBaseRepository();
        
        // 批量获取知识库信息
        const allKnowledgeBases = await knowledgeBaseRepo.getAllKnowledgeBases();
        const kbMap = new Map(allKnowledgeBases.map(kb => [kb.id, kb.name]));
        
        // 为每个文档获取关联的知识库
        for (const doc of uniqueDocuments) {
          try {
            const mappings = await knowledgeBaseRepo.getDocumentKnowledgeBases(doc.id);
            doc.knowledgeBases = mappings.map(mapping => ({
              id: mapping.knowledgeBaseId,
              name: kbMap.get(mapping.knowledgeBaseId) || '未知知识库',
              status: mapping.status
            }));
          } catch (error) {
            console.warn(`获取文档 ${doc.id} 的知识库信息失败:`, error);
            doc.knowledgeBases = [];
          }
        }
      } catch (error) {
        console.warn('获取知识库信息失败:', error);
      }
      
      setDocuments(uniqueDocuments);

      // 从消息表获取最近引用
      try {
        const { DatabaseService } = await import('@/lib/database/services/DatabaseService');
        const db = DatabaseService.getInstance();
        // 确保已初始化
        await db.initialize();
        const recentRows = await db.getMessageRepository().getRecentDocumentReferences(5);

        const recentRefs: RecentReference[] = recentRows.map((row: any) => {
          const fileName = row.file_name?.replace(/"/g, '') || '文件';
          return {
            id: row.conversation_id + fileName,
            type: fileName.split('.').pop() || 'file',
            name: fileName,
            context: '在会话中引用',
            time: formatRelativeTime(row.created_at),
            conversationId: row.conversation_id
          } as any;
        });

        setRecentReferences(recentRefs);
      } catch (e) {
        console.error('加载最近引用失败', e);
      }
      
    } catch (error) {
      console.error('加载文档失败:', error);
      toast.error('加载文档失败', {
        description: '请检查权限或稍后重试',
      });
    } finally {
      setLoading(false);
    }
  };
  
  // 处理上传成功，完全刷新资源列表
  const handleUploadSuccess = useCallback(async () => {
    isOperationInProgress.current = true;
    setLoading(true);
    
    console.log('文件上传成功，开始刷新资源列表...');
    
    try {
      // 先设置短延时，确保后端处理完成
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // 文件系统已自动更新，无需额外扫描
      
      // 重新加载资源
      await loadDocuments();
      console.log('资源列表刷新完成');
      
      // 获取刷新后的文件数量
      const refreshedFiles = await UnifiedFileService.getAllFiles();
      
      // 显示成功通知，使用实际的文件数量
      toast.success('资源列表已更新', {
        description: `目前共有 ${refreshedFiles.length} 个资源`
      });

      // 通知父组件刷新计数
      if (onRefresh) {
        try {
          await onRefresh();
          console.log('已通知页面组件刷新计数');
        } catch (refreshError) {
          console.error('通知页面组件刷新失败:', refreshError);
        }
      }
      
    } catch (error) {
      console.error('刷新资源列表失败:', error);
      
      // 再次尝试
      setTimeout(async () => {
        try {
          await loadDocuments();
          console.log('二次尝试刷新资源列表');
        } catch (retryError) {
          console.error('二次尝试失败:', retryError);
        }
      }, 1000);
    } finally {
      isOperationInProgress.current = false;
      // 强制触发刷新
      setLastRefreshTime(Date.now());
      setLoading(false);
    }
  }, [loadDocuments]);
  
  // 处理查看文档
  const handleViewResource = useCallback(async (id: string) => {
    // 首先检查是否为聊天文件
    const chatFile = chatFiles.find(r => r.id === id);
    if (chatFile && chatFile.conversationId) {
      // 聊天文件：跳转到对应的对话
      try {
        const { useChatStore } = await import('@/store/chatStore');
        const { setCurrentConversation } = useChatStore.getState();
        setCurrentConversation(chatFile.conversationId);
        router.push('/chat');
        return;
      } catch (error) {
        console.error('跳转到对话失败:', error);
        toast.error('跳转失败', {
          description: '无法跳转到对应的对话'
        });
        return;
      }
    }
    
    // 普通文档：使用系统默认程序打开
    const document = documents.find(r => r.id === id);
    if (!document) return;
    
    await FileOpener.openFile(document.filePath, document.title);
  }, [documents, chatFiles, router]);
  
  // 处理添加到知识库
  const handleAddToKnowledgeBase = useCallback((id: string) => {
    // 优先从所有资源中查找（包括聊天文件）
    let document = documents.find(r => r.id === id);
    if (!document) {
      document = chatFiles.find(r => r.id === id);
    }
    if (!document) return;
    
    setSelectedResourceId(id);
    setSelectedResourceName(document.title);
    setAddToKnowledgeBaseOpen(true);
  }, [documents, chatFiles]);
  
  // 处理知识库添加成功
  const handleKnowledgeBaseAddSuccess = useCallback(() => {
    isOperationInProgress.current = true;
    
    // 小延时确保后端处理完成
    setTimeout(async () => {
      await loadDocuments();
      isOperationInProgress.current = false;
      // 强制触发刷新
      setLastRefreshTime(Date.now());
      
      toast.success('已添加到知识库', {
        description: '资源已成功添加到知识库',
      });
    }, 500);
  }, []);
  
  // 处理添加备注
  const handleAddNote = useCallback((id: string) => {
    const document = documents.find(r => r.id === id);
    if (!document) return;
    
    setResourceToNoteId(id);
    setResourceToNoteName(document.title);
    // 文档暂不支持note字段，使用空字符串
    setNoteText('');
    setNoteDialogOpen(true);
  }, [documents]);
  
  // 保存备注
  const saveNote = useCallback(async () => {
    if (!resourceToNoteId) return;
    
    try {
      // 文档暂不支持备注功能，直接关闭对话框
      toast.info('备注功能', {
        description: '文档备注功能将在后续版本中添加'
      });
    } catch (error) {
      console.error('保存备注失败:', error);
      toast.error('保存备注失败', {
        description: '无法保存备注，请稍后重试'
      });
    } finally {
      closeNoteDialog();
    }
  }, [resourceToNoteId, noteText]);
  
  // 关闭备注对话框
  const closeNoteDialog = useCallback(() => {
    setNoteDialogOpen(false);
    setResourceToNoteId(null);
    setResourceToNoteName('');
    setNoteText('');
  }, []);
  
  // 处理删除请求
  const handleDeleteRequest = useCallback((id: string) => {
    const document = documents.find(r => r.id === id);
    if (!document) return;
    
    setResourceToDeleteId(id);
    setResourceToDeleteName(document.title);
    setDeleteDialogOpen(true);
  }, [documents]);
  
  // 确认删除
  const confirmDelete = useCallback(async () => {
    if (!resourceToDeleteId) return;
    
    try {
      isOperationInProgress.current = true;
      const success = await UnifiedFileService.deleteFile(resourceToDeleteId);
      
      if (success) {
        // 先本地更新UI以提高响应速度
        setDocuments(prev => prev.filter(document => document.id !== resourceToDeleteId));
        
        // 然后异步刷新以确保数据一致性
        setTimeout(async () => {
          await loadDocuments();
          isOperationInProgress.current = false;
          // 强制触发刷新
          setLastRefreshTime(Date.now());
        }, 500);
        
        toast.success('文档已删除', {
          description: `已删除文档: ${resourceToDeleteName}`
        });
      } else {
        throw new Error('删除文档失败');
      }
    } catch (error) {
      console.error('删除文档失败:', error);
      toast.error('删除文档失败', {
        description: '无法删除文档，请稍后重试'
      });
      isOperationInProgress.current = false;
    } finally {
      closeDeleteDialog();
    }
  }, [resourceToDeleteId, resourceToDeleteName]);
  
  // 关闭删除对话框
  const closeDeleteDialog = useCallback(() => {
    setDeleteDialogOpen(false);
    setResourceToDeleteId(null);
    setResourceToDeleteName('');
  }, []);
  
  // 处理评论
  const handleComment = useCallback((id: string) => {
    toast.info('评论功能', {
      description: '评论功能将在后续版本中添加'
    });
  }, []);
  
  // 根据工具栏选项派生文档
  const displayedDocuments = useMemo(() => {
    let arr = [...documents];

    if (showIndexedOnly) {
      arr = arr.filter((d) => d.isIndexed);
    }

    switch (sortOption) {
      case 'name':
        arr.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'size':
        arr.sort((a, b) => a.fileSize - b.fileSize);
        break;
      case 'date':
      default:
        arr.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        break;
    }
    return arr;
  }, [documents, showIndexedOnly, sortOption]);
  
  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900">
      {/* 拖放上传卡片 */}
      <div className="p-4">
        <ResourceUploader onUploadSuccess={handleUploadSuccess} displayType="dropzone" />
      </div>
      
      {/* 工具栏：排序 & 过滤 */}
      <div className="flex items-center gap-4 px-4 pt-2 pb-1.5">
        {/* 文件统计显示 */}
        <div className="flex items-center gap-1 text-sm">
          <span className="text-slate-600 dark:text-slate-400">文件统计:</span>
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {isLoadingStats ? '加载中...' : `${totalFileCount} 个文件`}
          </span>
        </div>
        
        {/* 排序 */}
        <div className="flex items-center gap-1 text-sm">
          <span className="text-slate-600 dark:text-slate-300">排序:</span>
          <Select value={sortOption} onValueChange={(value) => setSortOption(value as any)}>
            <SelectTrigger className="h-8 w-24 text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800/80 dark:text-gray-100 focus:ring-primary/60 backdrop-blur-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date" className="text-xs">日期</SelectItem>
              <SelectItem value="name" className="text-xs">名称</SelectItem>
              <SelectItem value="size" className="text-xs">大小</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 仅已入库 toggle */}
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <UICheckbox
            className="border-slate-400 dark:border-slate-500 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
            checked={showIndexedOnly}
            onCheckedChange={(val: boolean) => setShowIndexedOnly(Boolean(val))}
          />
          <span className="text-slate-600 dark:text-slate-300">仅已入库</span>
        </label>
      </div>
      
      {/* 资源分类和列表 */}
      <div className="flex-1 overflow-hidden flex flex-col px-4 pb-2">
        <Tabs defaultValue="documents" className="w-full h-full flex flex-col" onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 mb-2 flex-shrink-0">
            <TabsTrigger value="documents">文档</TabsTrigger>
            <TabsTrigger value="files">文件</TabsTrigger>
            <TabsTrigger value="chat">聊天文件</TabsTrigger>
            <TabsTrigger value="knowledge">已入库</TabsTrigger>
          </TabsList>
          
          <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
            <TabsContent value="documents" className="mt-0 h-full">
              <ResourceList 
                resources={displayedDocuments}
                type="documents"
                loading={loading}
                onView={handleViewResource}
                onAddToKnowledgeBase={handleAddToKnowledgeBase}
                onDelete={handleDeleteRequest}
                onComment={handleComment}
              />
            </TabsContent>
            
            <TabsContent value="files" className="mt-0 h-full">
              <ResourceList 
                resources={displayedDocuments}
                type="files"
                loading={loading}
                onAddToKnowledgeBase={handleAddToKnowledgeBase}
                onDelete={handleDeleteRequest}
                onAddNote={handleAddNote}
                onComment={handleComment}
              />
            </TabsContent>
            
            <TabsContent value="chat" className="mt-0 h-full">
              <ResourceList 
                resources={chatFiles}
                type="chat"
                loading={loading}
                onView={handleViewResource}
                onAddToKnowledgeBase={handleAddToKnowledgeBase}
                onComment={handleComment}
              />
            </TabsContent>
            
            <TabsContent value="knowledge" className="mt-0 h-full">
              <ResourceList 
                resources={displayedDocuments}
                type="knowledge"
                loading={loading}
                onView={handleViewResource}
                onDelete={handleDeleteRequest}
                onAddNote={handleAddNote}
                onComment={handleComment}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
      
      {/* 最近引用区域 */}
      <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 flex-shrink-0">
        <RecentlyReferenced references={recentReferences} onNavigate={(cid) => { setCurrentConversation(cid); router.push('/chat'); }} />
      </div>
      
      {/* 添加到知识库对话框 */}
      {selectedResourceId && (
        <AddToKnowledgeBase
          open={addToKnowledgeBaseOpen}
          onOpenChange={setAddToKnowledgeBaseOpen}
          documentId={selectedResourceId}
          documentTitle={selectedResourceName}
          onSuccess={handleKnowledgeBaseAddSuccess}
        />
      )}
      
      {/* 备注对话框 */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加资源备注</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="mb-2 text-sm">为资源 <span className="font-medium">{resourceToNoteName}</span> 添加备注：</p>
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="输入备注内容..."
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeNoteDialog}>取消</Button>
            <Button onClick={saveNote}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          {/* 右上角关闭按钮 */}
          <button
            onClick={() => setDeleteDialogOpen(false)}
            className="absolute top-4 right-4 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 cursor-pointer"
            aria-label="关闭"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <AlertDialogHeader className="pr-8">
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除资源 <span className="font-medium">{resourceToDeleteName}</span> 吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeDeleteDialog}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 