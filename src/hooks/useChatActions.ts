// NOTE: 由于在聊天流程中集成 RAG 流式逻辑，临时超出 500 行限制。
// 后续可提取为专用 Hook 或工具文件以符合文件规模规范。
import { useCallback, useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { trimToastDescription } from '@/components/ui/sonner';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { useChatStore } from "@/store/chatStore";
import { 
  streamChat, 
  cancelStream, 
  type Message as LlmMessage,
  StreamCallbacks
} from '@/lib/llm';
import type { Message, Conversation } from "@/types/chat";
import { getDatabaseService } from "@/lib/db";
import { getRAGService } from '@/lib/rag/ragServiceInstance';
import { historyService } from '@/lib/historyService';
import { downloadService } from '@/lib/utils/downloadService';
import { MessageAutoSaver } from '@/lib/chat/MessageAutoSaver';
import { ModelParametersService } from '@/lib/model-parameters';
import { ParameterPolicyEngine } from '@/lib/llm/ParameterPolicy';
import { usePromptStore } from '@/store/promptStore';
import { renderPromptContent } from '@/lib/prompt/render';

type StoreMessage = any;

export const useChatActions = (selectedModelId: string | null, currentProviderName: string, sessionParameters?: any) => {
  const router = useRouter();
  const currentConversationId = useChatStore((state) => state.currentConversationId);
  const currentConversation = useChatStore((state) => 
    currentConversationId ? state.conversations.find(c => c.id === currentConversationId) : null
  );
  
  const addMessage = useChatStore((state) => state.addMessage);
  const updateMessage = useChatStore((state) => state.updateMessage);
  const updateMessageContentInMemory = useChatStore((state) => state.updateMessageContentInMemory);
  const updateConversation = useChatStore((state) => state.updateConversation);
  const renameConversation = useChatStore((state) => state.renameConversation);
  const deleteConversation = useChatStore((state) => state.deleteConversation);
  const createConversation = useChatStore((state) => state.createConversation);
  const setLastUsedModelForChat = useChatStore((state) => state.setLastUsedModelForChat);
  
  // 添加滚动到底部的回调函数
  const scrollToBottomRef = useRef<(() => void) | null>(null);
  
  // 设置滚动回调函数
  const setScrollToBottomCallback = useCallback((callback: () => void) => {
    scrollToBottomRef.current = callback;
  }, []);
  
  const isGenerating = useChatStore((state) => {
    const current = state.conversations.find(c => c.id === state.currentConversationId);
    return current?.messages?.some(m => m.status === 'loading') ?? false;
  });

  const [generationTimeout, setGenerationTimeout] = useState<NodeJS.Timeout | null>(null);
  const lastActivityTimeRef = useRef<number>(Date.now());
  const [isStale, setIsStale] = useState(false);
  
  const isLoading = isGenerating && !isStale;

  // 优化的流式更新状态管理
  const currentContentRef = useRef<string>('');
  const pendingContentRef = useRef<string>('');
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [tokenCount, setTokenCount] = useState(0);
  
  // 批量更新机制
  const batchUpdateRef = useRef<{
    tokenCount: number;
    lastUpdateTime: number;
    pendingUpdate: boolean;
  }>({
    tokenCount: 0,
    lastUpdateTime: 0,
    pendingUpdate: false
  });
  
  // 全局计时器引用，便于随时清理
  const renderIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const genTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaverRef = useRef<MessageAutoSaver | null>(null);
  
  // 添加内容变化检测变量
  const lastSavedContentRef = useRef('');
  
  // 防抖更新UI状态
  const debouncedTokenUpdateRef = useRef<NodeJS.Timeout | null>(null);
  const lastTokenUpdateTimeRef = useRef(0);

  const navigateToSettings = useCallback((tab: string = 'localModels') => {
    router.push(`/settings?tab=${tab}`);
  }, [router]);

  // 将错误信息压缩为短文本，避免右下角提示过长
  const briefErrorText = useCallback((err: unknown, maxLen: number = 180): string => trimToastDescription(err, maxLen) || '', []);

  const checkApiKeyValidity = useCallback(async (providerName: string, modelId: string): Promise<boolean> => {
    return true;
  }, []);

  // 优化的批量更新函数
  const batchUpdateMessage = useCallback((messageId: string, content: string, thinking_start_time: number) => {
    // 立即更新UI状态，保证响应性
    currentContentRef.current = content;
    pendingContentRef.current = content;
    
    // 增加token计数
    batchUpdateRef.current.tokenCount++;
    
    // 添加调试日志
    console.log(`[BATCH-UPDATE] Token count: ${batchUpdateRef.current.tokenCount}, Pending: ${batchUpdateRef.current.pendingUpdate}`);
    
    // 判断是否需要更新数据库
    const shouldUpdate = 
      batchUpdateRef.current.tokenCount >= 10 || // 每10个token更新一次
      Date.now() - batchUpdateRef.current.lastUpdateTime >= 2000; // 或每2秒更新一次
    
    if (shouldUpdate && !batchUpdateRef.current.pendingUpdate) {
      console.log(`[BATCH-UPDATE] Triggering database update after ${batchUpdateRef.current.tokenCount} tokens`);
      batchUpdateRef.current.pendingUpdate = true;
      batchUpdateRef.current.lastUpdateTime = Date.now();
      
      // 异步更新数据库
      updateMessage(messageId, {
        content: content,
        thinking_start_time: thinking_start_time,
      }).then(() => {
        console.log(`[BATCH-UPDATE] Database update completed successfully`);
        lastSavedContentRef.current = content;
        batchUpdateRef.current.tokenCount = 0;
        batchUpdateRef.current.pendingUpdate = false;
      }).catch((error) => {
        console.error('[BATCH-UPDATE] Database update failed:', error);
        batchUpdateRef.current.pendingUpdate = false;
      });
    } else if (shouldUpdate && batchUpdateRef.current.pendingUpdate) {
      console.log(`[BATCH-UPDATE] Skipping update - pending update in progress`);
    } else {
      console.log(`[BATCH-UPDATE] Skipping update - conditions not met (count: ${batchUpdateRef.current.tokenCount}, time: ${Date.now() - batchUpdateRef.current.lastUpdateTime}ms)`);
    }
  }, [updateMessage]);

  // 防抖的UI状态更新函数
  const debouncedTokenUpdate = useCallback(() => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastTokenUpdateTimeRef.current;
    
    // 性能监控
    performanceRef.current.updateCount++;
    
    // 如果距离上次更新不到50ms，则防抖
    if (timeSinceLastUpdate < 50) {
      if (debouncedTokenUpdateRef.current) {
        clearTimeout(debouncedTokenUpdateRef.current);
      }
      debouncedTokenUpdateRef.current = setTimeout(() => {
        setTokenCount(prev => prev + 1);
        lastTokenUpdateTimeRef.current = Date.now();
      }, 50 - timeSinceLastUpdate);
    } else {
      // 直接更新
      setTokenCount(prev => prev + 1);
      lastTokenUpdateTimeRef.current = now;
    }
  }, []);

  // 性能监控
  const performanceRef = useRef({
    tokenCount: 0,
    updateCount: 0,
    lastUpdateTime: Date.now()
  });

  // 性能监控函数
  const logPerformance = useCallback(() => {
    const now = Date.now();
    const timeDiff = now - performanceRef.current.lastUpdateTime;
    if (timeDiff > 5000) { // 每5秒记录一次
      console.log(`[PERFORMANCE] Tokens: ${performanceRef.current.tokenCount}, Updates: ${performanceRef.current.updateCount}, Time: ${timeDiff}ms`);
      performanceRef.current = {
        tokenCount: 0,
        updateCount: 0,
        lastUpdateTime: now
      };
    }
  }, []);

  const handleSendMessage = useCallback(async (
    content: string, 
    documentData?: { 
      documentReference: { 
        fileName: string; 
        fileType: string; 
        fileSize: number; 
        summary: string 
      }; 
      contextData: string 
    },
    knowledgeBase?: { id: string; name: string },
    options?: { conversation?: Conversation, conversationId?: string, images?: string[] }
  ) => {
    const modelToUse = selectedModelId;
    if (!modelToUse) {
      toast.error('请先选择一个AI模型', {
        description: '点击此处前往设置页面选择模型',
        action: {
          label: '前往设置',
          onClick: () => navigateToSettings('localModels')
        }
      });
      return;
    }
    
    if (!currentProviderName) {
      toast.error('模型提供商信息丢失', {
        description: '无法确定当前模型所属的提供商，请重新选择模型。',
      });
      return;
    }

    const apiKeyValid = await checkApiKeyValidity(currentProviderName, modelToUse);
    if (!apiKeyValid) {
      toast.error('API密钥无效', {
        description: '请前往设置页面配置有效的API密钥',
        action: {
          label: '前往设置',
          onClick: () => navigateToSettings('localModels')
        }
      });
      return;
    }

    // 重置流式更新状态
    currentContentRef.current = '';
    pendingContentRef.current = '';
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    setTokenCount(0);
    
    // 重置批量更新状态
    batchUpdateRef.current = {
      tokenCount: 0,
      lastUpdateTime: 0,
      pendingUpdate: false
    };

    let conversationId = options?.conversationId || currentConversationId;
    
    if (!conversationId) {
      try {
        conversationId = await createConversation(`新对话 ${new Date().toLocaleTimeString()}`, modelToUse, currentProviderName);
      } catch (error) {
        console.error("Failed to create conversation:", error);
        toast.error('创建对话失败', { description: '无法创建新的对话，请重试。' });
        return;
      }
    }

    const finalConversationId = conversationId;
    
    if (currentConversation?.model_id !== modelToUse && finalConversationId) {
      updateConversation(finalConversationId, { model_id: modelToUse });
    }

    setLastUsedModelForChat(finalConversationId, modelToUse);

    const now = Date.now();
    const userMessageId = uuidv4();
    const newMessage: Message = {
      id: userMessageId,
      conversation_id: finalConversationId,
      role: 'user',
      content,
      created_at: now,
      updated_at: now,
      status: 'sent',
      model: modelToUse,
      document_reference: documentData?.documentReference,
      context_data: documentData?.contextData,
      knowledge_base_reference: knowledgeBase,
      images: options?.images
    };
    await addMessage(newMessage);

    // 发送消息后立即滚动到底部
    if (scrollToBottomRef.current) {
      // 使用 setTimeout 确保 DOM 更新完成后再滚动
      setTimeout(() => {
        scrollToBottomRef.current?.();
      }, 0);
      
      // 额外确保滚动到底部，防止某些情况下滚动失败
      setTimeout(() => {
        scrollToBottomRef.current?.();
      }, 100);
    }

    const thinking_start_time = Date.now();
    const assistantMessageId = uuidv4();
    const assistantMessage: Message = {
      id: assistantMessageId,
      conversation_id: finalConversationId,
      role: 'assistant',
      content: '',
      created_at: now,
      updated_at: now,
      status: 'loading',
      model: modelToUse,
      thinking_start_time: thinking_start_time,
    };
    await addMessage(assistantMessage);

    // 如果选择了知识库，则优先走 RAG 流程
    if (knowledgeBase) {
      try {
        const ragService = await getRAGService();
        const ragStream = ragService.queryStream({
          query: content,
          knowledgeBaseIds: [knowledgeBase.id],
          topK: 5,
          similarityThreshold: 0.7,
        });

        // 为 RAG 流初始化自动保存器
        autoSaverRef.current = new MessageAutoSaver(async (latest) => {
          await updateMessage(assistantMessageId, {
            content: latest,
            thinking_start_time: thinking_start_time,
          });
        }, 1000);

        for await (const chunk of ragStream) {
          if (chunk.type === 'answer') {
            const token = chunk.data as string;
            currentContentRef.current += token;
            pendingContentRef.current = currentContentRef.current;

            // 即时内存更新 + UI 流畅
            updateMessageContentInMemory(assistantMessageId, currentContentRef.current);
            setTokenCount(prev => prev + 1);
            // 定时保存
            autoSaverRef.current?.update(currentContentRef.current);
          } else if (chunk.type === 'error') {
            throw chunk.data as Error;
          }
        }

        // 强制flush并最终落盘
        autoSaverRef.current?.stop();
        await autoSaverRef.current?.flush();
        await updateMessage(assistantMessageId, {
          content: currentContentRef.current,
          status: 'sent',
          thinking_start_time: thinking_start_time,
          thinking_duration: Math.floor((Date.now() - thinking_start_time) / 1000),
        });
        autoSaverRef.current = null;
        return;
      } catch (error) {
        console.error('RAG query failed:', error);
        autoSaverRef.current?.stop();
        await autoSaverRef.current?.flush();
        autoSaverRef.current = null;
        await updateMessage(assistantMessageId, {
          status: 'error',
          content: currentContentRef.current || (error instanceof Error ? error.message : 'RAG查询失败'),
          thinking_start_time: thinking_start_time,
          thinking_duration: Math.floor((Date.now() - thinking_start_time) / 1000),
        });
        return;
      }
    }

    // 构建历史消息（含系统提示词）
    const historyForLlm: LlmMessage[] = [];
    try {
      const conv = currentConversationId ? useChatStore.getState().conversations.find((c:any)=>c.id===currentConversationId) : null;
      const applied = conv?.system_prompt_applied;
      if (applied?.promptId) {
        const prompt = usePromptStore.getState().prompts.find((p:any)=>p.id===applied.promptId);
        if (prompt) {
          const rendered = renderPromptContent(prompt.content, applied.variableValues);
          if (rendered && rendered.trim()) {
            historyForLlm.push({ role: 'system', content: rendered } as any);
          }
        }
      }
    } catch {}
    if (currentConversation?.messages) {
      // 只取最近的几条消息，避免上下文过长
      const recentMessages = currentConversation.messages.slice(-10);
      for (const msg of recentMessages) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          historyForLlm.push({
            role: msg.role,
            content: msg.content || '',
            images: msg.images
          });
        }
      }
    }
    historyForLlm.push({ 
      role: 'user', 
      content,
      images: options?.images
    });

    // 调试日志：在开发环境打印即将发送给 LLM 的 system 提示词与历史长度
    try {
      if (process.env.NODE_ENV !== 'production') {
        const systemMsg = historyForLlm.find((m: any) => m.role === 'system');
        const sysPreview = systemMsg?.content ? String(systemMsg.content).slice(0, 500) : '(none)';
        // 使用 console.debug 避免在普通日志中过于显眼
        console.debug('[LLM Debug] system message preview:', sysPreview);
        console.debug('[LLM Debug] history length:', historyForLlm.length);
      }
    } catch {}

    // 构建一个按秒保存的自动保存器（在 onStart 时初始化）

    const streamCallbacks: StreamCallbacks = {
      onStart: () => {
        console.log(`[useChatActions] Starting stream for model: ${modelToUse}`);

        autoSaverRef.current = new MessageAutoSaver(async (latest) => {
          await updateMessage(assistantMessageId, {
            content: latest,
            thinking_start_time: thinking_start_time,
          });
        }, 1000);

        if (genTimeoutRef.current) clearTimeout(genTimeoutRef.current);
        genTimeoutRef.current = setInterval(() => {
          if (Date.now() - lastActivityTimeRef.current > 120000) {
            console.warn('Generation timed out due to inactivity.');
            handleStopGeneration();
            updateMessage(assistantMessageId, { status: 'error', content: '响应超时', thinking_duration: Math.floor((Date.now() - thinking_start_time) / 1000) });
          toast.error('响应超时', { description: '模型长时间未返回数据，请检查网络或模型服务状态。' });
            if (genTimeoutRef.current) clearInterval(genTimeoutRef.current);
          }
        }, 5000);
        setGenerationTimeout(genTimeoutRef.current);
      },
      onToken: (token) => {
        currentContentRef.current += token;
        lastActivityTimeRef.current = Date.now();
        
        // 性能监控
        performanceRef.current.tokenCount++;
        logPerformance();
        
        // 1) 立即更新内存与界面，保证流畅
        updateMessageContentInMemory(assistantMessageId, currentContentRef.current);
        setTokenCount(prev => prev + 1);
        // 2) 通知自动保存器按秒保存
        autoSaverRef.current?.update(currentContentRef.current);
      },
      onComplete: () => {
        if (genTimeoutRef.current) clearInterval(genTimeoutRef.current);
        if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
        setGenerationTimeout(null);

        // 强制保存最终内容
        const finalContent = currentContentRef.current;
        const thinking_duration = Math.floor((Date.now() - thinking_start_time) / 1000);
        
        // 先更新UI状态
        setTokenCount(prev => prev + 1);
        // 内存中已是最新，先停止自动保存并flush，避免定时器晚到覆盖
        autoSaverRef.current?.stop();
        autoSaverRef.current?.flush().finally(() => {
          // 最终一次确认状态 & 内容
          updateMessage(assistantMessageId, {
            content: finalContent,
            status: 'sent',
            thinking_start_time: thinking_start_time,
            thinking_duration: thinking_duration,
          });
        });
        
        // 清理引用
        currentContentRef.current = '';
        setTokenCount(0);
      },
      onError: (error) => {
        console.error("streamChat promise rejected:", error);
        if (genTimeoutRef.current) clearInterval(genTimeoutRef.current);
        if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
        setGenerationTimeout(null);

        const thinking_duration = Math.floor((Date.now() - thinking_start_time) / 1000);
        // 停止并尽量flush到最新，再标记错误
        autoSaverRef.current?.stop();
        autoSaverRef.current?.flush().finally(() => {
          updateMessage(assistantMessageId, {
            status: 'error',
            content:
              currentContentRef.current
                || (error as any)?.userMessage
                || (error instanceof Error ? error.message : (typeof error === 'string' ? error : JSON.stringify(error)))
                || '发生未知错误',
            thinking_start_time: thinking_start_time,
            thinking_duration: thinking_duration,
          });
        });
        
        // 清理引用
        currentContentRef.current = '';
        setTokenCount(0);
        autoSaverRef.current = null;
        
        const code = (error as any)?.code || (typeof error?.message === 'string' && error.message);
        if (code === 'NO_KEY') {
          toast.error('未配置 API 密钥', {
            description:
              (error as any)?.userMessage || '请在“设置 → 模型与Provider”中为当前 Provider 或模型配置密钥后重试。',
          });
        } else {
          toast.error('发生错误', {
            description: (error as any)?.userMessage || briefErrorText(error) || '与AI模型的通信失败。',
          });
        }
      },
    };

    if (modelToUse) {
      // 参数优先级：会话参数 > 模型默认参数 > 系统默认参数
      let chatOptions = {};
      
      try {
        if (sessionParameters) {
          // 会话参数（仅改动项）
          chatOptions = ModelParametersService.convertToChatOptions(sessionParameters);
        } else {
          // 无会话参数：不下发通用参数，但允许策略引擎注入“模型级默认/必要高级参数”
          chatOptions = {};
        }
        
        // 始终走策略引擎，让模型级必要参数（如 Gemini 的 thinkingBudget）按规则注入
        const patchedOptions = ParameterPolicyEngine.apply(currentProviderName, modelToUse, chatOptions);
        streamChat(currentProviderName, modelToUse, historyForLlm, streamCallbacks, patchedOptions).catch(err => console.error("streamChat promise rejected:", err));
      } catch (error) {
        console.error('获取模型参数失败，使用默认参数:', error);
        const patchedOptions = ParameterPolicyEngine.apply(currentProviderName, modelToUse, {});
        streamChat(currentProviderName, modelToUse, historyForLlm, streamCallbacks, patchedOptions).catch(err => console.error("streamChat promise rejected:", err));
      }
    } else {
       console.error("No model selected, cannot start chat.");
       updateMessage(assistantMessageId, { status: 'error', content: "未选择模型", thinking_duration: 0 });
       toast.error('未选择模型', { description: "在发送消息前，请先在顶部选择一个AI模型。" });
    }
  }, [selectedModelId, currentProviderName, sessionParameters, currentConversationId, currentConversation, createConversation, updateConversation, setLastUsedModelForChat, addMessage, updateMessage, navigateToSettings, checkApiKeyValidity, batchUpdateMessage]);
  
  const handleEmptyStatePromptClick = useCallback(async (prompt: string) => {
    if (!selectedModelId) {
      toast.error('请先选择一个模型', {
        description: '点击此处前往设置页面选择模型',
        action: { label: '前往设置', onClick: () => navigateToSettings('localModels') }
      });
      return;
    }
    const apiKeyValid = await checkApiKeyValidity(currentProviderName, selectedModelId);
    if (!apiKeyValid) {
      toast.error('API密钥无效', {
        description: '请前往设置页面配置有效的API密钥',
        action: { label: '前往设置', onClick: () => navigateToSettings('localModels') }
      });
      return;
    }
    await handleSendMessage(prompt);
  }, [selectedModelId, currentProviderName, handleSendMessage, checkApiKeyValidity, navigateToSettings]);

  const handleStopGeneration = useCallback(() => {
    console.log("[useChatActions] Stopping generation...");
    try {
      cancelStream();
    } catch (error) {
      console.error("Error canceling stream:", error);
    }
    
    // 停止并尽量落盘当前内容，防止丢尾部
    autoSaverRef.current?.stop();
    autoSaverRef.current?.flush().catch(() => {}).finally(() => {
      autoSaverRef.current = null;
    });

    // 清理所有定时器
    if (genTimeoutRef.current) clearInterval(genTimeoutRef.current);
    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    if (debouncedTokenUpdateRef.current) clearTimeout(debouncedTokenUpdateRef.current);
    setGenerationTimeout(null);
    
    // 清理引用
    currentContentRef.current = '';
    setTokenCount(0);
    
    // 更新当前消息状态为已停止
    if (currentConversation?.messages) {
      const lastAssistantMessage = currentConversation.messages
        .filter((msg: Message) => msg.role === 'assistant')
        .pop();
      
      if (lastAssistantMessage && lastAssistantMessage.status === 'loading') {
        const thinking_duration = lastAssistantMessage.thinking_start_time 
          ? Math.floor((Date.now() - lastAssistantMessage.thinking_start_time) / 1000)
          : 0;
        
        updateMessage(lastAssistantMessage.id, {
          status: 'error',
          content: lastAssistantMessage.content + '\n\n[用户停止了生成]',
          thinking_duration: thinking_duration,
        });
      }
    }
  }, [currentConversation, updateMessage]);

  // 清理函数
  useEffect(() => {
    return () => {
      if (genTimeoutRef.current) clearInterval(genTimeoutRef.current);
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
      if (debouncedTokenUpdateRef.current) clearTimeout(debouncedTokenUpdateRef.current);
    };
  }, []);

  const handleTitleChange = useCallback((newTitle: string) => {
    if (currentConversationId && newTitle && newTitle.trim() !== '') {
      renameConversation(currentConversationId, newTitle);
    }
  }, [currentConversationId, renameConversation]);
  
  const handleDeleteConversation = useCallback(() => {
    if (currentConversationId) {
      deleteConversation(currentConversationId);
    }
  }, [currentConversationId, deleteConversation]);

  const handleRetryMessage = useCallback(async (messageIdToRetry: string) => {
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
      console.warn('[handleRetryMessage] 未找到对应的用户消息，无法重新生成');
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
  }, [currentConversationId, handleSendMessage]);

  useEffect(() => {
    if (isGenerating) {
      setIsStale(false);
      lastActivityTimeRef.current = Date.now();
      
      if (generationTimeout) clearTimeout(generationTimeout);
      
      const timeout = setTimeout(() => {
        if (Date.now() - lastActivityTimeRef.current > 120000) {
          setIsStale(true);
          const currentState = useChatStore.getState();
          const current = currentState.conversations.find(c => c.id === currentState.currentConversationId);
          const loadingMessage = current?.messages?.find(m => m.status === 'loading');
          
          if (loadingMessage) {
            const content = currentContentRef.current || '';
            currentState.finalizeStreamedMessage(loadingMessage.id, 'aborted', content, loadingMessage.model)
              .catch(err => console.error("[Timeout] Failed to update message status:", err));
          }
        }
      }, 120000);
      setGenerationTimeout(timeout);
    } else {
      if (generationTimeout) {
        clearTimeout(generationTimeout);
        setGenerationTimeout(null);
      }
      setIsStale(false);
    }
    
    return () => {
      if (generationTimeout) clearTimeout(generationTimeout);
    };
  }, [isGenerating]);

  // Placeholder handler for share（仍待实现）
  const handleShare = useCallback(() => console.log('Share clicked'), []);

  /**
   * 导出当前会话为 Markdown 并触发下载
   */
  const handleDownload = useCallback(async () => {
    if (!currentConversationId || !currentConversation) {
      toast.error('暂无可导出的对话');
      return;
    }

    try {
      // 调用 historyService 生成 Markdown 内容
      const markdown = await historyService.exportConversation(currentConversationId, 'markdown');

      if (!markdown) {
        toast.error('导出失败，请稍后重试');
        return;
      }

      // 处理文件名中的非法字符
      const safeTitle = (currentConversation.title || 'chatless-conversation').replace(/[\\/:*?"<>|]/g, '_');
      const fileName = `${safeTitle}.md`;

      const success = await downloadService.downloadMarkdown(fileName, markdown);

      if (success) {
        toast.success('对话已成功导出');
      } else {
        toast.error('导出失败，请稍后重试');
      }
    } catch (error) {
      console.error('[handleDownload] 导出对话失败', error);
      toast.error('导出失败，请查看控制台详情');
    }
  }, [currentConversationId, currentConversation]);
  const handleImageUpload = useCallback((file: File) => console.log('Image uploaded:', file.name), []);
  const handleFileUpload = useCallback((file: File) => console.log('File uploaded:', file.name), []);

  return {
    isLoading,
    isGenerating,
    handleSendMessage,
    handleStopGeneration,
    handleEmptyStatePromptClick,
    handleTitleChange,
    handleDeleteConversation,
    handleRetryMessage,
    handleShare,
    handleDownload,
    handleImageUpload,
    handleFileUpload,
    tokenCount,
    setScrollToBottomCallback,
  };
}; 