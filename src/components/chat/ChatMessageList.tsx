import React from 'react';
import { Virtuoso } from 'react-virtuoso';
import { ChatMessage } from './ChatMessage';
import { Message } from '@/types/chat';
import { ChatEmptyState } from '@/components/chat/ChatEmptyState';
import FoldingLoader from '@/components/ui/FoldingLoader';

interface ChatMessageListProps {
  chatId?: string;
  messages: Message[];
  isLoading: boolean;
  onEditMessage: (messageId: string, content: string) => void;
  /** 重新生成（刷新）助手消息 */
  onRetryMessage?: (messageId: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onSaveThinkingDuration?: (messageId: string, duration: number) => void;
  messageRefs?: React.MutableRefObject<{ [key: string]: HTMLDivElement }>;
  messagesEndRef?: React.RefObject<HTMLDivElement | null>;
  /** 外部滚动容器（推荐传入父级滚动容器） */
  scrollParentRef?: React.RefObject<HTMLDivElement | null>;
  /** 注册一个按消息ID滚动的API，便于父组件实现“跳转到具体消息” */
  onRegisterScrollToMessage?: (fn: (id: string) => void) => void;
  /** 首次挂载时的初始可视区域顶端索引（用于快速定位） */
  initialTopMostItemIndex?: number;
}

export function ChatMessageList({
  chatId: _chatId,
  messages,
  isLoading,
  onEditMessage,
  onRetryMessage,
  onDeleteMessage: _onDeleteMessage,
  onSaveThinkingDuration,
  messageRefs,
  messagesEndRef,
  scrollParentRef,
  onRegisterScrollToMessage,
  initialTopMostItemIndex,
}: ChatMessageListProps) {

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <ChatEmptyState onPromptClick={() => {}} />
      </div>
    );
  }

  return (
    <div className="flex-1 custom-scrollbar" style={{ overscrollBehavior: 'contain' }}>
      <Virtuoso
        totalCount={messages.length}
        data={messages}
        useWindowScroll={false}
        customScrollParent={scrollParentRef?.current || undefined}
        increaseViewportBy={400}
        followOutput={'smooth'}
        initialTopMostItemIndex={typeof initialTopMostItemIndex === 'number' ? initialTopMostItemIndex : undefined}
        computeItemKey={(index, item) => item.id}
        itemContent={(index: number, message: Message) => {
          return (
            <div
              key={message.id}
              ref={(el) => {
                if (messageRefs) {
                  if (el) messageRefs.current[message.id] = el; else delete messageRefs.current[message.id];
                }
              }}
              data-message-id={message.id}
              className='ml-4 mr-2'
              style={{ minHeight: 56, contain: 'layout paint', transform: 'translateZ(0)' }}
            >
              <ChatMessage
                id={message.id}
                content={message.content}
                role={message.role}
                timestamp={new Date(message.created_at).toISOString()}
                model={message.model}
                status={((): any => {
                  const isLast = messages[messages.length - 1]?.id === message.id;
                  const s = message.status;
                  if (!isLast && s === 'loading') return 'sent';
                  if (isLast) return s || (isLoading ? 'loading' : 'sent');
                  return s || 'sent';
                })()}
                thinking_duration={message.thinking_duration}
                onSaveThinkingDuration={onSaveThinkingDuration}
                documentReference={message.document_reference}
                knowledgeBaseReference={message.knowledge_base_reference}
                images={message.images}
                viewModel={message.segments_vm}
                segments={message.segments}
                onEdit={() => onEditMessage(message.id, message.content)}
                onCopy={(content) => navigator.clipboard.writeText(content)}
                onRetry={message.role === 'assistant' && onRetryMessage ? () => onRetryMessage(message.id) : undefined}
              />
            </div>
          );
        }}
        components={{
          Footer: () => (messagesEndRef ? <div ref={messagesEndRef} /> : null),
        }}
        style={{ height: '100%' }}
        ref={(instance) => {
          if (!onRegisterScrollToMessage || !instance) return;
          // 以 any 访问可能存在的 scrollToIndex 方法
          const anyInst: any = instance;
          const api = (id: string) => {
            const idx = messages.findIndex((m) => m.id === id);
            if (idx >= 0 && typeof anyInst.scrollToIndex === 'function') {
              anyInst.scrollToIndex({ index: idx, align: 'start', behavior: 'auto' });
            }
          };
          onRegisterScrollToMessage(api);
        }}
      />
      {isLoading && messages.length === 0 && (
        <div className="flex justify-center p-4">
          <FoldingLoader size={36} />
        </div>
      )}
    </div>
  );
} 