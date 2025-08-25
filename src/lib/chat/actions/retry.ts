import type { Conversation, Message } from '@/types/chat';
import { useChatStore } from '@/store/chatStore';

export async function retryAssistantMessage(currentConversationId: string | null, messageIdToRetry: string, handleSendMessage: (content: string) => Promise<void>): Promise<void> {
  if (!currentConversationId) return;
  const conversation = useChatStore.getState().conversations.find(c => c.id === currentConversationId);
  if (!conversation) return;

  const messageIndex = conversation.messages?.findIndex(m => m.id === messageIdToRetry);
  if (messageIndex === undefined || messageIndex === -1) return;

  if (conversation.messages?.[messageIndex]?.role !== 'assistant') return;

  let userMessageIndex = messageIndex - 1;
  while (userMessageIndex >= 0 && conversation.messages[userMessageIndex].role !== 'user') {
    userMessageIndex--;
  }

  if (userMessageIndex < 0) {
    return;
  }

  const precedingUserMessage = conversation.messages[userMessageIndex];

  const messagesToKeep = conversation.messages?.slice(0, userMessageIndex) || [];

  useChatStore.setState(state => {
    const conv = state.conversations.find((c: Conversation) => c.id === currentConversationId);
    if (conv) {
      conv.messages = messagesToKeep.map((msg, idx) => {
        if (idx === messagesToKeep.length - 1 && msg.role === 'user') {
          return { ...msg, status: 'sent' as const };
        }
        return msg;
      });
      conv.updated_at = Date.now();
    }
  });

  await handleSendMessage(precedingUserMessage.content);
}

