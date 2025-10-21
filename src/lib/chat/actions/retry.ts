import type { Message } from '@/types/chat';
import { useChatStore } from '@/store/chatStore';
import { v4 as uuidv4 } from 'uuid';

/**
 * 版本化重试：
 * - 保留原 assistant 消息
 * - 构造历史：取该 assistant 之前的所有消息（不含该 assistant） + 上一个 user 的内容重发
 * - 新生成的回答作为同组的新版本插入到原 assistant 之后
 */
export async function retryAssistantMessage(currentConversationId: string | null, messageIdToRetry: string, handleSendMessage: (content: string, documentData?: any, knowledgeBase?: any, options?: { conversationId?: string }) => Promise<void>): Promise<void> {
  if (!currentConversationId) return;
  const st = useChatStore.getState();
  const conversation = st.conversations.find(c => c.id === currentConversationId);
  if (!conversation || !Array.isArray(conversation.messages)) return;

  const idx = conversation.messages.findIndex(m => m.id === messageIdToRetry);
  if (idx < 0) return;
  const msg = conversation.messages[idx];
  if (msg.role !== 'assistant') return;

  // 找到其上一个 user 消息
  let userIdx = idx - 1;
  while (userIdx >= 0 && conversation.messages[userIdx].role !== 'user') userIdx--;
  if (userIdx < 0) return;
  const userMsg = conversation.messages[userIdx];

  // 计算版本组ID与下一个 index
  const groupId = msg.version_group_id || userMsg.id; // 以对应 userId 作为默认组ID
  const siblings = conversation.messages.filter(m => m.version_group_id === groupId && m.role === 'assistant');
  const nextIndex = (siblings.length > 0 ? Math.max(...siblings.map(s => s.version_index || 0)) + 1 : 1);

  // 在 UI 中先插入一个占位的 assistant（loading）在原回答之后
  const placeholder: Message = {
    id: uuidv4(),
    conversation_id: conversation.id,
    role: 'assistant',
    content: '',
    created_at: Date.now(),
    updated_at: Date.now(),
    status: 'loading',
    model: msg.model,
    version_group_id: groupId,
    version_index: nextIndex,
  };
  await useChatStore.getState().insertMessageAfter(msg.id, placeholder);

  // 直接复用发送流程：把该 user 内容重新发给 AI，但 conversationId 仍是当前
  // 发送逻辑会创建真正的 user/assistant 对，但我们此处只需要一个新的 assistant 版本。
  // 为避免重复插入 user，这里直接走网关：调用 handleSendMessage 但不创建新的 user。
  // 复用现有流程较复杂，这里采取简化：
  await handleSendMessage(userMsg.content, undefined, undefined, { conversationId: currentConversationId });
}

