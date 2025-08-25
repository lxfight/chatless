import { MessageAutoSaver } from '@/lib/chat/MessageAutoSaver';
import { getRAGService } from '@/lib/rag/ragServiceInstance';

export async function runRagFlow(params: {
  query: string;
  knowledgeBaseId: string;
  assistantMessageId: string;
  thinkingStartTime: number;
  currentContentRef: { current: string };
  autoSaverRef: { current: MessageAutoSaver | null };
  updateMessage: (id: string, patch: any) => Promise<void>;
  updateMessageContentInMemory: (id: string, content: string) => void;
  setTokenCount: (updater: (v: number) => number) => void;
}): Promise<boolean> {
  const {
    query,
    knowledgeBaseId,
    assistantMessageId,
    thinkingStartTime,
    currentContentRef,
    autoSaverRef,
    updateMessage,
    updateMessageContentInMemory,
    setTokenCount,
  } = params;

  try {
    const ragService = await getRAGService();
    const ragStream = ragService.queryStream({
      query,
      knowledgeBaseIds: [knowledgeBaseId],
      topK: 5,
      similarityThreshold: 0.7,
    });

    autoSaverRef.current = new MessageAutoSaver(async (latest) => {
      await updateMessage(assistantMessageId, {
        content: latest,
        thinking_start_time: thinkingStartTime,
      });
    }, 1000);

    for await (const chunk of ragStream) {
      if (chunk.type === 'answer') {
        const token = chunk.data as string;
        currentContentRef.current += token;
        updateMessageContentInMemory(assistantMessageId, currentContentRef.current);
        setTokenCount(prev => prev + 1);
        autoSaverRef.current?.update(currentContentRef.current);
      } else if (chunk.type === 'error') {
        throw chunk.data as Error;
      }
    }

    autoSaverRef.current?.stop();
    await autoSaverRef.current?.flush();
    await updateMessage(assistantMessageId, {
      content: currentContentRef.current,
      status: 'sent',
      thinking_start_time: thinkingStartTime,
      thinking_duration: Math.floor((Date.now() - thinkingStartTime) / 1000),
    });
    autoSaverRef.current = null;
    return true;
  } catch (error) {
    autoSaverRef.current?.stop();
    await autoSaverRef.current?.flush();
    autoSaverRef.current = null;
    await updateMessage(assistantMessageId, {
      status: 'error',
      content: currentContentRef.current || (error instanceof Error ? error.message : 'RAG查询失败'),
      thinking_start_time: thinkingStartTime,
      thinking_duration: Math.floor((Date.now() - thinkingStartTime) / 1000),
    });
    return true;
  }
}

