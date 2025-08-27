import { ChatMessage } from './ChatMessage';
import { Message } from '@/types/chat';
import { ChatEmptyState } from '@/components/chat/ChatEmptyState';

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
}

export function ChatMessageList({
  chatId: _chatId,
  messages,
  isLoading,
  onEditMessage,
  onRetryMessage,
  onDeleteMessage,
  onSaveThinkingDuration,
  messageRefs,
  messagesEndRef,
}: ChatMessageListProps) {

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <ChatEmptyState onPromptClick={() => {}} />
      </div>
    );
  }

  return (
    <div className="flex-1 custom-scrollbar">
      <div className="px-2 py-2">
        {messages.map((message, idx) => (
          <div
            key={message.id}
            ref={(el) => {
              if (messageRefs) {
                if (el) messageRefs.current[message.id] = el;
                else delete messageRefs.current[message.id];
              }
            }}
            data-message-id={message.id}
            className='ml-4 mr-4'
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
              // 只允许“最后一条消息”进入 loading；历史消息即便存有旧的 loading 标记也强制视为已完成
              if (!isLast && s === 'loading') return 'sent';
              if (isLast) return s || (isLoading ? 'loading' : 'sent');
              return s || 'sent';
            })()}
            thinking_duration={message.thinking_duration}
            onSaveThinkingDuration={onSaveThinkingDuration}
            documentReference={message.document_reference}
            knowledgeBaseReference={message.knowledge_base_reference}
            images={message.images}
            viewModel={(message as any).segments_vm}
            // 关键：透传结构化片段以驱动即时渲染（think/toolCard/text）
            segments={(message as any).segments}
            onEdit={() => onEditMessage(message.id, message.content)}
            // 复制功能
            onCopy={(content) => navigator.clipboard.writeText(content)}
            // 重新生成 / 刷新功能
            onRetry={message.role === 'assistant' && onRetryMessage ? () => onRetryMessage(message.id) : undefined}
            />
          </div>
        ))}
        {isLoading && messages.length === 0 && (
          <div className="flex justify-center p-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
          </div>
        )}
      </div>
      {messagesEndRef && <div ref={messagesEndRef} />}
    </div>
  );
} 