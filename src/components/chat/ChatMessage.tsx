"use client";

import React, { useMemo, useEffect, useState } from 'react';
import { Copy, Star, RefreshCcw, Check } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Button } from '@/components/ui/button';
import { ContextMenu, createMessageMenuItems } from '@/components/ui/context-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useChatStore } from '@/store/chatStore';
import { UserMessageBlock } from './UserMessageBlock';
import { AIMessageBlock } from './AIMessageBlock';
import type { Message } from '@/types/chat';
import { motion } from 'framer-motion';

// Toggle for verbose internal logging. Set to true when debugging ChatMessage rendering.
const DEBUG_CHAT_MESSAGE = false;

interface ChatMessageProps {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
  model?: string;
  onEdit?: (id: string) => void;
  onCopy?: (content: string) => void;
  onStar?: (id: string) => void;
  onRetry?: () => void;
  status: 'pending' | 'sending' | 'sent' | 'error' | 'loading' | 'aborted';
  thinking_duration?: number;
  thinking_start_time?: number; // 思考开始时间戳（毫秒）
  onSaveThinkingDuration?: (messageId: string, duration: number) => void;
  
  // 新增的文档引用props
  documentReference?: {
    fileName: string;
    fileType: string;
    fileSize: number;
    summary: string;
  };
  contextData?: string;
  
  // 知识库引用props
  knowledgeBaseReference?: {
    id: string;
    name: string;
  };
  images?: string[];
  segments?: Message['segments'];
  viewModel?: Message['segments_vm'];
  version_group_id?: string;
  version_index?: number;
  /** 可选：外部注入的版本切换控制（用于版本组首条顶部展示） */
  versionControls?: { current: number; total: number; onPrev: () => void; onNext: () => void } | null;
}

const formatTimestamp = (timestamp: string | undefined): string => {
  if (!timestamp) return '';
  try {
    const d = new Date(timestamp);
    if (Number.isNaN(d.getTime())) return '';
    const now = new Date();
    const isSameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    const yest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const isYesterday = d.getFullYear() === yest.getFullYear() && d.getMonth() === yest.getMonth() && d.getDate() === yest.getDate();
    const two = (n: number) => (n < 10 ? `0${n}` : String(n));
    const hm = `${two(d.getHours())}:${two(d.getMinutes())}`;
    if (isSameDay) return hm; // 当天只显示时间
    if (isYesterday) return `${hm} 昨日`;
    const md = `${two(d.getMonth() + 1)}-${two(d.getDate())}`;
    const y = d.getFullYear();
    const sameYear = y === now.getFullYear();
    return sameYear ? `${hm} ${md}` : `${hm} ${y}-${md}`; // 日期显示在时间后面
  } catch {
    return '';
  }
};

function ChatMessageComponent({
  id,
  content,
  role,
  timestamp,
  model,
  onEdit,
  onCopy,
  onStar,
  onRetry,
  status,
  thinking_duration,
  thinking_start_time,
  onSaveThinkingDuration,
  
  // 新增的文档引用props
  documentReference,
  contextData,
  
  // 知识库引用props
  knowledgeBaseReference,
  images,
  segments,
  viewModel,
  version_index: _version_index,
  versionControls = null,
}: ChatMessageProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const deleteMessage = useChatStore((s)=> s.deleteMessage);

  if (DEBUG_CHAT_MESSAGE) { /* noop */ }
  
  // 在组件挂载和更新时记录props变化
  useEffect(() => {
    if (DEBUG_CHAT_MESSAGE) { /* noop */ }
  }, [id, documentReference?.fileName, contextData, knowledgeBaseReference?.id, status, images?.length]);
  

  const isUser = role === "user";
  const isStreaming = status === 'loading';
  // 生成期间不显示时间与模型，避免视觉抖动；完成后再显示
  const formattedTime = isStreaming ? '' : formatTimestamp(timestamp);

  
  // 仅对“正在生成/刚发送”的消息开启入场动画；历史消息不做入场动画，避免切换会话时整列表闪烁
  const shouldAnimateEnter = isStreaming || status === 'sending' || status === 'pending';

  const messageContent = useMemo(() => {
    if (DEBUG_CHAT_MESSAGE) { /* noop */ }
    return isUser 
      ? <UserMessageBlock 
          id={id}
          content={content}
          documentReference={documentReference}
          contextData={contextData}
          knowledgeBaseReference={knowledgeBaseReference}
          images={images}
          onEdit={onEdit}
          onCopy={onCopy}
        /> 
      : <AIMessageBlock 
          content={content}
          isStreaming={isStreaming}
          thinkingDuration={thinking_duration}
          thinking_start_time={thinking_start_time}
          id={id}
          // 关键：把上层透传的 segments 优先交给 AIMessageBlock 做段驱动渲染（包含 think 段）
          segments={Array.isArray(segments) ? (segments as any) : undefined}
          viewModel={viewModel as any}
          onStreamingComplete={(duration) => {
            if (onSaveThinkingDuration) {
              onSaveThinkingDuration(id, duration);
            }
          }}
        />;
  }, [isUser, id, content, documentReference?.fileName, contextData, knowledgeBaseReference?.id, images?.length, onEdit, onCopy, isStreaming, thinking_duration, thinking_start_time, onSaveThinkingDuration, segments, viewModel]);

  const handleCopy = async (contentToCopy: string) => {
    try {
      if (onCopy) {
        onCopy(contentToCopy);
      } else {
        await navigator.clipboard.writeText(contentToCopy);
      }
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  return (
    <div
      className={cn(
        "flex chat-transition group mt-4 mb-4 relative w-full",
        isUser 
          ? "flex-row-reverse justify-start max-w-[85%] ml-auto" 
          : "max-w-[85%]"
      )}
    >
      {/* 头像隐藏 */}
      {/* <div className="w-8 shrink-0"></div> */}
 
      {/* 消息内容 */}
      <div className={cn(
        "flex flex-col min-w-0 max-w-full",
        !isUser && "flex-1",
        isUser ? "items-end" : "items-start"
      )}>
        <ContextMenu
          menuItems={createMessageMenuItems(
            id,
            content,
            !isUser,
            onCopy || ((c) => { void c; }),
            isUser ? onEdit : undefined,
            !isUser ? onRetry : undefined,
            onStar,
            () => setConfirmOpen(true)
          )}
        >
          <motion.div
            initial={shouldAnimateEnter ? { opacity: 0, scale: 0.98 } : false}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15 }}
          >
            <div className={cn(
              isUser ? "max-w-full min-w-0" : "w-full max-w-full min-w-0",
              // 用户消息：暗色下改为更接近背景的轻微浮起效果，降低层次断差
              isUser
                ? "px-2.5 py-2 text-[14px] leading-[1.3] rounded-2xl bg-blue-50/80 dark:bg-slate-800/50 border border-blue-200/40 dark:border-slate-700"
                : "px-2.5 py-2 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50",
              !isUser && "rounded-tl-2xl"
            )}>
              {messageContent}
            </div>
          </motion.div>
        </ContextMenu>

        {/* 删除确认对话框 */}
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>删除这条消息？</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div>
                  此操作不可撤销，将永久从会话中移除该条消息。
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction onClick={() => { setConfirmOpen(false); try { void deleteMessage(id); } catch { /* noop */ } }}>删除</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
 
        {/* 时间戳和模型信息：仅在非流式时显示，避免生成中抖动 */}
        {!isStreaming && (formattedTime || (!isUser && model)) && (
          <div className={cn(
            "flex items-center justify-between flex-nowrap text-xs text-slate-500 dark:text-slate-400 ml-2 mt-1.5",
            isUser ? "self-end" : "self-start w-full"
          )}>
            <div className="flex items-center gap-2 min-w-0 whitespace-nowrap overflow-hidden">
              {!isUser && model && (
                <span className="font-medium truncate max-w-[40vw]">{model}</span>
              )}
              <span className="shrink-0">{formattedTime}</span>
            </div>
            {/* AI消息功能按钮 */}
            {!isUser && (
              <div className="flex items-center gap-1 mr-3 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto translate-x-1">
                {onRetry && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onRetry}
                    className="h-5 w-5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 shrink-0"
                    title="重试"
                  >
                    <RefreshCcw className="w-3 h-3" />
                  </Button>
                )}
                <div className="relative group/copy">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleCopy(content)}
                    className={cn(
                      "h-5 w-5 rounded-full transition-all duration-200",
                      isCopied
                        ? "text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                        : " text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 shrink-0"
                    )}
                    title={isCopied ? "已复制" : "复制"}
                  >
                    {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </Button>
                  {/* 复制按钮的 tip 展示字数 */}
                  <div className="absolute right-0 -top-6 translate-y-[-2px] opacity-0 group-hover/copy:opacity-100 pointer-events-none select-none text-[11px] text-gray-500 bg-gray-50/90 dark:bg-gray-800/70 rounded px-1.5 py-0.5 shadow-sm whitespace-nowrap">
                    {`字数: ${(content || '').replace(/\s+/g,'').length}`}
                  </div>
                </div>
                {onStar && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onStar(id)}
                    className="h-5 w-5 text-gray-400 hover:text-gray-600 rounded-full ring-1 ring-transparent hover:ring-gray-300 dark:hover:ring-gray-600"
                    title="收藏回答"
                  >
                    <Star className="w-3 h-3" />
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* 底部版本切换器（仅AI消息 + 有版本时显示） */}
        {!isUser && versionControls && versionControls.total > 1 && (
          <div className="flex items-center justify-center mt-3 mb-1">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-400 select-none">
              <button
                className={cn(
                  "w-6 h-6 flex items-center justify-center rounded-full transition-all",
                  versionControls.current <= 1
                    ? "opacity-30 pointer-events-none"
                    : "hover:bg-slate-200/60 dark:hover:bg-slate-700/60 active:scale-95"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  versionControls.onPrev();
                }}
                title="上一版本"
                aria-label="上一版本"
              >
                ‹
              </button>
              <span className="font-medium tabular-nums">
                {versionControls.current} / {versionControls.total}
              </span>
              <button
                className={cn(
                  "w-6 h-6 flex items-center justify-center rounded-full transition-all",
                  versionControls.current >= versionControls.total
                    ? "opacity-30 pointer-events-none"
                    : "hover:bg-slate-200/60 dark:hover:bg-slate-700/60 active:scale-95"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  versionControls.onNext();
                }}
                title="下一版本"
                aria-label="下一版本"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const ChatMessage = React.memo(
  ChatMessageComponent,
  (prev: ChatMessageProps, next: ChatMessageProps) => {
    // 仅在关键属性变化时才重渲染
    return (
      prev.id === next.id &&
      prev.role === next.role &&
      prev.status === next.status &&
      prev.content === next.content &&
      prev.model === next.model &&
      prev.timestamp === next.timestamp &&
      prev.thinking_duration === next.thinking_duration &&
      prev.thinking_start_time === next.thinking_start_time &&
      (prev.images?.length || 0) === (next.images?.length || 0) &&
      // 结构化段的引用地址不变时视作不变（上层保证不可变更新）
      prev.segments === next.segments &&
      prev.viewModel === next.viewModel
    );
  }
); 