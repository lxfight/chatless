import { getRAGService } from '@/lib/rag/ragServiceInstance';

export async function runRagFlow(params: {
  query: string;
  knowledgeBaseId: string;
  assistantMessageId: string;
  thinkingStartTime: number;
  currentContentRef: { current: string };
  updateMessage: (id: string, patch: any) => Promise<void>;
  updateMessageContentInMemory: (id: string, content: string) => void;
  setTokenCount: (updater: (v: number) => number) => void;
  // LLM配置参数
  modelId: string;
  provider: string;
  apiKey?: string;
}): Promise<boolean> {
  const {
    query,
    knowledgeBaseId,
    assistantMessageId,
    thinkingStartTime,
    currentContentRef,
    updateMessage,
    updateMessageContentInMemory,
    setTokenCount,
    modelId,
    provider,
    apiKey,
  } = params;

  try {
    console.log('[RAG] 开始RAG流程:', { query, knowledgeBaseId, modelId, provider });
    const ragService = await getRAGService();
    
    // 更新RAG服务的LLM配置
    ragService.updateLLMConfig({
      provider,
      model: modelId,
      apiKey
    });
    
    console.log('[RAG] RAG服务已初始化，开始非流式查询');

    // 使用非流式查询，简化实现
    const result = await ragService.query({
      query,
      knowledgeBaseIds: [knowledgeBaseId],
      topK: 4,
      similarityThreshold: 0.3, // 降低相似度阈值从0.7到0.3
    });

    console.log('[RAG] 查询完成，答案长度:', result.answer.length);
    
    // 直接设置完整答案
    currentContentRef.current = result.answer;
    updateMessageContentInMemory(assistantMessageId, currentContentRef.current);
    
    // 模拟token计数（估算）
    const estimatedTokens = Math.ceil(result.answer.length / 4);
    setTokenCount(() => estimatedTokens);
    console.log('[RAG] RAG流程完成，最终内容长度:', currentContentRef.current.length);
    await updateMessage(assistantMessageId, {
      content: currentContentRef.current,
      status: 'sent',
      thinking_start_time: thinkingStartTime,
      thinking_duration: Math.floor((Date.now() - thinkingStartTime) / 1000),
    });
    return true;
  } catch (error) {
    console.error('[RAG] RAG流程出错:', error);
    await updateMessage(assistantMessageId, {
      status: 'error',
      content: currentContentRef.current || (error instanceof Error ? error.message : 'RAG查询失败'),
      thinking_start_time: thinkingStartTime,
      thinking_duration: Math.floor((Date.now() - thinkingStartTime) / 1000),
    });
    return true;
  }
}

