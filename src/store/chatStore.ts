import { create } from 'zustand';
import { persist } from "zustand/middleware";
import { immer } from 'zustand/middleware/immer';
import { Message, Conversation } from "@/types/chat";
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '@/lib/database/services/DatabaseService';
import { startupMonitor } from '@/lib/utils/startupPerformanceMonitor';

const getDatabaseService = () => {
  const service = DatabaseService.getInstance();
  try {
    service.getDbManager();
    return service;
  } catch {
    throw new Error('数据库服务未初始化，请等待应用启动完成');
  }
};

interface ChatState {
  conversations: Conversation[];
  currentConversationId: string | null;
  isLoadingConversations: boolean;
  isGenerating: boolean;
  lastUsedModelPerChat: Record<string, string>;
  sessionLastSelectedModel: string | null;
  /** 已加载消息的会话标记，避免重复加载 */
  _messagesLoaded: Record<string, boolean>;
  /** 按会话缓存的输入草稿，用于失败后回填 */
  inputDrafts?: Record<string, string>;
  /** 流开始信号（计数器+会话ID），用于触发输入清空 */
  streamStartCounter?: number;
  lastStreamConvId?: string | null;
}

interface ChatActions {
  loadConversations: () => Promise<void>;
  /** 确保指定会话的消息已加载（惰性加载） */
  ensureMessagesLoaded: (conversationId: string) => Promise<void>;
  createConversation: (title: string, modelId: string, providerName?: string) => Promise<string>;
  deleteConversation: (conversationId: string) => Promise<void>;
  setCurrentConversation: (conversationId: string) => void;
  addMessage: (message: Message) => Promise<Message | null>;
  /** 在指定消息之后插入一条新消息（用于重试版本插入） */
  insertMessageAfter: (afterMessageId: string, message: Message) => Promise<Message | null>;
  updateMessage: (messageId: string, updates: Partial<Message>) => Promise<void>;
  /**
   * 仅更新内存中的消息内容，不触发 DB IO
   */
  updateMessageContentInMemory: (messageId: string, content: string) => void;
  updateLastMessage: (content: string) => void;
  clearCurrentConversation: () => void;
  updateConversationTitle: (conversationId: string, title: string) => void;
  finalizeStreamedMessage: (messageId: string, finalStatus: string, finalContent: string, model?: string) => Promise<void>;
  updateConversation: (id: string, updates: Partial<Conversation>) => Promise<void>;
  renameConversation: (conversationId: string, newTitle: string) => Promise<void>;
  clearAllConversations: () => Promise<void>;
  setLastUsedModelForChat: (chatId: string, modelIdentifier: string) => void;
  setSessionLastSelectedModel: (modelIdentifier: string) => void;
  toggleStarConversation: (conversationId: string) => Promise<void>;
  toggleImportant: (conversationId: string) => Promise<void>;
  duplicateConversation: (conversationId: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  // 段驱动富文本：高频内存更新（不落库）
  appendTextToMessageSegments: (messageId: string, textChunk: string) => void;
  // 段集合覆盖（会在外层按需持久化）
  setMessageSegmentsInMemory: (messageId: string, segments: any[]) => void;
  // 统一派发：使用 reducer 更新消息（带批处理）
  dispatchMessageAction: (messageId: string, action: any) => void;
  // 失败回填相关
  setInputDraft: (conversationId: string, value: string) => void;
  clearInputDraft: (conversationId: string) => void;
  // 通知前端：流已开始（用于在 UI 清空输入框等）
  notifyStreamStart: (conversationId: string) => void;
}

// 添加安全的images字段解析函数
const parseImagesField = (imagesData: any): string[] | undefined => {
  if (!imagesData) return undefined;
  
  // 如果已经是数组，直接返回
  if (Array.isArray(imagesData)) return imagesData;
  
  // 如果是字符串，需要判断格式
  if (typeof imagesData === 'string') {
    // 如果是data URL格式（以'data:'开头），直接返回数组
    if (imagesData.startsWith('data:')) {
      return [imagesData];
    }
    
    // 如果是JSON格式的字符串，尝试解析
    if (imagesData.startsWith('[') || imagesData.startsWith('{')) {
      try {
        const parsed = JSON.parse(imagesData);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch (error) {
        console.warn('[STORE] 解析images JSON失败:', error);
        return undefined;
      }
    }
    
    // 其他情况，当作单个图片处理
    return [imagesData];
  }
  
  return undefined;
};

export const useChatStore = create<ChatState & ChatActions>()(
  persist(
    immer((set, get) => ({
      conversations: [],
      currentConversationId: null,
      isLoadingConversations: false,
      isGenerating: false,
      lastUsedModelPerChat: {},
      sessionLastSelectedModel: null,
      _messagesLoaded: {},
      inputDrafts: {},
      streamStartCounter: 0,
      lastStreamConvId: null,

      loadConversations: async () => {
        console.log(`🔄 [LOAD-CONVERSATIONS] 开始加载对话列表`);
        set({ isLoadingConversations: true });

        try {
          startupMonitor.startPhase('对话列表加载');
          
          const dbService = getDatabaseService();
          
          // 检查数据库服务是否已初始化
          if (!dbService.isInitialized()) {
            console.warn('⚠️ [LOAD-CONVERSATIONS] 数据库服务未初始化，等待初始化完成...');
            // 等待一段时间后重试
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // 再次检查
            if (!dbService.isInitialized()) {
              throw new Error('数据库服务初始化超时');
            }
          }
          
          const conversationRepo = dbService.getConversationRepository();

          startupMonitor.startPhase('获取对话列表');
          const conversations = await conversationRepo.findAll(
            undefined,
            [{ field: 'updated_at', direction: 'DESC' }]
          );
          startupMonitor.endPhase('获取对话列表');

          console.log(`🔄 [LOAD-CONVERSATIONS] 从数据库加载了 ${conversations.length} 个对话`);

          startupMonitor.startPhase('数据处理');

          const loadedConversations: Conversation[] = conversations.map((conv) => {
            const convAny = conv as any;
            const conversationData: Conversation = {
              id: convAny.id,
              title: convAny.title,
              created_at: convAny.created_at || convAny.created_at,
              updated_at: convAny.updated_at || convAny.updated_at,
              model_id: convAny.model_id || convAny.model_id || 'default',
              model_provider: convAny.model_provider || null,
              model_full_id: convAny.model_full_id || (convAny.model_provider ? `${convAny.model_provider}/${convAny.model_id}` : convAny.model_id),
              is_important: convAny.is_important === true || convAny.is_important === 1,
              is_favorite: convAny.is_favorite === true || convAny.is_favorite === 1,
              messages: [], // 首次不加载消息，按需加载
            };
            return conversationData;
          });
          startupMonitor.endPhase('数据处理');

          console.debug(`🔄 [STORE] Loaded ${loadedConversations.length} conversations.`);
          set({ 
            conversations: loadedConversations, 
            isLoadingConversations: false 
          });

          if (!get().currentConversationId && loadedConversations.length > 0) {
            console.log(`🔄 [LOAD-CONVERSATIONS] 设置当前会话: ${loadedConversations[0].id}`);
            set({ currentConversationId: loadedConversations[0].id });
          }

          console.log(`[LOAD-CONVERSATIONS] 会话加载完成，总计: ${loadedConversations.length} 个`);
          startupMonitor.endPhase('对话列表加载');
        } catch (error) {
          startupMonitor.endPhase('对话列表加载');
          startupMonitor.endPhase('获取对话列表');
          startupMonitor.endPhase('数据处理');
          
          console.error('❌ [LOAD-CONVERSATIONS] 加载对话失败:', error);
          set({ isLoadingConversations: false });
        }
      },

      ensureMessagesLoaded: async (conversationId: string) => {
        if (!conversationId) return;
        const loaded = get()._messagesLoaded[conversationId];
        const conv = get().conversations.find(c => c.id === conversationId);
        if (loaded && conv && Array.isArray(conv.messages) && conv.messages.length > 0) return;

        try {
          const dbService = getDatabaseService();
          const messageRepo = dbService.getMessageRepository();
          const messages = await messageRepo.getMessagesByConversation(conversationId);

          const parseToolCardsFromContent = (content: string, messageId: string) => {
            const segs: any[] = [];
            if (!content) return segs;
            try {
              const lines = String(content).split('\n');
              for (const line of lines) {
                const t = line.trim();
                if (!t) continue;
                if (!t.includes('"__tool_call_card__"')) continue;
                try {
                  const obj = JSON.parse(t);
                  const payload = obj?.__tool_call_card__ || {};
                  if (payload && payload.server && payload.tool) {
                    segs.push({
                      kind: 'toolCard',
                      id: payload.id || crypto.randomUUID(),
                      server: payload.server,
                      tool: payload.tool,
                      args: payload.args || {},
                      status: (payload.status === 'error' || payload.status === 'success') ? payload.status : 'running',
                      resultPreview: payload.resultPreview,
                      errorMessage: payload.errorMessage,
                      schemaHint: payload.schemaHint,
                      messageId,
                    });
                  }
                } catch { /* ignore single line */ }
              }
            } catch { /* noop */ }
            return segs;
          };

          const processed: Message[] = messages.map((msg: any) => {
            let doc_ref = undefined;
            if (msg.document_reference) {
              if (typeof msg.document_reference === 'object' && !Array.isArray(msg.document_reference)) {
                doc_ref = msg.document_reference;
              } else if (typeof msg.document_reference === 'string') {
                try { doc_ref = JSON.parse(msg.document_reference); } catch { /* noop */ }
              }
            }
            let kb_ref = undefined;
            if (msg.knowledge_base_reference) {
              if (typeof msg.knowledge_base_reference === 'object' && !Array.isArray(msg.knowledge_base_reference)) {
                kb_ref = msg.knowledge_base_reference;
              } else if (typeof msg.knowledge_base_reference === 'string') {
                try { kb_ref = JSON.parse(msg.knowledge_base_reference); } catch { /* noop */ }
              }
            }
            const base: Message = {
              id: msg.id,
              conversation_id: msg.conversation_id,
              role: msg.role,
              content: msg.content,
              created_at: msg.created_at,
              updated_at: msg.updated_at,
              status: msg.status,
              model: msg.model || undefined,
              document_reference: doc_ref,
              knowledge_base_reference: kb_ref,
              context_data: msg.context_data || undefined,
              thinking_start_time: msg.thinking_start_time,
              thinking_duration: msg.thinking_duration,
              images: parseImagesField(msg.images),
            };
            
            // 添加版本字段（如果存在）
            if (msg.version_group_id !== undefined && msg.version_group_id !== null) {
              (base as any).version_group_id = msg.version_group_id;
            }
            if (msg.version_index !== undefined && msg.version_index !== null) {
              (base as any).version_index = msg.version_index;
            }
            try {
              const segsFromDb = Array.isArray(msg.segments) ? (msg.segments as any[]) : [];
              const segs = segsFromDb.length > 0 ? segsFromDb : parseToolCardsFromContent(base.content || '', base.id);
              if (Array.isArray(segs) && segs.length > 0) {
                (base as any).segments = segs;
                (base as any).segments_vm = { items: segs.map((s:any)=>({ ...s })), flags: { isThinking: false, isComplete: true, hasToolCalls: true } };
              }
            } catch { /* noop */ }
            return base;
          });

          set(state => {
            const target = state.conversations.find(c => c.id === conversationId);
            if (target) {
              (target as any).messages = processed;
              state._messagesLoaded[conversationId] = true;
              // ❌ 不要更新 updated_at！这会导致悬浮时时间变化
              // target.updated_at = Date.now();
            }
          });
        } catch (e) {
          console.error('[STORE] ensureMessagesLoaded 失败:', e);
        }
      },

      createConversation: async (title, modelId, providerName) => {
        const now = Date.now();
        const newConversation: Conversation = {
          id: uuidv4(),
          title,
          created_at: now,
          updated_at: now,
          messages: [],
          model_id: modelId || 'default',
          model_provider: providerName,
          model_full_id: providerName ? `${providerName}/${modelId}` : modelId,
          is_important: false,
          is_favorite: false,
        };

        set((state) => {
          state.conversations.unshift(newConversation);
        });
        set({ currentConversationId: newConversation.id });

        try {
          const dbService = getDatabaseService();
          const conversationRepo = dbService.getConversationRepository();

          await conversationRepo.create({
            id: newConversation.id,
            title,
            created_at: now,
            updated_at: now,
            model_id: modelId || 'default',
            model_provider: providerName || null,
            model_full_id: providerName ? `${providerName}/${modelId}` : modelId,
            is_important: 0,
            is_favorite: 0,
          } as any);

          console.log(`[CREATE-CONVERSATION] 成功创建对话: ${newConversation.id}`);
        } catch (error) {
          console.error("❌ [CREATE-CONVERSATION] 保存新对话失败:", error);
          set((state) => {
            state.conversations = state.conversations.filter(c => c.id !== newConversation.id);
          });
          throw error;
        }

        return newConversation.id;
      },

      setCurrentConversation: (id) => {
        set({ currentConversationId: id });
      },

      addMessage: async (messageData) => {
        const conversation_id = messageData.conversation_id;
        if (!conversation_id) {
          console.error("❌ [STORE] Add message failed: conversation_id is missing.");
          return null;
        }
        
        console.log(`[STORE] Adding message to conversation ${conversation_id.substring(0, 8)}...`);

        const now = Date.now();
        const newMessage: Message = {
          ...messageData,
          created_at: messageData.created_at || now,
          updated_at: messageData.updated_at || now,
        };

        let addedToState = false;
        set((state) => {
          let conversation = state.conversations.find((c: Conversation) => c.id === conversation_id);
          if (!conversation) {
            console.log(`[DEBUG] 未找到会话 ${conversation_id}，自动创建基本会话结构`);
            conversation = {
              id: conversation_id,
              title: `新对话 ${new Date().toLocaleDateString()}`,
              created_at: now,
              updated_at: now,
              messages: [],
              model_id: 'default',
              is_important: false,
              is_favorite: false,
            };
            state.conversations.unshift(conversation);
          }
          
          if (!conversation.messages) {
            conversation.messages = [];
          }
          conversation.messages.push(newMessage);
          conversation.updated_at = now;
          addedToState = true;
          
          const index = state.conversations.findIndex((c: Conversation) => c.id === conversation_id);
          if (index > 0) {
            const [movedConversation] = state.conversations.splice(index, 1);
            state.conversations.unshift(movedConversation);
          }
        });

        if (!addedToState) {
          console.error("[DEBUG] 严重错误: 消息未添加到状态，这不应该发生");
          return null;
        }

        try {
          const dbService = getDatabaseService();
          const conversationRepo = dbService.getConversationRepository();
          const messageRepo = dbService.getMessageRepository();

          // 更新对话的updated_at字段（BaseRepository会自动添加updated_at）
          await conversationRepo.update(conversation_id, {} as any);

          const document_reference_json = newMessage.document_reference ? JSON.stringify(newMessage.document_reference) : null;
          const knowledge_base_reference_json = newMessage.knowledge_base_reference ? JSON.stringify(newMessage.knowledge_base_reference) : null;
          const images_json = newMessage.images ? JSON.stringify(newMessage.images) : null;

          // 构建数据库记录，包含版本字段
          const dbRecord: any = {
            id: newMessage.id,
            conversation_id: conversation_id,
            role: newMessage.role,
            content: newMessage.content,
            created_at: newMessage.created_at,
            status: newMessage.status,
            model: newMessage.model || null,
            document_reference: document_reference_json,
            knowledge_base_reference: knowledge_base_reference_json,
            context_data: newMessage.context_data || null,
            images: images_json,
            segments: Array.isArray((newMessage as any).segments) ? JSON.stringify((newMessage as any).segments) : null,
          };

          // 添加版本字段（如果存在）
          if ((newMessage as any).version_group_id !== undefined) {
            dbRecord.version_group_id = (newMessage as any).version_group_id;
          }
          if ((newMessage as any).version_index !== undefined) {
            dbRecord.version_index = (newMessage as any).version_index;
          }

          await messageRepo.create(dbRecord);

          console.log(`[STORE] 消息保存成功: ${newMessage.id}`);
        } catch (error) {
          console.error("❌ [STORE] Failed to save message to DB:", error);
          set((state) => {
            const conversation = state.conversations.find((c: Conversation) => c.id === conversation_id);
            const messageIndex = conversation?.messages?.findIndex((m: Message) => m.id === newMessage.id);
            if (conversation && conversation.messages && messageIndex !== undefined && messageIndex > -1) {
              // 若是助手消息且无任何内容与片段，直接移除，避免出现空气泡
              const msg = conversation.messages[messageIndex] as any;
              const noContent = !(msg?.content && String(msg.content).trim().length > 0);
              const noSegments = !Array.isArray(msg?.segments) || msg.segments.length === 0;
              if (msg?.role === 'assistant' && noContent && noSegments) {
                conversation.messages.splice(messageIndex, 1);
              } else {
                Object.assign(conversation.messages[messageIndex], { status: 'error' });
              }
            }
          });
          return null;
        }

        return newMessage;
      },

      // 在指定消息之后插入一条新消息（用于版本化重试，将新回答插入到对应用户消息的版本组末尾）
      insertMessageAfter: async (afterMessageId, messageData) => {
        let conversation_id = messageData.conversation_id;
        if (!conversation_id) {
          // 若未传入，尝试从 afterMessage 所在会话推断
          const st = get();
          for (const conv of st.conversations) {
            const idx = conv.messages?.findIndex(m => m.id === afterMessageId) ?? -1;
            if (idx !== -1) { conversation_id = conv.id; break; }
          }
        }
        if (!conversation_id) {
          console.error("❌ [STORE] insertMessageAfter 失败: 无法解析会话ID");
          return null;
        }

        const now = Date.now();
        const newMessage: Message = {
          ...messageData,
          conversation_id,
          created_at: messageData.created_at || now,
          updated_at: messageData.updated_at || now,
        };

        let inserted = false;
        set((state) => {
          const conv = state.conversations.find(c => c.id === conversation_id);
          if (!conv) return;
          if (!Array.isArray(conv.messages)) conv.messages = [] as any;
          const pos = conv.messages.findIndex(m => m.id === afterMessageId);
          if (pos === -1) return;

          // 计算一个合理的 created_at，使其位于 after 与下一条消息之间
          const after = conv.messages[pos];
          const next = conv.messages[pos + 1];
          const targetTs = (() => {
            const minAfter = (after?.created_at || now) + 1;
            const maxBefore = next && next.created_at ? (next.created_at - 1) : (now);
            if (maxBefore > minAfter) return minAfter;
            return (after?.created_at || now) + 1;
          })();
          (newMessage as any).created_at = targetTs;
          (newMessage as any).updated_at = targetTs;

          conv.messages.splice(pos + 1, 0, newMessage);
          conv.updated_at = now;
          inserted = true;
        });

        if (!inserted) return null;

        try {
          const dbService = getDatabaseService();
          const conversationRepo = dbService.getConversationRepository();
          const messageRepo = dbService.getMessageRepository();

          await conversationRepo.update(conversation_id, {} as any);

          const document_reference_json = newMessage.document_reference ? JSON.stringify(newMessage.document_reference) : null;
          const knowledge_base_reference_json = newMessage.knowledge_base_reference ? JSON.stringify(newMessage.knowledge_base_reference) : null;
          const images_json = newMessage.images ? JSON.stringify(newMessage.images) : null;

          // 构建数据库记录，包含版本字段
          const dbRecord: any = {
            id: newMessage.id,
            conversation_id: conversation_id,
            role: newMessage.role,
            content: newMessage.content,
            created_at: newMessage.created_at,
            status: newMessage.status,
            model: newMessage.model || null,
            document_reference: document_reference_json,
            knowledge_base_reference: knowledge_base_reference_json,
            context_data: newMessage.context_data || null,
            images: images_json,
            segments: Array.isArray((newMessage as any).segments) ? JSON.stringify((newMessage as any).segments) : null,
          };

          // 添加版本字段（如果存在）
          if ((newMessage as any).version_group_id !== undefined) {
            dbRecord.version_group_id = (newMessage as any).version_group_id;
          }
          if ((newMessage as any).version_index !== undefined) {
            dbRecord.version_index = (newMessage as any).version_index;
          }

          await messageRepo.create(dbRecord);

          return newMessage;
        } catch (error) {
          console.error("❌ [STORE] insertMessageAfter 持久化失败:", error);
          // 回滚内存插入
          set((state) => {
            const conv = state.conversations.find(c => c.id === conversation_id);
            if (!conv) return;
            const idx = conv.messages?.findIndex(m => m.id === newMessage.id) ?? -1;
            if (idx !== -1) conv.messages.splice(idx, 1);
          });
          return null;
        }
      },

      // 删除单条消息（用于在错误情况下回滚占位）
      deleteMessage: async (messageId) => {
        set(state => {
          for (const conv of state.conversations) {
            const idx = conv.messages?.findIndex(m => m.id === messageId) ?? -1;
            if (idx !== -1) {
              conv.messages.splice(idx, 1);
              conv.updated_at = Date.now();
              break;
            }
          }
        });
        try {
          const dbService = getDatabaseService();
          const messageRepo = dbService.getMessageRepository();
          await messageRepo.delete(messageId);
        } catch { /* ignore */ }
      },

      setInputDraft: (conversationId, value) => {
        if (!conversationId) return;
        set(state => {
          if (!state.inputDrafts) state.inputDrafts = {};
          state.inputDrafts[conversationId] = value;
        });
      },

      clearInputDraft: (conversationId) => {
        if (!conversationId) return;
        set(state => {
          if (!state.inputDrafts) return;
          delete state.inputDrafts[conversationId];
        });
      },

      notifyStreamStart: (conversationId) => {
        if (!conversationId) return;
        set(state => {
          state.streamStartCounter = (state.streamStartCounter || 0) + 1;
          state.lastStreamConvId = conversationId;
        });
      },

      // 仅内存：向消息的最后一个 text 段追加文本（若不存在则创建）
      appendTextToMessageSegments: (messageId, textChunk) => {
        if (!textChunk) return;
        set(state => {
          for (const conv of state.conversations) {
            const msg: any = conv.messages?.find(m => m.id === messageId);
            if (msg) {
              if (!Array.isArray(msg.segments)) msg.segments = [];
              if (msg.segments.length === 0 || msg.segments[msg.segments.length - 1]?.kind !== 'text') {
                msg.segments.push({ kind: 'text', text: textChunk });
              } else {
                msg.segments[msg.segments.length - 1].text = String(msg.segments[msg.segments.length - 1].text || '') + textChunk;
              }
              conv.updated_at = Date.now();
              break;
            }
          }
        });
      },

      // 仅内存：直接设置 segments（用于一次性替换/合并）
      setMessageSegmentsInMemory: (messageId, segments) => {
        set(state => {
          for (const conv of state.conversations) {
            const msg: any = conv.messages?.find(m => m.id === messageId);
            if (msg) { msg.segments = Array.isArray(segments) ? segments : []; conv.updated_at = Date.now(); break; }
          }
        });
      },

      dispatchMessageAction: (() => {
        const queues = new Map<string, any[]>();
        const scheduled = new Set<string>();
        const scheduleFlush = (id: string) => {
          if (scheduled.has(id)) return;
          scheduled.add(id);
          queueMicrotask(() => {
            const actions = queues.get(id) || [];
            queues.set(id, []);
            scheduled.delete(id);
            const { initModel, reduce } = require('@/lib/chat/messageFsm');
            set(state => {
              for (const conv of state.conversations) {
                if (!Array.isArray(conv.messages)) continue;
                const idx = conv.messages.findIndex(m => m.id === id);
                if (idx === -1) continue;
                const prevMsg: any = conv.messages[idx];
                let model = initModel(prevMsg);
                for (const a of actions) model = reduce(model, a);
                // 仅在包含 TOOL_HIT 的批次里打印一次关键日志，避免流式期间噪音
                try {
                  // 过去会把“工具卡片标记”以 JSON 行的形式注入到 content，作为持久化兜底。
                  // 现在 segments 已在包含 TOOL_HIT/TOOL_RESULT/STREAM_END 的批次里持久化，
                  // 注入 content 反而会导致 UI 在渲染周期中短暂显示这行 JSON，再被卡片替换，出现“闪现-消失”。
                  // 因此这里不再向 content 注入任何工具标记，统一由 segments/viewModel 驱动 UI 与持久化。
                  // 不对 content 做修改
                } catch { /* noop */ }
                // 关键：替换消息与数组引用，确保 React 依赖 conversation.messages 变化后重算 useMemo
                // 生成只读 ViewModel 供 UI 使用
                const vmItems = (model.segments || []).map((s:any) => ({ ...s }));
                const viewModel = {
                  items: vmItems,
                  flags: {
                    isThinking: (model.fsm === 'RENDERING_THINK'),
                    isComplete: (model.fsm === 'COMPLETE'),
                    hasToolCalls: vmItems.some((x:any)=>x && x.kind==='toolCard'),
                    // 新增：正在识别工具调用（抑制阀激活时）
                    isToolDetecting: !!model.detectingTool
                  }
                } as any;
                try {
                  const { trace } = require('@/lib/debug/Trace');
                  const counts = vmItems.reduce((acc:any, s:any) => { acc[s.kind] = (acc[s.kind]||0)+1; return acc; }, {});
                  trace('store', id, `segments updated fsm=${model.fsm}`, counts);
                } catch { /* noop */ }
                const nextMsg: any = { ...prevMsg, segments: model.segments, segments_vm: viewModel };
                const nextMessages: any[] = [...(conv.messages as any[])];
                nextMessages[idx] = nextMsg;
                (conv as any).messages = nextMessages;
                conv.updated_at = Date.now();
                // console.log('[FSM:flush.end]', { id, nextSegs: Array.isArray(nextMsg.segments)?nextMsg.segments.length:0, fsm: model.fsm });
                break;
              }
            });

            // 将包含 MCP 相关动作（TOOL_HIT/TOOL_RESULT/STREAM_END）导致的 segments 变更持久化到数据库
            try {
              const shouldPersist = actions.some(a => a && (a.type === 'TOOL_HIT' || a.type === 'TOOL_RESULT' || a.type === 'STREAM_END'));
              if (shouldPersist) {
                const st = get();
                const conv = st.conversations.find(c => Array.isArray((c as any).messages) && (c as any).messages.some((m:any)=>m.id===id));
                const msg = conv ? (conv as any).messages.find((m:any)=>m.id===id) : undefined;
                const segsToSave = msg?.segments;
                if (Array.isArray(segsToSave)) {
                  // 异步落库，不阻塞 UI
                  void get().updateMessage(id, { segments: segsToSave });
                }
              }
            } catch { /* noop */ }
          });
        };
        return (messageId: string, action: any) => {
          const list = queues.get(messageId) || [];
          list.push(action);
          queues.set(messageId, list);
          scheduleFlush(messageId);
        };
      })(),

      updateMessageContentInMemory: (messageId, content) => {
        const now = Date.now();
        set(state => {
          for (const conv of state.conversations) {
            const msg: any = conv.messages?.find(m => m.id === messageId);
            if (msg) {
              msg.content = content;
              // 重要：segments 完全由 FSM 驱动，此处不再同步 text 段，避免把 <think> 的正文化
              // console.log('[STORE:updateMessageContentInMemory]', { messageId, contentLen: (content||'').length });
              conv.updated_at = now;
              break;
            }
          }
        });
      },

      updateMessage: async (messageId, updates) => {
        const now = Date.now();
        const finalUpdates = { ...updates };

        set(state => {
          for (const conv of state.conversations) {
            const msg = conv.messages?.find(m => m.id === messageId);
            if (msg) {
              // 最小侵入式更新：content 与 segments 分开处理
              if (typeof finalUpdates.content === 'string') {
                msg.content = finalUpdates.content;
              }
              if (finalUpdates.segments) {
                (msg as any).segments = finalUpdates.segments as any;
              }
              const rest = { ...finalUpdates } as any;
              delete rest.content; delete rest.segments;
              Object.assign(msg, rest);
              conv.updated_at = now;
              break;
            }
          }
        });
        
        try {
          const dbService = getDatabaseService();
          const messageRepo = dbService.getMessageRepository();

          const MAX_RETRIES = 5;
          const RETRY_DELAY = 100;
          
          const dbUpdates: Record<string, any> = { ...finalUpdates };
          // 持久化 segments 为 JSON 字符串
          if ('segments' in dbUpdates) {
            dbUpdates.segments = dbUpdates.segments ? JSON.stringify(dbUpdates.segments) : null;
          }
          if ('document_reference' in dbUpdates && dbUpdates.document_reference) {
            dbUpdates.document_reference = JSON.stringify(dbUpdates.document_reference);
          }
          if ('knowledge_base_reference' in dbUpdates && dbUpdates.knowledge_base_reference) {
            dbUpdates.knowledge_base_reference = JSON.stringify(dbUpdates.knowledge_base_reference);
          }

          for (let i = 0; i < MAX_RETRIES; i++) {
            try {
              await messageRepo.update(messageId, dbUpdates);
              return;
            } catch (error: any) {
              if (error.message?.includes('记录不存在') && i < MAX_RETRIES - 1) {
                console.warn(`[STORE] Retrying update for message ${messageId} (Attempt ${i + 2}/${MAX_RETRIES})`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
              } else {
                throw error;
              }
            }
          }
        } catch (error) {
          console.error(`❌ [UPDATE-MESSAGE] 更新消息 ${messageId} 失败:`, error);
        }
      },

      updateLastMessage: (content: string) => {
        set((state) => {
          const currentConversation = state.conversations.find(
            (c: Conversation) => c.id === state.currentConversationId
          );
          if (currentConversation && currentConversation.messages && currentConversation.messages.length > 0) {
            const lastMessage = currentConversation.messages[currentConversation.messages.length - 1];
            lastMessage.content = content;
          }
        });
      },

      clearCurrentConversation: () => {
        set({ currentConversationId: null });
      },

      updateConversationTitle: (conversationId: string, title: string) => {
        set((state) => {
          const conversation = state.conversations.find((c: Conversation) => c.id === conversationId);
          if (conversation) {
            conversation.title = title;
            conversation.updated_at = Date.now();
          }
        });
      },

      finalizeStreamedMessage: async (messageId: string, finalStatus: string, finalContent: string, model?: string) => {
        console.log(`[STORE] Finalizing message ${messageId.substring(0,8)}... Status: ${finalStatus}`);

        const now = Date.now();
        let conversationId: string | null = null;

        try {
          const dbService = getDatabaseService();
          const messageRepo = dbService.getMessageRepository();
          const conversationRepo = dbService.getConversationRepository();

          set((state) => {
            for (const conversation of state.conversations) {
              if (conversation.messages) {
                const messageIndex = conversation.messages.findIndex((m: Message) => m.id === messageId);
                if (messageIndex !== -1) {
                  conversationId = conversation.id;
                  const message = conversation.messages[messageIndex];
                  Object.assign(message, { status: finalStatus as any });
                  // 修复：使用 !== undefined 检查，允许保存空字符串
                  if (finalContent !== undefined) Object.assign(message, { content: finalContent });
                  if (model) Object.assign(message, { model });
                  conversation.updated_at = now;

                  const conversationIndex = state.conversations.findIndex(c => c.id === conversationId);
                  if (conversationIndex > 0) {
                    const [movedConversation] = state.conversations.splice(conversationIndex, 1);
                    state.conversations.unshift(movedConversation);
                  }
                  break;
                }
              }
            }
          });

          if (!conversationId) {
            console.error(`❌ [STORE] Failed to find conversation for message ${messageId}`);
            return;
          }

          const updateData: Record<string, any> = {
            status: finalStatus,
          };

          // 修复：使用 !== undefined 检查，允许保存空字符串
          if (finalContent !== undefined) {
            updateData.content = finalContent;
          }
          if (model) {
            updateData.model = model;
          }

          await messageRepo.update(messageId, updateData);
          await conversationRepo.update(conversationId, { updated_at: now } as any);

          console.log(`[STORE] 消息最终确定成功: ${messageId}`);
        } catch (error) {
          console.error(`❌ [STORE] Failed to finalize message:`, error);
        }
      },

      updateConversation: async (id: string, updates: Partial<Conversation>) => {
        const now = Date.now();
        const finalUpdates = { ...updates, updated_at: now };

        set((state) => {
          const conversationIndex = state.conversations.findIndex((c: Conversation) => c.id === id);
          if (conversationIndex !== -1) {
            Object.assign(state.conversations[conversationIndex], finalUpdates);
          } else {
            console.warn(`Conversation with id ${id} not found for update.`);
          }
        });

        try {
          const dbService = getDatabaseService();
          const conversationRepo = dbService.getConversationRepository();

          const dbUpdates: Record<string, any> = {
            updated_at: finalUpdates.updated_at,
          };

          if ('title' in updates) dbUpdates.title = updates.title;
          if ('model_id' in updates) {
            dbUpdates.model_id = updates.model_id;
            if ('model_provider' in updates) {
              dbUpdates.model_provider = updates.model_provider;
              dbUpdates.model_full_id = updates.model_provider ? `${updates.model_provider}/${updates.model_id}` : updates.model_id;
            }
          }
          if ('model_provider' in updates && !('model_id' in updates)) {
            dbUpdates.model_provider = updates.model_provider;
            const targetConv = get().conversations.find(c=>c.id===id);
            const mId = updates.model_id || targetConv?.model_id || '';
            dbUpdates.model_full_id = updates.model_provider ? `${updates.model_provider}/${mId}` : mId;
          }
          if ('is_important' in updates) dbUpdates.is_important = updates.is_important ? 1 : 0;
          if ('is_favorite' in updates) dbUpdates.is_favorite = updates.is_favorite ? 1 : 0;

          await conversationRepo.update(id, dbUpdates);
          console.log(`[UPDATE-CONVERSATION] 成功更新对话: ${id}`);
        } catch (error) {
          console.error(`❌ [STORE] Failed to update conversation ${id}:`, error);
        }
      },

      renameConversation: async (id, newTitle) => {
        if (!newTitle || typeof newTitle !== 'string') {
          console.error("Invalid title:", newTitle);
          return;
        }

        await get().updateConversation(id, { title: newTitle });
      },

      deleteConversation: async (id) => {
        set((state) => {
          state.conversations = state.conversations.filter((c: Conversation) => c.id !== id);
          if (state.currentConversationId === id) {
            state.currentConversationId = state.conversations.length > 0 ? state.conversations[0].id : null;
          }
          delete state.lastUsedModelPerChat[id];
        });

        try {
          const dbService = getDatabaseService();
          const conversationRepo = dbService.getConversationRepository();

          await conversationRepo.delete(id);
          
          // 清理会话参数
          try {
            const { ModelParametersService } = await import('@/lib/model-parameters');
            await ModelParametersService.removeSessionParameters(id);
            console.log(`[DELETE-CONVERSATION] 成功清理会话参数: ${id}`);
          } catch (error) {
            console.warn(`[DELETE-CONVERSATION] 清理会话参数失败: ${id}`, error);
          }
          
          console.log(`[DELETE-CONVERSATION] 成功删除对话: ${id}`);
        } catch (error) {
          console.error(`❌ [STORE] Failed to delete conversation ${id}:`, error);
        }
      },

      clearAllConversations: async () => {
        set({ 
          conversations: [], 
          currentConversationId: null, 
          lastUsedModelPerChat: {} 
        });

        try {
          const dbService = getDatabaseService();
          const conversationRepo = dbService.getConversationRepository();

          await conversationRepo.clearAllConversations();
          
          // 清理所有会话参数
          try {
            const { ModelParametersService } = await import('@/lib/model-parameters');
            const sessionKeys = await ModelParametersService.getAllSessionParameterKeys();
            for (const key of sessionKeys) {
              const conversationId = key.replace('session_', '').replace('_params', '');
              await ModelParametersService.removeSessionParameters(conversationId);
            }
            console.log("[CLEAR-ALL] 所有会话参数已清理");
          } catch (error) {
            console.warn("[CLEAR-ALL] 清理会话参数失败:", error);
          }
          
          console.log("[CLEAR-ALL] 所有对话和消息已清除");
        } catch (error) {
          console.error("❌ [STORE] Failed to clear all conversations:", error);
        }
      },

      setLastUsedModelForChat: (chatId, modelIdentifier) => {
        set((state) => {
          state.lastUsedModelPerChat[chatId] = modelIdentifier;
        });
      },

      setSessionLastSelectedModel: (modelIdentifier) => {
        set({ sessionLastSelectedModel: modelIdentifier });
      },

      toggleStarConversation: async (conversationId: string) => {
        try {
          const conversation = get().conversations.find(c => c.id === conversationId);
          if (!conversation) {
            console.error(`Conversation ${conversationId} not found`);
            return;
          }

          const newFavoriteStatus = !conversation.is_favorite;

          await get().updateConversation(conversationId, {
            is_favorite: newFavoriteStatus
          });
        } catch (error) {
          console.error('❌ [STORE] Failed to toggle favorite status:', error);
        }
      },

      toggleImportant: async (conversationId: string) => {
        try {
          const conversation = get().conversations.find(c => c.id === conversationId);
          if (!conversation) {
            console.error(`Conversation ${conversationId} not found`);
            return;
          }

          const newImportantStatus = !conversation.is_important;

          await get().updateConversation(conversationId, {
            is_important: newImportantStatus
          });

          console.log(`会话 ${conversationId} 重要状态已更新为: ${newImportantStatus}`);
        } catch (error) {
          console.error('❌ [STORE] Failed to toggle important status:', error);
        }
      },

      duplicateConversation: async (conversationId: string) => {
        try {
          const dbService = getDatabaseService();
          const conversationRepo = dbService.getConversationRepository();
          const messageRepo = dbService.getMessageRepository();

          const originalConv = get().conversations.find(conv => conv.id === conversationId);
          if (!originalConv) {
            console.error(`❌ [STORE] Original conversation ${conversationId} not found for duplication.`);
            return;
          }

          const newConvId = uuidv4();
          const newTitle = `clone of ${originalConv.title}`;

          const now = Date.now();
          const newConversation: Conversation = {
            id: newConvId,
            title: newTitle,
            created_at: now,
            updated_at: now,
            model_id: originalConv.model_id,
            model_provider: (originalConv as any).model_provider,
            model_full_id: (originalConv as any).model_full_id,
            is_important: originalConv.is_important,
            is_favorite: originalConv.is_favorite,
            messages: []
          };

          await conversationRepo.create({
            id: newConvId,
            title: newTitle,
            created_at: now,
            updated_at: now,
            model_id: originalConv.model_id,
            model_provider: (originalConv as any).model_provider || null,
            model_full_id: (originalConv as any).model_full_id || ((originalConv as any).model_provider ? `${(originalConv as any).model_provider}/${originalConv.model_id}` : originalConv.model_id),
            is_important: originalConv.is_important ? 1 : 0,
            is_favorite: originalConv.is_favorite ? 1 : 0,
          } as any);

          if (originalConv.messages && originalConv.messages.length > 0) {
            for (const message of originalConv.messages) {
              const newMessageId = uuidv4();

              const doc_ref_json = message.document_reference ? JSON.stringify(message.document_reference) : null;
              const kb_ref_json = message.knowledge_base_reference ? JSON.stringify(message.knowledge_base_reference) : null;

              await messageRepo.create({
                id: newMessageId,
                conversation_id: newConvId,
                role: message.role,
                content: message.content,
                created_at: message.created_at,
                updated_at: message.updated_at,
                status: message.status,
                model: message.model || null,
                document_reference: doc_ref_json,
                knowledge_base_reference: kb_ref_json,
                context_data: message.context_data || null,
                thinking_start_time: (message as any).thinking_start_time || null,
                thinking_duration: message.thinking_duration || null,
              } as any);

              newConversation.messages.push({
                ...message,
                id: newMessageId,
                conversation_id: newConvId,
              });
            }
          }

          set((state) => {
            state.conversations.unshift(newConversation);
          });

          console.log(`[DUPLICATE-CONVERSATION] 成功复制对话: ${conversationId} -> ${newConvId}`);
        } catch (error) {
          console.error(`❌ [STORE] Failed to duplicate conversation:`, error);
        }
      },
    }))
    ,
    {
      name: "chat-store",
      partialize: (state) => ({
        lastUsedModelPerChat: state.lastUsedModelPerChat,
        sessionLastSelectedModel: state.sessionLastSelectedModel,
      }),
    }
  )
); 