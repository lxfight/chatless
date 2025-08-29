"use client";

import { useState } from 'react';
import { useChatStore } from '@/store/chatStore';
import { Share, Download, Edit, MessageSquare, Trash2, MoreVertical, Menu } from 'lucide-react';
import { ModelSelector } from "./ModelSelector";
import { ProviderMetadata } from "@/lib/metadata/types";
import { DeleteConversationDialog } from './DeleteConversationDialog';
import { EditableTitle } from './EditableTitle';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useSidebar } from '@/contexts/SidebarContext';
import { PromptPill } from './PromptPill';
import { useEffect } from 'react';
import { getEnabledConfiguredServers, getConnectedServers, getEnabledServersForConversation, setEnabledServersForConversation } from '@/lib/mcp/chatIntegration';

interface ChatHeaderProps {
  title: string;
  tags?: string[];
  onShare?: () => void;
  onDownload?: () => void;
  onTitleChange: (newTitle: string) => void;
  onDelete: () => void;
  allMetadata: ProviderMetadata[];
  currentModelId: string | null;
  currentProviderName?: string;
  onModelChange: (newModelId: string) => void;
  isModelSelectorDisabled?: boolean;
  tokenCount?: number;
}

export function ChatHeader({
  title,
  tags,
  onShare,
  onDownload,
  onTitleChange,
  onDelete,
  allMetadata,
  currentModelId,
  currentProviderName,
  onModelChange: handleModelChange,
  isModelSelectorDisabled = false,
  tokenCount = 0
}: ChatHeaderProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [mcpAll, setMcpAll] = useState<string[]>([]);
  const [mcpConnected, setMcpConnected] = useState<string[]>([]);
  const conversationId = useChatStore((s)=>s.currentConversationId);
  const [enabledForConv, setEnabledForConv] = useState<string[]>([]);

  const createConversation = useChatStore((state) => state.createConversation);
  const { toggleSidebar } = useSidebar();

  const handleNewChat = async () => {
    const defaultModelId = 'default-model';
    const now = new Date();
    const newTitle = `新对话 ${now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
    await createConversation(newTitle, defaultModelId);
  };

  const handleConfirmDelete = () => {
    onDelete();
    setShowDeleteConfirm(false);
  };

  // 初始化 MCP 列表与会话选择
  useEffect(() => {
    (async () => {
      setMcpAll(await getEnabledConfiguredServers());
      setMcpConnected(await getConnectedServers());
      if (conversationId) setEnabledForConv(await getEnabledServersForConversation(conversationId));
    })();
  }, [conversationId]);

  const toggleServer = async (name: string) => {
    let next: string[];
    if (enabledForConv.includes(name)) next = enabledForConv.filter(n => n !== name);
    else next = [...enabledForConv, name];
    setEnabledForConv(next);
    if (conversationId) await setEnabledServersForConversation(conversationId, next);
  };

  return (
    <>
      <div className="px-2 py-1 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={toggleSidebar} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer" title="切换侧边栏">
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
          
          <EditableTitle
            initialTitle={title}
            onTitleChange={onTitleChange}
            className="font-medium text-base text-gray-800 dark:text-gray-200"
            inputClassName="text-base font-medium"
          />
          
          {tags?.map((tag, index) => (
            <span
              key={index}
              className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 text-xs px-2.5 py-1 rounded-full shadow-sm"
            >
              {tag}
            </span>
          ))}
        </div>
        
        <div className="flex items-center gap-3">
          <ModelSelector 
            allMetadata={allMetadata}
            currentModelId={currentModelId}
            currentProviderName={currentProviderName}
            onModelChange={handleModelChange}
            disabled={isModelSelectorDisabled}
          />
          {/* 旧的右上角 MCP 选择已移除，改为输入框上拉面板 */}
          <PromptPill />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                title="更多操作" 
                className="text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-0 focus:ring-offset-0 cursor-pointer"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200">
              <DropdownMenuItem onSelect={handleNewChat}>新建对话</DropdownMenuItem>
              <DropdownMenuItem onSelect={onShare}>分享对话</DropdownMenuItem>
              <DropdownMenuItem onSelect={onDownload}>导出对话</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setShowDeleteConfirm(true)}>
                删除对话
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      <DeleteConversationDialog
        isOpen={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={handleConfirmDelete}
        conversation={{ title } as any}
      />
    </>
  );
} 