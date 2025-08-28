import { toast } from '@/components/ui/sonner';
import type { Conversation } from '@/types/chat';
import { historyService } from '@/lib/historyService';
import { downloadService } from '@/lib/utils/downloadService';

export async function exportConversationMarkdown(currentConversation: Conversation | null, currentConversationId: string | null): Promise<void> {
  if (!currentConversationId || !currentConversation) {
    toast.error('暂无可导出的对话');
    return;
  }

  try {
    const markdown = await historyService.exportConversation(currentConversationId, 'markdown');
    if (!markdown) {
      toast.error('导出失败，请稍后重试');
      return;
    }

    const safeTitle = (currentConversation.title || 'chatless-conversation').replace(/[\\/:*?"<>|]/g, '_');
    const fileName = `${safeTitle}.md`;
    const success = await downloadService.downloadMarkdown(fileName, markdown);
    if (success) {
      toast.success('对话已成功导出');
    } else {
      toast.error('导出失败，请稍后重试');
    }
  } catch {
    toast.error('导出失败，请稍后重试');
  }
}

