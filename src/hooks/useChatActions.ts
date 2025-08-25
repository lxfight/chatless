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
import { exportConversationMarkdown } from '@/lib/chat/actions/download';
import { retryAssistantMessage } from '@/lib/chat/actions/retry';
import { runRagFlow } from '@/lib/chat/actions/ragFlow';
import { MessageAutoSaver } from '@/lib/chat/MessageAutoSaver';
import { ModelParametersService } from '@/lib/model-parameters';
import { ParameterPolicyEngine } from '@/lib/llm/ParameterPolicy';
import { usePromptStore } from '@/store/promptStore';
import { renderPromptContent } from '@/lib/prompt/render';
import { 
  generateTitleFromFirstMessage,
  isDefaultTitle,
  extractFirstUserMessageSeed,
  shouldGenerateTitleAfterAssistantComplete,
} from '@/lib/chat/TitleGenerator';

// type StoreMessage = any;

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

  // MCP 工具递归计数已迁移到 streamToolMiddleware

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
  
  // 全局计时器引用（未使用，移除以减噪）
  const genTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaverRef = useRef<MessageAutoSaver | null>(null);
  
  // 添加内容变化检测变量
  const lastSavedContentRef = useRef('');
  
  // 防抖状态引用移除，保持最小必要状态
  const debouncedTokenUpdateRef = useRef<NodeJS.Timeout | null>(null);
  const noop = useCallback((_: unknown = undefined) => {}, []);

  const navigateToSettings = useCallback((tab: string = 'localModels') => {
    router.push(`/settings?tab=${tab}`);
  }, [router]);

  // 将错误信息压缩为短文本，避免右下角提示过长
  const briefErrorText = useCallback((err: unknown, maxLen: number = 180): string => trimToastDescription(err, maxLen) || '', []);

  const checkApiKeyValidity = useCallback(async (_providerName: string, _modelId: string): Promise<boolean> => {
    return true;
  }, []);

  // 优化的批量更新函数
  const batchUpdateMessage = useCallback((messageId: string, content: string, thinking_start_time: number) => {
    // 立即更新UI状态，保证响应性
    currentContentRef.current = content;
    pendingContentRef.current = content;
    
    // 增加token计数
    batchUpdateRef.current.tokenCount++;
    
    // 调试日志移除以减少控制台噪音
    
    // 判断是否需要更新数据库
    const shouldUpdate = 
      batchUpdateRef.current.tokenCount >= 10 || // 每10个token更新一次
      Date.now() - batchUpdateRef.current.lastUpdateTime >= 2000; // 或每2秒更新一次
    
    if (shouldUpdate && !batchUpdateRef.current.pendingUpdate) {
      batchUpdateRef.current.pendingUpdate = true;
      batchUpdateRef.current.lastUpdateTime = Date.now();
      
      // 异步更新数据库
      void updateMessage(messageId, {
        content: content,
        thinking_start_time: thinking_start_time,
      }).then(() => {
        lastSavedContentRef.current = content;
        batchUpdateRef.current.tokenCount = 0;
        batchUpdateRef.current.pendingUpdate = false;
      }).catch((_error) => {
        // 静默失败，避免打断流
        batchUpdateRef.current.pendingUpdate = false;
      });
    } else if (shouldUpdate && batchUpdateRef.current.pendingUpdate) {
      // 跳过：已有更新在进行中
    } else {
      // 跳过：未满足触发条件
    }
  }, [updateMessage]);

  // 已移除未使用的防抖函数，避免无意义的闭包与告警

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
    if (timeDiff > 5000) {
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
    
    // const isCreatingNewConversation = !conversationId;
    if (!conversationId) {
      try {
        conversationId = await createConversation(`新对话 ${new Date().toLocaleTimeString()}`, modelToUse, currentProviderName);
      } catch {
        toast.error('创建对话失败', { description: '无法创建新的对话，请重试。' });
        return;
      }
    }

    const finalConversationId = conversationId;
    
    if (currentConversation?.model_id !== modelToUse && finalConversationId) {
      void updateConversation(finalConversationId, { model_id: modelToUse });
    }

    void setLastUsedModelForChat(finalConversationId, modelToUse);

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

    // 标题生成改为在首次 AI 回复完成后触发，避免并发与限流压力。

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
    // 为本次生成定义一个“流实例ID”，并在回调中校验，避免并发/二次流导致的串写
    const streamInstanceId = uuidv4();
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
      const handled = await runRagFlow({
        query: content,
        knowledgeBaseId: knowledgeBase.id,
        assistantMessageId,
        thinkingStartTime: thinking_start_time,
        currentContentRef,
        autoSaverRef,
        updateMessage,
        updateMessageContentInMemory,
        setTokenCount,
      });
      if (handled) return;
    }

    // 构建历史消息（含系统提示词 + MCP 上下文【混合模式】）
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
      // 使用独立模块进行 MCP 系统注入（带缓存与限流）
      try {
        const { buildMcpSystemInjections } = await import('@/lib/mcp/promptInjector');
        const injection = await buildMcpSystemInjections(content, currentConversationId || undefined);
        for (const m of injection.systemMessages) historyForLlm.push(m as any);
      } catch {
        // 忽略注入失败
      }
    } catch {
      // 忽略系统提示构建失败
    }
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

    // 调试信息已移除，避免控制台噪音

    // 构建一个按秒保存的自动保存器（在 onStart 时初始化）

    const streamCallbacks: StreamCallbacks = {
      onStart: () => {

        autoSaverRef.current = new MessageAutoSaver(async (latest) => {
          await updateMessage(assistantMessageId, {
            content: latest,
            thinking_start_time: thinking_start_time,
          });
        }, 1000);

        if (genTimeoutRef.current) clearTimeout(genTimeoutRef.current);
        genTimeoutRef.current = setInterval(() => {
          if (Date.now() - lastActivityTimeRef.current > 120000) {
            handleStopGeneration();
            void updateMessage(assistantMessageId, { status: 'error', content: '响应超时', thinking_duration: Math.floor((Date.now() - thinking_start_time) / 1000) });
            toast.error('响应超时', { description: '模型长时间未返回数据，请检查网络或模型服务状态。' });
            if (genTimeoutRef.current) clearInterval(genTimeoutRef.current);
          }
        }, 5000);
        setGenerationTimeout(genTimeoutRef.current);
      },
      onToken: (token) => {
        // 防串写保护：仅当仍然是当前流实例时才写入
        if ((streamCallbacks as any).__instanceId !== streamInstanceId) return;
        currentContentRef.current += token;
        lastActivityTimeRef.current = Date.now();
        
        // 性能监控
        performanceRef.current.tokenCount++;
        logPerformance();
        
        // 1) 立即更新内存与界面，保证流畅（若已冻结该消息，则不再追加普通文本，避免覆盖卡片）
        // 注意：onToken 不是 async，动态 import 会导致 await 报错。这里使用同步缓存门：
        try {
          // 以 require 风格同步加载（构建时会打包进来）
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const m = require('@/lib/mcp/streamToolMiddleware') as { isMessageFrozen: (id: string)=>boolean };
          if (!m.isMessageFrozen || !m.isMessageFrozen(assistantMessageId)) {
            updateMessageContentInMemory(assistantMessageId, currentContentRef.current);
          }
        } catch {
          updateMessageContentInMemory(assistantMessageId, currentContentRef.current);
        }
        setTokenCount(prev => prev + 1);
        // 2) 通知自动保存器按秒保存
        autoSaverRef.current?.update(currentContentRef.current);

        // 提前拦截：若首次检测到完整的 <tool_call>，立即插入“运行中”卡片并暂停 UI 的“继续往下讲”
        void (async () => {
          try {
            const { insertRunningToolCardIfDetected } = await import('@/lib/mcp/streamToolMiddleware');
            const inserted = await insertRunningToolCardIfDetected({
              assistantMessageId,
              conversationId: String(finalConversationId),
              currentContent: currentContentRef.current,
            });
            // 如果插入了运行中卡片，不做额外处理；UI 会等待 onComplete 时的替换
            if (inserted) { /* gate further speculative summaries */ }
          } catch (e) { noop(e); }
        })();
      },
      onComplete: () => {
        if ((streamCallbacks as any).__instanceId !== streamInstanceId) return;
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
        void autoSaverRef.current?.flush().finally(() => {
          // 最终一次确认状态 & 内容
          // 若在流式阶段已插入了工具卡片（被替换后的标记），不要被最终文本覆盖
          try {
            const st = useChatStore.getState();
            const conv = st.conversations.find(c => c.id === finalConversationId);
            const msg = conv?.messages.find(m => m.id === assistantMessageId);
            const hasCard = !!(msg?.content && msg.content.includes('"__tool_call_card__"'));
            const contentToPersist = hasCard ? (msg?.content || finalContent) : finalContent;
            void updateMessage(assistantMessageId, {
              content: contentToPersist,
              status: 'sent',
              thinking_start_time: thinking_start_time,
              thinking_duration: thinking_duration,
            });
          } catch {
            void updateMessage(assistantMessageId, {
              content: finalContent,
              status: 'sent',
              thinking_start_time: thinking_start_time,
              thinking_duration: thinking_duration,
            });
          }

          // 检测并执行 MCP 工具调用（文本协议 & 原生tools 双轨支持，先实现文本协议）
          void (async () => {
            try {
              const { handleToolCallOnComplete } = await import('@/lib/mcp/streamToolMiddleware');
              await handleToolCallOnComplete({
                assistantMessageId,
                conversationId: String(finalConversationId),
                finalContent,
                provider: currentProviderName,
                model: modelToUse,
                historyForLlm,
                originalUserContent: content,
              });
            } catch (e) { noop(e); }
          })();

          // 在首次 AI 回复完成后尝试生成标题（限流友好，不阻塞首条消息发送）。
          void (async () => {
            try {
              const state = useChatStore.getState();
              const conv = state.conversations.find(c => c.id === finalConversationId);
              if (!conv) return;
              const stillDefault = shouldGenerateTitleAfterAssistantComplete(conv);
              if (!stillDefault) return;

              // 由组件封装：提取首条用户消息作为种子
              const seedContent = extractFirstUserMessageSeed(conv);
              if (!seedContent.trim()) { return; }

              const gen = await generateTitleFromFirstMessage(
                currentProviderName,
                modelToUse,
                seedContent,
                { maxLength: 24, language: 'zh', fallbackPolicy: 'none' }
              );

              const state2 = useChatStore.getState();
              const conv2 = state2.conversations.find(c => c.id === finalConversationId);
              if (!conv2) return;
              if (isDefaultTitle(conv2.title) && gen && gen.trim()) {
                await state2.renameConversation(String(finalConversationId), gen.trim());
              }
            } catch (e) { noop(e); }
          })();
        });
        
        // 清理引用
        currentContentRef.current = '';
        setTokenCount(0);
      },
      onError: (error) => {
        if ((streamCallbacks as any).__instanceId !== streamInstanceId) return;
        if (genTimeoutRef.current) clearInterval(genTimeoutRef.current);
        if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
        setGenerationTimeout(null);

        const thinking_duration = Math.floor((Date.now() - thinking_start_time) / 1000);
        // 停止并尽量flush到最新，再标记错误
        autoSaverRef.current?.stop();
        void autoSaverRef.current?.flush().finally(() => {
          void updateMessage(assistantMessageId, {
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

    // 标记当前回调归属的流实例
    (streamCallbacks as any).__instanceId = streamInstanceId;

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
        // —— MCP 集成：附加当前会话启用的 MCP 服务器清单 ——
        try {
          const { getEnabledServersForConversation, getConnectedServers, getGlobalEnabledServers, getAllConfiguredServers } = await import('@/lib/mcp/chatIntegration');
          let enabled = currentConversationId ? await getEnabledServersForConversation(currentConversationId) : [];
          if (!enabled || enabled.length === 0) {
            const global = await getGlobalEnabledServers();
            if (global && global.length) enabled = global;
          }
          if (!enabled || enabled.length === 0) enabled = await getConnectedServers();
          // 将本条消息中的 @mcp 放到最前
          const mentionRe = /@([a-zA-Z0-9_-]{1,64})/g; const mentioned: string[] = []; let mm: RegExpExecArray | null;
          while ((mm = mentionRe.exec(content))) { const n = mm[1]; if (n && !mentioned.includes(n)) mentioned.push(n); }
          if (mentioned.length) {
            const all = await getAllConfiguredServers(); const map = new Map(all.map(n => [n.toLowerCase(), n] as const));
            const filtered = mentioned.map(n => map.get(n.toLowerCase())).filter(Boolean) as string[];
            if (filtered.length) enabled = Array.from(new Set<string>([...filtered, ...enabled]));
          }
          (patchedOptions as any).mcpServers = enabled || [];
        } catch {
          // 忽略获取启用服务器失败
        }
        // 强约束：始终使用“最后一次用户显式选择的 provider/model”成对调用
        try {
          const { specializedStorage } = await import('@/lib/storage');
          const lastPair = await specializedStorage.models.getLastSelectedModelPair();
          const effectiveProvider = lastPair?.modelId === modelToUse && lastPair?.provider ? lastPair.provider : currentProviderName;
          await streamChat(effectiveProvider, modelToUse, historyForLlm, streamCallbacks, patchedOptions);
        } catch {
          await streamChat(currentProviderName, modelToUse, historyForLlm, streamCallbacks, patchedOptions);
        }
      } catch {
        // 获取模型参数失败，降级为默认参数
        const patchedOptions = ParameterPolicyEngine.apply(currentProviderName, modelToUse, {});
        try {
          const { getEnabledServersForConversation, getConnectedServers, getGlobalEnabledServers, getAllConfiguredServers } = await import('@/lib/mcp/chatIntegration');
          let enabled = currentConversationId ? await getEnabledServersForConversation(currentConversationId) : [];
          if (!enabled || enabled.length === 0) {
            const global = await getGlobalEnabledServers();
            if (global && global.length) enabled = global;
          }
          if (!enabled || enabled.length === 0) enabled = await getConnectedServers();
          const mentionRe = /@([a-zA-Z0-9_-]{1,64})/g; const mentioned: string[] = []; let mm: RegExpExecArray | null;
          while ((mm = mentionRe.exec(content))) { const n = mm[1]; if (n && !mentioned.includes(n)) mentioned.push(n); }
          if (mentioned.length) {
            const all = await getAllConfiguredServers(); const map = new Map(all.map(n => [n.toLowerCase(), n] as const));
            const filtered = mentioned.map(n => map.get(n.toLowerCase())).filter(Boolean) as string[];
            if (filtered.length) enabled = Array.from(new Set<string>([...filtered, ...enabled]));
          }
          (patchedOptions as any).mcpServers = enabled || [];
        } catch {
          // 忽略获取启用服务器失败
        }
        try {
          const { specializedStorage } = await import('@/lib/storage');
          const lastPair = await specializedStorage.models.getLastSelectedModelPair();
          const effectiveProvider = lastPair?.modelId === modelToUse && lastPair?.provider ? lastPair.provider : currentProviderName;
          await streamChat(effectiveProvider, modelToUse, historyForLlm, streamCallbacks, patchedOptions);
        } catch {
          await streamChat(currentProviderName, modelToUse, historyForLlm, streamCallbacks, patchedOptions);
        }
      }
    } else {
       // 未选择模型
       void updateMessage(assistantMessageId, { status: 'error', content: "未选择模型", thinking_duration: 0 });
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
    try {
      cancelStream();
    } catch {
      // 取消流失败，忽略
    }
    
    // 停止并尽量落盘当前内容，防止丢尾部
    autoSaverRef.current?.stop();
    void autoSaverRef.current?.flush().catch(() => {}).finally(() => {
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
        
        void updateMessage(lastAssistantMessage.id, {
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
      void renameConversation(currentConversationId, newTitle);
    }
  }, [currentConversationId, renameConversation]);
  
  const handleDeleteConversation = useCallback(() => {
    if (currentConversationId) {
      void deleteConversation(currentConversationId);
    }
  }, [currentConversationId, deleteConversation]);

  const handleRetryMessage = useCallback(async (messageIdToRetry: string) => {
    await retryAssistantMessage(currentConversationId, messageIdToRetry, handleSendMessage);
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
              .catch(() => {});
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
  const handleShare = useCallback(() => {}, []);

  const handleDownload = useCallback(async () => {
    await exportConversationMarkdown(currentConversation ?? null, currentConversationId ?? null);
  }, [currentConversationId, currentConversation]);
  const handleImageUpload = useCallback((_file: File) => {}, []);
  const handleFileUpload = useCallback((_file: File) => {}, []);

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