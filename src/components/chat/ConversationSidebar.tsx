"use client";

import React, { useState, useEffect } from "react";
import { Conversation } from "@/types/chat";
import { useChatStore } from "@/store/chatStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Virtuoso } from 'react-virtuoso';
import { TooltipProvider } from "@/components/ui/tooltip";
import { SearchIcon, MessageSquare } from "lucide-react";
import FoldingLoader from '@/components/ui/FoldingLoader';
import { ConversationItem } from "./ConversationItem";
import { DeleteConversationDialog } from "./DeleteConversationDialog";
import { exportConversationMarkdown } from '@/lib/chat/actions/download';

interface ConversationSidebarProps {
  filteredConversations?: Conversation[];
  isSearching?: boolean;
  searchQuery?: string;
}

export function ConversationSidebar({ 
  filteredConversations, 
  isSearching = false,
  searchQuery = ''
}: ConversationSidebarProps) {
  const storeConversations = useChatStore((state) => state.conversations);
  const currentConversationId = useChatStore((state) => state.currentConversationId);
  const setCurrentConversation = useChatStore((state) => state.setCurrentConversation);
  const deleteConversation = useChatStore((state) => state.deleteConversation);
  const renameConversation = useChatStore((state) => state.renameConversation);
  const toggleStarConversation = useChatStore((state) => state.toggleStarConversation);
  const toggleImportant = useChatStore((state) => state.toggleImportant);
  const duplicateConversation = useChatStore((state) => state.duplicateConversation);
  const isLoading = useChatStore((state) => state.isLoadingConversations);

  const conversationsToShow = filteredConversations || storeConversations;

  const [renamingConversationId, setRenamingConversationId] = useState<string | null>(null);
  const [renameInputValue, setRenameInputValue] = useState("");
  const [clickTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [conversationToDelete, setConversationToDelete] = useState<Conversation | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  
  const handleDeleteClick = (e: any, conv: Conversation) => {
    if (e?.preventDefault) {
      e.preventDefault();
    }
    setConversationToDelete(conv);
    setIsAlertOpen(true);
  };
  
  const handleConfirmDelete = async () => {
    if (!conversationToDelete) return;
    await deleteConversation(conversationToDelete.id);
    setIsAlertOpen(false);
    setConversationToDelete(null);
  };

  // 保留双击标题进入重命名

  const handleTitleDoubleClick = (e: any, conv: Conversation) => {
    if (e?.preventDefault) e.preventDefault();
    setRenamingConversationId(conv.id);
    setRenameInputValue(conv.title);
  };

  const handleTitleClick = (e: any, conv: Conversation) => {
    if (e?.preventDefault) e.preventDefault();
    setCurrentConversation(conv.id);
  };

  const handleRenameSubmit = async () => {
    if (!renamingConversationId || !renameInputValue.trim()) return;
    await renameConversation(renamingConversationId, renameInputValue.trim());
    setRenamingConversationId(null);
    setRenameInputValue('');
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      setRenamingConversationId(null);
      setRenameInputValue('');
    }
  };

  useEffect(() => {
    return () => {
      if (clickTimeoutId) {
        clearTimeout(clickTimeoutId);
      }
    };
  }, [clickTimeoutId]);

  // 星标直接使用 toggleStarConversation

  const handleToggleImportant = (conversationId: string) => {
    toggleImportant(conversationId);
  };

  const handleDuplicateConversation = (conversationId: string) => {
    duplicateConversation(conversationId);
  };

  const downloadConversation = async (id: string) => {
    const conv = storeConversations.find(c => c.id === id) || null;
    await exportConversationMarkdown(conv, id);
  };

  if (isLoading) {
    return (
      <ScrollArea className="flex-1 p-2 h-full">
        <div className="flex justify-center items-center h-full">
          <FoldingLoader size={28} />
        </div>
      </ScrollArea>
    );
  }

  if (!isLoading && conversationsToShow.length === 0) {
    return (
      <ScrollArea className="flex-1 px-2 pt-1 pb-2 h-full">
        <div className="text-center text-slate-500 dark:text-slate-400 py-10 px-4">
          {isSearching ? (
            <>
              <SearchIcon className="h-8 w-8 mx-auto mb-2 text-slate-400 dark:text-slate-500" />
              <p>没有找到与 "{searchQuery}" 相关的会话</p>
            </>
          ) : (
            <div className="space-y-2">
              <MessageSquare className="h-6 w-6 mx-auto text-slate-400/60 dark:text-slate-500/60" />
              <p className="text-xs">无对话记录，选择一个模型开始对话</p>
            </div>
          )}
        </div>
      </ScrollArea>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex-1 px-2 pt-1 pb-2 h-full">
        <Virtuoso
          totalCount={conversationsToShow.length}
          data={conversationsToShow}
          useWindowScroll={false}
          increaseViewportBy={200}
          computeItemKey={(index, item) => item.id}
          itemContent={(index, conv) => (
            <div className="mb-1">
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isCurrent={currentConversationId === conv.id}
                isRenaming={renamingConversationId === conv.id}
                renameInputValue={renameInputValue}
                onSelect={setCurrentConversation}
                onRenameStart={handleTitleDoubleClick}
                onTitleClick={handleTitleClick}
                onRenameChange={setRenameInputValue}
                onRenameSubmit={handleRenameSubmit}
                onRenameBlur={handleRenameSubmit}
                onRenameKeyDown={handleRenameKeyDown}
                onDelete={handleDeleteClick}
                onStar={toggleStarConversation}
                onToggleImportant={handleToggleImportant}
                onDuplicate={handleDuplicateConversation}
                onExport={downloadConversation}
              />
            </div>
          )}
          style={{ height: '100%' }}
        />
      </div>
      <DeleteConversationDialog
        isOpen={isAlertOpen}
        onOpenChange={setIsAlertOpen}
        onConfirm={handleConfirmDelete}
        conversation={conversationToDelete}
      />
    </TooltipProvider>
  );
} 