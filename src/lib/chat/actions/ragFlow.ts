import { getRAGService } from '@/lib/rag/ragServiceInstance';

export async function runRagFlow(params: {
  query: string;
  knowledgeBaseId: string;
  assistantMessageId: string;
  thinkingStartTime: number;
  conversationId?: string; // 用于首轮完成后标题生成
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
    conversationId,
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
    
    // 直接设置完整答案，并同步写入结构化 segments（拆分 <think> 与正文），确保 UI 非流式也能渲染正确
    currentContentRef.current = result.answer;
    updateMessageContentInMemory(assistantMessageId, currentContentRef.current);
    try {
      const { useChatStore } = await import('@/store/chatStore');
      const st = useChatStore.getState();
      const conv = st.conversations.find(c=>Array.isArray((c as any).messages) && (c as any).messages.some((m:any)=>m.id===assistantMessageId));
      // 读取当前消息（仅用于确定会话存在，不直接使用）
      const _msg = conv ? (conv as any).messages.find((m:any)=>m.id===assistantMessageId) : undefined;
      const raw = String(currentContentRef.current || '');
      let thinkText = '';
      let bodyText = raw;
      const s = raw.indexOf('<think>');
      const e = raw.indexOf('</think>');
      if (s !== -1 && e !== -1 && e > s) {
        thinkText = raw.substring(s + 7, e);
        bodyText = (raw.substring(0, s) + raw.substring(e + 8)).trim();
      } else if (s !== -1 && e === -1) {
        thinkText = raw.substring(s + 7);
        bodyText = raw.substring(0, s).trim();
      }
      const nextSegs: any[] = [];
      if (thinkText && thinkText.trim()) nextSegs.push({ kind: 'think', text: thinkText });
      if (bodyText && bodyText.trim()) nextSegs.push({ kind: 'text', text: bodyText });
      st.setMessageSegmentsInMemory(assistantMessageId, nextSegs as any);
      void st.updateMessage(assistantMessageId, { segments: nextSegs });
    } catch { /* noop */ }
    
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
    // 首轮完成后异步生成标题（附加知识库期间也生效）
    try {
      const { useChatStore } = await import('@/store/chatStore');
      const st = useChatStore.getState();
      const finalConversationId = conversationId || (st.conversations.find(c=>Array.isArray((c as any).messages) && (c as any).messages.some((m:any)=>m.id===assistantMessageId))?.id);
      if (finalConversationId) {
        const { shouldGenerateTitleAfterAssistantComplete, extractFirstUserMessageSeed, isDefaultTitle } = await import('@/lib/chat/TitleGenerator');
        const { generateTitle } = await import('@/lib/chat/TitleService');
        const conv = st.conversations.find(c => c.id === finalConversationId);
        if (conv && shouldGenerateTitleAfterAssistantComplete(conv)) {
          const seed = extractFirstUserMessageSeed(conv);
          if (seed && seed.trim()) {
            const title = await generateTitle(provider, modelId, seed, { maxLength: 24, language: 'zh' });
            const st2 = useChatStore.getState();
            const conv2 = st2.conversations.find(c=>c.id===finalConversationId);
            if (conv2 && isDefaultTitle(conv2.title) && title && title.trim()) {
              void st2.renameConversation(String(finalConversationId), title.trim());
            }
          }
        }
      }
    } catch { /* noop */ }
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

