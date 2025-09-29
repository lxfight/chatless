// 调试期间保留有限 console，勿全局禁用 no-console
// NOTE: 由于在聊天流程中集成 RAG 流式逻辑，临时超出 500 行限制。
// 后续可提取为专用 Hook 或工具文件以符合文件规模规范。
import { useCallback, useState, useRef, useEffect } from 'react';
import { toast, trimToastDescription } from '@/components/ui/sonner';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { useChatStore } from "@/store/chatStore";
import { cancelStream, type Message as LlmMessage, StreamCallbacks } from '@/lib/llm';
import { ChatGateway } from '@/lib/chat/ChatGateway';
import { HistoryBuilder } from '@/lib/chat/HistoryBuilder';
import type { Message, Conversation } from "@/types/chat";
import { exportConversationMarkdown } from '@/lib/chat/actions/download';
import { retryAssistantMessage } from '@/lib/chat/actions/retry';
import { runRagFlow } from '@/lib/chat/actions/ragFlow';
import { MessageAutoSaver } from '@/lib/chat/MessageAutoSaver';
import { ModelParametersService } from '@/lib/model-parameters';
import { composeChatOptions } from '@/lib/chat/OptionComposer';
import { usePromptStore } from '@/store/promptStore';
import { renderPromptContent } from '@/lib/prompt/render';
// 动态导入 Title 相关函数，避免静态未用告警

// type StoreMessage = any;

export const useChatActions = (selectedModelId: string | null, currentProviderName: string, sessionParameters?: any) => {
  const router = useRouter();
  const currentConversationId = useChatStore((state) => state.currentConversationId);
  const currentConversation = useChatStore((state) => 
    currentConversationId ? state.conversations.find(c => c.id === currentConversationId) : null
  );
  
  const addMessage = useChatStore((state) => state.addMessage);
  const updateMessage = useChatStore((state) => state.updateMessage);
  const deleteMessage = useChatStore((state) => state.deleteMessage);
  const updateMessageContentInMemory = useChatStore((state) => state.updateMessageContentInMemory);
  const updateConversation = useChatStore((state) => state.updateConversation);
  const setInputDraft = useChatStore((s)=>s.setInputDraft);
  const notifyStreamStart = useChatStore((s)=>s.notifyStreamStart);
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

  const navigateToSettings = useCallback((tab: string = 'localModels') => {
    router.push(`/settings?tab=${tab}`);
  }, [router]);

  // 将错误信息压缩为短文本，避免右下角提示过长
  const briefErrorText = useCallback((err: unknown, maxLen: number = 180): string => trimToastDescription(err, maxLen) || '', []);

  const checkApiKeyValidity = useCallback(async (providerName: string, modelId: string): Promise<boolean> => {
    try {
      // 获取provider配置信息
      const { providerRepository } = await import('@/lib/provider/ProviderRepository');
      const providers = await providerRepository.getAll();
      const provider = providers.find(p => p.name === providerName);
      
      if (!provider) {
        console.warn(`Provider ${providerName} not found`);
        return false;
      }
      
      // 如果provider不需要密钥，直接返回true
      if (!provider.requiresKey) {
        return true;
      }
      
      // 如果provider需要密钥，检查是否有有效的API密钥
      const { KeyManager } = await import('@/lib/llm/KeyManager');
      
      // 先检查模型级别的API密钥
      const modelKey = await KeyManager.getModelKey(providerName, modelId);
      if (modelKey && modelKey.trim()) {
        return true;
      }
      
      // 再检查provider级别的API密钥
      const providerKey = await KeyManager.getProviderKey(providerName);
      if (providerKey && providerKey.trim()) {
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking API key validity:', error);
      return false;
    }
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

    // —— 统一计算本次会话应当使用的 Provider ——
    let effectiveProvider = currentProviderName;
    try {
      const { specializedStorage } = await import('@/lib/storage');
      const lastPair = await specializedStorage.models.getLastSelectedModelPair();
      if (lastPair && lastPair.modelId === modelToUse && lastPair.provider) {
        effectiveProvider = lastPair.provider;
      }
    } catch { /* ignore, fallback to currentProviderName */ }

    const apiKeyValid = await checkApiKeyValidity(effectiveProvider, modelToUse);
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

    // 重置流式更新状态（仅内部缓存）。tokenCount 在 onStart 开始流时再置零，避免提前清零影响可视化
    currentContentRef.current = '';
    pendingContentRef.current = '';
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
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
        conversationId = await createConversation(`新对话 ${new Date().toLocaleTimeString()}`, modelToUse, effectiveProvider);
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

    // 尝试在 Provider 串起流之前，做一次“必需条件”的同步校验，例如 API Key
    try {
      const ok = await checkApiKeyValidity(effectiveProvider, modelToUse);
      if (!ok) {
        // 模拟 onError 早失败：删除AI占位与用户消息并回填
        void deleteMessage(assistantMessageId);
        void deleteMessage(userMessageId);
        try { if (finalConversationId) setInputDraft(finalConversationId, content); } catch { /* noop */ }
        toast.error('未配置 API 密钥', { description: '请在设置中配置有效的密钥后重试。' });
        return;
      }
    } catch { /* 若校验不可用则继续，让 Provider 触发 onError */ }

    // 如果选择了知识库，则优先走 RAG 流程
    if (knowledgeBase) {
      const handled = await runRagFlow({
        query: content,
        knowledgeBaseId: knowledgeBase.id,
        assistantMessageId,
        thinkingStartTime: thinking_start_time,
        conversationId: finalConversationId,
        currentContentRef,
        updateMessage,
        updateMessageContentInMemory,
        setTokenCount,
        modelId: modelToUse,
        provider: effectiveProvider,
        apiKey: undefined, // API密钥会从设置中自动获取
      });
      if (handled) return;
    }

    // 构建历史消息（含系统提示词 + MCP 上下文【混合模式】）
    const hb = new HistoryBuilder();
    try {
      const conv = currentConversationId ? useChatStore.getState().conversations.find((c:any)=>c.id===currentConversationId) : null;
      const applied = conv?.system_prompt_applied;
      if (applied?.promptId) {
        const prompt = usePromptStore.getState().prompts.find((p:any)=>p.id===applied.promptId);
        if (prompt) {
          const rendered = renderPromptContent(prompt.content, applied.variableValues);
          if (rendered && rendered.trim()) hb.addSystem(rendered);
        }
      }
      // 使用独立模块进行 MCP 系统注入（带缓存与限流）
      try {
        const { buildMcpSystemInjections } = await import('@/lib/mcp/promptInjector');
        const injection = await buildMcpSystemInjections(content, currentConversationId || undefined);
        for (const m of injection.systemMessages) hb.addSystem((m as any).content);
      } catch {
        // 忽略注入失败
      }
    } catch {
      // 忽略系统提示构建失败
    }
    if (currentConversation?.messages) {
      // 只取最近的几条消息，避免上下文过长
      const recentMessages = currentConversation.messages.slice(-10);
      hb.addMany(recentMessages
        .filter((msg:any)=> msg.role==='user'||msg.role==='assistant')
        .map((msg:any)=> ({ 
          role: msg.role, 
          content: msg.content || '', 
          images: msg.images,
          contextData: msg.context_data 
        })) as any);
    }
    hb.addUser(content, options?.images, documentData?.contextData);
    const historyForLlm: LlmMessage[] = hb.take();

    // 调试信息已移除，避免控制台噪音

    // 构建一个按秒保存的自动保存器（在 onStart 时初始化）

    // 流式工具调用检测器
    const { StructuredStreamTokenizer } = require('@/lib/chat/StructuredStreamTokenizer');
    const tokenizer = new StructuredStreamTokenizer();

    // 防重复触发：本条流内仅在首次完整命中时启动一次 MCP 调用
    let toolStarted = false;

    const streamCallbacks: StreamCallbacks = {
      onStart: () => {
        // 通知 UI：AI 流真正开始，此时再清空输入框更自然
        try { notifyStreamStart(finalConversationId); } catch { /* noop */ }

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

        // 在真正开始流时再清零 token 计数和批量状态
        setTokenCount(0);
        batchUpdateRef.current = { tokenCount: 0, lastUpdateTime: 0, pendingUpdate: false };
      },
      onToken: (token) => {
        // 生产期保留较少的 token 级日志
        // 防串写保护：仅当仍然是当前流实例时才写入
        if ((streamCallbacks as any).__instanceId !== streamInstanceId) return;
        currentContentRef.current += token;
        lastActivityTimeRef.current = Date.now();
        
        // 性能监控
        performanceRef.current.tokenCount++;
        logPerformance();
        
        // 1) 统一 tokenizer：先生成结构化事件（think/code-fence/tool_call/text），再按事件派发 FSM
        try {
          const events = tokenizer.push(token);
          // 事件类型
          // try { console.log('[TOK:events]', events.map((e:any)=>e.type)); } catch { /* noop */ }
          const st = useChatStore.getState();
          for (const ev of events) {
            if (ev.type === 'think_start') { st.dispatchMessageAction(assistantMessageId, { type: 'THINK_START' } as any); console.log('[TOK→FSM] THINK_START'); }
            else if (ev.type === 'think_chunk') { st.dispatchMessageAction(assistantMessageId, { type: 'THINK_APPEND', chunk: ev.chunk } as any); }
            else if (ev.type === 'think_end') { st.dispatchMessageAction(assistantMessageId, { type: 'THINK_END' } as any); console.log('[TOK→FSM] THINK_END'); }
            else if (ev.type === 'tool_call') {
              try { console.log('[TOK:event.tool_call]', ev.server, ev.tool); } catch { /* noop */ }
              const cardId = crypto.randomUUID();
              const marker = JSON.stringify({ __tool_call_card__: { id: cardId, server: ev.server, tool: ev.tool, status: 'running', args: ev.args || {}, messageId: assistantMessageId }});
              const prev = currentContentRef.current || '';
              const next = prev + (prev ? '\n' : '') + marker;
              if (next !== prev) {
                currentContentRef.current = next;
                try { updateMessageContentInMemory(assistantMessageId, next); } catch (err) { void err; }
              }
              st.dispatchMessageAction(assistantMessageId, { type: 'TOOL_HIT', server: ev.server, tool: ev.tool, args: ev.args, cardId });
              if (!toolStarted) {
                toolStarted = true;
                (async () => {
                  try {
                    const { executeToolCall } = await import('@/lib/mcp/ToolCallOrchestrator');
                    await executeToolCall({
                      assistantMessageId,
                      conversationId: String(finalConversationId),
                      server: ev.server,
                      tool: ev.tool,
                      args: ev.args,
                      _runningMarker: marker,
                      provider: effectiveProvider,
                      model: modelToUse,
                      historyForLlm: historyForLlm as any,
                      originalUserContent: content,
                      cardId,
                    });
                  } catch (err) { void err; }
                })();
              }
            }
            else if (ev.type === 'text' && ev.chunk) st.dispatchMessageAction(assistantMessageId, { type: 'TOKEN_APPEND', chunk: ev.chunk });
          }
          updateMessageContentInMemory(assistantMessageId, currentContentRef.current);
        } catch {
          updateMessageContentInMemory(assistantMessageId, currentContentRef.current);
        }
        setTokenCount(prev => prev + 1);
        // 2) 通知自动保存器按秒保存
        autoSaverRef.current?.update(currentContentRef.current);

        // 已由统一 tokenizer 负责 tool_call 事件，无需额外探测器
      },
      onImage: (img: { mimeType: string; data: string }) => {
        // 将图片作为新段追加到消息 segments
        try {
          const st = useChatStore.getState();
          st.dispatchMessageAction(assistantMessageId, { type: 'TOKEN_APPEND', chunk: '' } as any);
          const conv = st.conversations.find(c=>c.id===finalConversationId);
          const msg: any = conv?.messages.find(m=>m.id===assistantMessageId);
          const segs: any[] = Array.isArray(msg?.segments) ? [...msg.segments] : [];
          segs.push({ kind: 'image', mimeType: img.mimeType, data: img.data });
          st.setMessageSegmentsInMemory(assistantMessageId, segs);
        } catch { /* noop */ }
      },
      onComplete: () => {
        try { console.log('[CHAT] done'); } catch { /* noop */ }
        if ((streamCallbacks as any).__instanceId !== streamInstanceId) return;
        if (genTimeoutRef.current) clearInterval(genTimeoutRef.current);
        if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
        setGenerationTimeout(null);

        // 将现有 tokenizer 缓冲区剩余文本 flush 出来，避免末尾被截断
        try {
          const flushEvents = tokenizer.flush();
          const st = useChatStore.getState();
          for (const ev of flushEvents) {
            if (ev.type === 'text' && ev.chunk) {
              st.dispatchMessageAction(assistantMessageId, { type: 'TOKEN_APPEND', chunk: ev.chunk });
              currentContentRef.current += ev.chunk;
            }
          }
        } catch { /* noop */ }

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
            const msg = conv?.messages.find(m => m.id === assistantMessageId) as any;
            const hadCardMarker = !!(msg?.content && msg.content.includes('"__tool_call_card__"'));
            let contentToPersist = hadCardMarker ? (msg?.content || finalContent) : finalContent;

            // 兜底：如果segments中没有任何toolCard，但最终文本里包含 <tool_call> 指令，则在此处解析并注入工具卡片与执行
            const segs = Array.isArray(msg?.segments) ? msg.segments : [];
            const hasToolCardInSegments = segs.some((s:any)=>s && s.kind==='toolCard');
            const xmlMatch = contentToPersist.match(/<tool_call>([\s\S]*?)<\/tool_call>/i);
            let parsed: null | { server: string; tool: string; args?: Record<string, unknown> } = null;
            if (xmlMatch && xmlMatch[1]) {
              try {
                const obj = JSON.parse(xmlMatch[1]);
                parsed = { server: obj.server || obj.mcp || obj.provider, tool: obj.tool || obj.tool_name || obj.name, args: obj.parameters || obj.args || obj.params };
              } catch { /* ignore */ }
            } else {
              // 兼容JSON裸输出
              try {
                const jsonMatch = contentToPersist.match(/\{[\s\S]*?"type"\s*:\s*"tool_call"[\s\S]*?\}/i);
                if (jsonMatch && jsonMatch[0]) {
                  const obj = JSON.parse(jsonMatch[0]);
                  parsed = { server: obj.server || obj.mcp || obj.provider, tool: obj.tool || obj.tool_name || obj.name, args: obj.parameters || obj.args || obj.params };
                }
              } catch { /* ignore */ }
            }

            if (!hasToolCardInSegments && parsed && parsed.server && parsed.tool) {
              const cardId = crypto.randomUUID();
              const marker = JSON.stringify({ __tool_call_card__: { id: cardId, server: parsed.server, tool: parsed.tool, status: 'running', args: parsed.args || {}, messageId: assistantMessageId }});
              const prev = contentToPersist || '';
              const nextContent = prev + (prev ? '\n' : '') + marker;
              contentToPersist = nextContent;
              try { updateMessageContentInMemory(assistantMessageId, nextContent); } catch { /* noop */ }
              // 写入segments并触发工具执行
              st.dispatchMessageAction(assistantMessageId, { type: 'TOOL_HIT', server: parsed.server, tool: parsed.tool, args: parsed.args, cardId });
              // 在兜底路径也启动工具执行
              (async () => {
                try {
                  const { executeToolCall } = await import('@/lib/mcp/ToolCallOrchestrator');
                  await executeToolCall({
                    assistantMessageId,
                    conversationId: String(finalConversationId),
                    server: parsed.server,
                    tool: parsed.tool,
                    args: parsed.args,
                    _runningMarker: marker,
                    provider: effectiveProvider,
                    model: modelToUse,
                    historyForLlm: historyForLlm as any,
                    originalUserContent: content,
                    cardId,
                  });
                } catch { /* noop */ }
              })();
            }

            // 关键调试：输出最终消息片段与渲染要素
            const segs2 = Array.isArray((useChatStore.getState().conversations.find(c=>c.id===finalConversationId)?.messages.find(m=>m.id===assistantMessageId) as any)?.segments) ? (useChatStore.getState().conversations.find(c=>c.id===finalConversationId) as any)?.messages.find((m:any)=>m.id===assistantMessageId).segments : [];
            const cardCount = Array.isArray(segs2) ? segs2.filter((s:any)=>s && s.kind==='toolCard').length : 0;
            const thinkChars = Array.isArray(segs2) ? segs2.filter((s:any)=>s && s.kind==='think').map((s:any)=>s.text||'').join('').length : 0;
            console.log('[MSG-FINAL]', {
              id: assistantMessageId,
              totalSegments: Array.isArray(segs2)?segs2.length:0,
              cardCount,
              thinkChars,
              hasXmlToolCall: /<tool_call>[\s\S]*?<\/tool_call>/i.test(contentToPersist),
              contentLength: (contentToPersist||'').length
            });
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
          const st = useChatStore.getState();
          // 最终保险：若仍处于 THINK 且未收到 THINK_END，则补打一条
          try {
            const st2 = useChatStore.getState();
            const conv2 = st2.conversations.find(c=>c.id===finalConversationId);
            const msg2: any = conv2?.messages.find(m=>m.id===assistantMessageId);
            const segs = Array.isArray(msg2?.segments) ? msg2.segments : [];
            const stillThinking = segs.length && segs[segs.length-1]?.kind === 'think';
            if (stillThinking) {
              st2.dispatchMessageAction(assistantMessageId, { type: 'THINK_END' } as any);
            }
          } catch { void 0; }
          st.dispatchMessageAction(assistantMessageId, { type: 'STREAM_END' });
          try {
            const st2 = useChatStore.getState();
            const conv2 = st2.conversations.find(c=>c.id===finalConversationId);
            const msg2: any = conv2?.messages.find(m=>m.id===assistantMessageId);
            const segs = Array.isArray(msg2?.segments) ? msg2.segments : [];
            console.log('[VM-FINAL]', {
              msgId: assistantMessageId,
              segCount: segs.length,
              toolCards: segs.filter((s:any)=>s?.kind==='toolCard').length,
              hasThink: segs.some((s:any)=>s?.kind==='think'),
              lastKind: segs.length ? segs[segs.length-1].kind : 'none'
            });
            // 打印 AI 原文（用于排查模型是否真的给了 tool_call/think_end）
            console.log('[RAW-FINAL]', currentContentRef.current);
          } catch { void 0; }

          // 标题生成策略：
          // 1) 若本轮已出现工具卡片（代表进入了 MCP 递归），则不在此处生成，交由 Orchestrator 收尾时机处理；
          // 2) 若未出现工具卡片，则视为“普通对话”，在首轮助手完成后异步生成标题（不阻塞UI）。
          try {
            const st2 = useChatStore.getState();
            const conv2 = st2.conversations.find(c=>c.id===finalConversationId);
            const msg2: any = conv2?.messages.find(m=>m.id===assistantMessageId);
            const segs = Array.isArray(msg2?.segments) ? msg2.segments : [];
            const hasToolCard = segs.some((s:any)=>s && s.kind==='toolCard');
            if (!hasToolCard) {
              const schedule = (fn: () => void) => {
                try {
                  const ric = (window as any).requestIdleCallback;
                  if (typeof ric === 'function') {
                    ric(fn, { timeout: 2000 });
                  } else {
                    setTimeout(fn, 0);
                  }
                } catch {
                  setTimeout(fn, 0);
                }
              };
              schedule(() => {
                (async () => {
                  try {
                    const state = useChatStore.getState();
                    const conv = state.conversations.find(c => c.id === finalConversationId);
                    if (!conv) return;
                    const { shouldGenerateTitleAfterAssistantComplete, extractFirstUserMessageSeed, isDefaultTitle } = await import('@/lib/chat/TitleGenerator');
                    const { generateTitle } = await import('@/lib/chat/TitleService');
                    if (!shouldGenerateTitleAfterAssistantComplete(conv)) return;
                    const seedContent = extractFirstUserMessageSeed(conv);
                    if (!seedContent.trim()) return;
                    const gen = await generateTitle(effectiveProvider, modelToUse, seedContent, { maxLength: 24, language: 'zh' });
                    const st3 = useChatStore.getState();
                    const conv3 = st3.conversations.find(c => c.id === finalConversationId);
                    if (conv3 && isDefaultTitle(conv3.title) && gen && gen.trim()) {
                      void st3.renameConversation(String(finalConversationId), gen.trim());
                    }
                  } catch { /* noop */ }
                })();
              });
            }
          } catch { /* noop */ }
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
          const hasContent = !!(currentContentRef.current && currentContentRef.current.trim().length > 0);
          if (!hasContent) {
            // 没有任何内容产生：删除先前添加的占位AI消息，避免“空气泡”
            void deleteMessage(assistantMessageId);
            // 同时删除刚发送的用户消息，并回填输入框，便于重试
            try { void deleteMessage(userMessageId); } catch { /* noop */ }
            try { if (finalConversationId) setInputDraft(finalConversationId, content); } catch { /* noop */ }
          } else {
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
          }
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
      // 参数优先级：会话参数（可覆盖/可显式禁用） > 模型级参数 > 系统默认
      let baseOptions: Record<string, any> = {};

      try {
        // 1) 取模型级参数并转换为通用聊天选项
        const modelParams = await ModelParametersService.getModelParameters(effectiveProvider, modelToUse);
        const modelOpts = ModelParametersService.convertToChatOptions(modelParams);

        // 2) 取会话级参数（可能为空），转换为聊天选项
        let sessionOpts: Record<string, any> = {};
        if (sessionParameters) {
          sessionOpts = ModelParametersService.convertToChatOptions(sessionParameters);
        }

        // 3) 处理“显式禁用”的会话级开关：
        //    若用户在会话级将某项 enableX = false，则需要从继承的模型参数里删除对应项
        const filteredModelOpts: Record<string, any> = { ...modelOpts };
        const maybeDelete = (flag: boolean | undefined, key: string) => {
          if (flag === false && key in filteredModelOpts) delete filteredModelOpts[key];
        };
        if (sessionParameters) {
          const sp: any = sessionParameters;
          maybeDelete(sp.enableTemperature, 'temperature');
          maybeDelete(sp.enableMaxTokens, 'maxTokens');
          maybeDelete(sp.enableTopP, 'topP');
          maybeDelete(sp.enableTopK, 'topK');
          maybeDelete(sp.enableMinP, 'minP');
          maybeDelete(sp.enableFrequencyPenalty, 'frequencyPenalty');
          maybeDelete(sp.enablePresencePenalty, 'presencePenalty');
          // Stop 序列在 convertToChatOptions 中映射为 stop
          maybeDelete(sp.enableStopSequences, 'stop');
        }

        // 4) 合并，确保会话级覆盖模型级
        baseOptions = { ...filteredModelOpts, ...sessionOpts };

        const composed = await composeChatOptions(effectiveProvider, modelToUse, baseOptions, currentConversationId || null, content);
        const gateway = new ChatGateway({ provider: effectiveProvider, model: modelToUse, options: composed });
        await gateway.stream(historyForLlm, streamCallbacks);
      } catch {
        // 回退策略：尽量保证仍可发送
        try {
          let fallbackOpts: Record<string, any> = {};
          if (sessionParameters) fallbackOpts = ModelParametersService.convertToChatOptions(sessionParameters);
          const composed = await composeChatOptions(effectiveProvider, modelToUse, fallbackOpts, currentConversationId || null, content);
          const gateway = new ChatGateway({ provider: effectiveProvider, model: modelToUse, options: composed });
          await gateway.stream(historyForLlm, streamCallbacks);
        } catch {
          const composed = await composeChatOptions(effectiveProvider, modelToUse, {}, currentConversationId || null, content);
          const gateway = new ChatGateway({ provider: effectiveProvider, model: modelToUse, options: composed });
          await gateway.stream(historyForLlm, streamCallbacks);
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
    
    // 不清空 currentContentRef，保留已生成文本；也不重置 tokenCount，让用户看到该次统计
    
    // 更新当前消息状态为已停止
    if (currentConversation?.messages) {
      const lastAssistantMessage = currentConversation.messages
        .filter((msg: Message) => msg.role === 'assistant')
        .pop();
      
      if (lastAssistantMessage && lastAssistantMessage.status === 'loading') {
        const thinking_duration = lastAssistantMessage.thinking_start_time 
          ? Math.floor((Date.now() - lastAssistantMessage.thinking_start_time) / 1000)
          : 0;
        
        // 若用户主动停止且思考栏仍在计时，手动发出 THINK_END 以终止计时显示
        try {
          const st = useChatStore.getState();
          const conv = st.conversations.find(c => c.id === currentConversationId);
          const msg: any = conv?.messages.find(m => m.id === lastAssistantMessage.id);
          const segs = Array.isArray(msg?.segments) ? msg.segments : [];
          const stillThinking = segs.length && segs[segs.length - 1]?.kind === 'think';
          if (stillThinking) {
            st.dispatchMessageAction(lastAssistantMessage.id, { type: 'THINK_END' } as any);
          }
        } catch { /* noop */ }

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