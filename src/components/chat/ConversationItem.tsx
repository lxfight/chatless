"use client";

import React from 'react';
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ContextMenu, createConversationMenuItems } from "@/components/ui/context-menu";
import { Flag, Star, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import type { Conversation } from "@/types/chat";
import { useProviderMetaStore } from '@/store/providerMetaStore';
import type { ProviderMetadata } from '@/lib/metadata/types';

interface ConversationItemProps {
  conversation: Conversation;
  isCurrent: boolean;
  isRenaming: boolean;
  renameInputValue: string;
  onSelect: (id: string) => void;
  onRenameStart: (e: React.MouseEvent, conv: Conversation) => void;
  onTitleClick: (e: React.MouseEvent, conv: Conversation) => void;
  onRenameChange: (value: string) => void;
  onRenameSubmit: () => void;
  onRenameBlur: () => void;
  onRenameKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onDelete: (e: React.MouseEvent, conv: Conversation) => void;
  onStar: (id: string) => void;
  onToggleImportant: (id: string) => void;
  onDuplicate: (id: string) => void;
  onExport: (id: string) => void;
}

export function ConversationItem({
  conversation,
  isCurrent,
  isRenaming,
  renameInputValue,
  onSelect,
  onRenameStart,
  onTitleClick,
  onRenameChange,
  onRenameSubmit,
  onRenameBlur,
  onRenameKeyDown,
  onDelete,
  onStar,
  onToggleImportant,
  onDuplicate,
  onExport,
}: ConversationItemProps) {
  const formattedTime = formatDistanceToNow(conversation.updated_at, {
    addSuffix: true,
    locale: zhCN,
  });
  // 文案更紧凑：将“ 大约 ”替换为“ 约 ”
  const compactTime = formattedTime.replace(/^大约\s*/, '约 ');

  return (
    <ContextMenu
      menuItems={createConversationMenuItems(
        conversation.id,
        conversation.is_important,
        (conversation as any).is_favorite,
        (id) => onRenameStart({ stopPropagation: () => {} } as React.MouseEvent, conversation),
        (id) => onDelete({ stopPropagation: () => {} } as React.MouseEvent, conversation),
        onStar,
        onToggleImportant,
        onDuplicate,
        onExport
      )}
    >
      <li
        className={cn(
          "group relative flex flex-col gap-1 px-2 py-2 rounded-lg transition-all duration-200 cursor-pointer",
          isCurrent
            ? "text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-500/10"
            : "text-slate-600 dark:text-slate-400 hover:bg-gray-50/80 dark:hover:bg-gray-800/30 hover:text-slate-900 dark:hover:text-slate-200 hover:shadow-sm"
        )}
        onClick={() => onSelect(conversation.id)}
      >
        {/* 活动强调条 - 精致轻盈设计 */}
        {isCurrent && (
          <div className="absolute left-0 top-2 bottom-2 w-px bg-blue-400/60" />
        )}
        <div className="flex items-center gap-2 min-w-0">
          {isRenaming ? (
            <Input
              value={renameInputValue}
              onChange={(e) => onRenameChange(e.target.value)}
              onBlur={onRenameBlur}
              onKeyDown={onRenameKeyDown}
              className="h-6 px-1 py-0 text-sm bg-transparent"
              autoFocus
            />
          ) : (
            <div
              className="flex-1 text-sm font-medium truncate cursor-pointer leading-tight"
              onClick={(e) => onTitleClick(e, conversation)}
              onDoubleClick={(e) => onRenameStart(e, conversation)}
            >
              {conversation.title}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-xs mt-0.5">
          <div className="flex-1 min-w-0 flex items-center gap-2 pr-1 text-slate-500 dark:text-slate-400">
            <span className="text-[11px] whitespace-nowrap">{compactTime}</span>
            <ModelLabelSpan conversation={conversation} />
          </div>

          <div className="flex items-center gap-1.5">
            {conversation.is_important && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Flag className="w-3 h-3 text-red-500" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>重要对话</p>
                </TooltipContent>
              </Tooltip>
            )}
            {(conversation as any).is_favorite && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Star className="w-3 h-3 text-yellow-500" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>已收藏</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </li>
    </ContextMenu>
  );
} 

function ModelLabelSpan({ conversation }: { conversation: Conversation }) {
  const metadata = useProviderMetaStore((s)=> s.list as unknown as ProviderMetadata[]);
  // 统一解析：始终从元数据按 provider+model_id（或仅 model_id）解析 label，不再读取会话里的临时字段
  const prov = (conversation as any).model_provider as string | undefined;
  const id = conversation.model_id;
  let label: string | undefined = undefined;
  if (prov) {
    const p = (metadata || []).find(pp => pp.name === prov);
    const m = p?.models?.find((mm: any) => mm.name === id);
    label = m?.label;
  }
  if (!label) {
    for (const p of (metadata || [])) {
      const m = p.models?.find((mm:any)=> mm.name === id);
      if (m?.label) { label = m.label; break; }
    }
  }
  const display = label || conversation.model_id;
  return (
    <span
      className="text-[10px] opacity-60 whitespace-nowrap overflow-hidden text-ellipsis truncate max-w-[8.5rem] sm:max-w-[10.5rem]"
      title={(conversation as any).model_full_id || conversation.model_id}
    >
      {display}
    </span>
  );
}