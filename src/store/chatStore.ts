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
}

interface ChatActions {
  loadConversations: () => Promise<void>;
  createConversation: (title: string, modelId: string) => Promise<string>;
  deleteConversation: (conversationId: string) => Promise<void>;
  setCurrentConversation: (conversationId: string) => void;
  addMessage: (message: Message) => Promise<Message | null>;
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
          const messageRepo = dbService.getMessageRepository();

          startupMonitor.startPhase('获取对话列表');
          const conversations = await conversationRepo.findAll(
            undefined,
            [{ field: 'updated_at', direction: 'DESC' }]
          );
          startupMonitor.endPhase('获取对话列表');

          console.log(`🔄 [LOAD-CONVERSATIONS] 从数据库加载了 ${conversations.length} 个对话`);

          // 并行加载消息以提升性能
          startupMonitor.startPhase('并行加载消息');
          const messagePromises = conversations.map(async (conv) => {
            const messages = await messageRepo.getMessagesByConversation(conv.id);
            return { conversationId: conv.id, messages };
          });

          const messageResults = await Promise.all(messagePromises);
          startupMonitor.endPhase('并行加载消息');
          
          const messageMap = new Map(
            messageResults.map(result => [result.conversationId, result.messages])
          );

          startupMonitor.startPhase('数据处理');
          const loadedConversations: Conversation[] = conversations.map((conv) => {
            const messages = messageMap.get(conv.id) || [];

            const processedMessages: Message[] = messages.map((msg: any) => {
              
              let doc_ref = undefined;
              if (msg.document_reference) {
                if (typeof msg.document_reference === 'object' && !Array.isArray(msg.document_reference)) {
                  doc_ref = msg.document_reference;
                } 
                else if (typeof msg.document_reference === 'string') {
                  try {
                    doc_ref = JSON.parse(msg.document_reference);
                  } catch (e) {
                    console.error(`[STORE] 解析文档引用失败 (msgId: ${msg.id}):`, e);
                  }
                }
              }

              let kb_ref = undefined;
              if (msg.knowledge_base_reference) {
                if (typeof msg.knowledge_base_reference === 'object' && !Array.isArray(msg.knowledge_base_reference)) {
                  kb_ref = msg.knowledge_base_reference;
                }
                else if (typeof msg.knowledge_base_reference === 'string') {
                  try {
                    kb_ref = JSON.parse(msg.knowledge_base_reference);
                  } catch (e) {
                    console.error(`[STORE] 解析知识库引用失败 (msgId: ${msg.id}):`, e);
                  }
                }
              }
              
              return {
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
            });

            const convAny = conv as any;
            const conversationData: Conversation = {
              id: convAny.id,
              title: convAny.title,
              created_at: convAny.created_at || convAny.created_at,
              updated_at: convAny.updated_at || convAny.updated_at,
              model_id: convAny.model_id || convAny.model_id || 'default',
              is_important: convAny.is_important === true || convAny.is_important === 1,
              is_favorite: convAny.is_favorite === true || convAny.is_favorite === 1,
              messages: processedMessages,
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
          startupMonitor.endPhase('并行加载消息');
          startupMonitor.endPhase('数据处理');
          
          console.error('❌ [LOAD-CONVERSATIONS] 加载对话失败:', error);
          set({ isLoadingConversations: false });
        }
      },

      createConversation: async (title, modelId) => {
        const now = Date.now();
        const newConversation: Conversation = {
          id: uuidv4(),
          title,
          created_at: now,
          updated_at: now,
          messages: [],
          model_id: modelId || 'default',
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

          await messageRepo.create({
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
          } as any);

          console.log(`[STORE] 消息保存成功: ${newMessage.id}`);
        } catch (error) {
          console.error("❌ [STORE] Failed to save message to DB:", error);
          set((state) => {
            const conversation = state.conversations.find((c: Conversation) => c.id === conversation_id);
            const messageIndex = conversation?.messages?.findIndex((m: Message) => m.id === newMessage.id);
            if (conversation && conversation.messages && messageIndex !== undefined && messageIndex > -1) {
              Object.assign(conversation.messages[messageIndex], { status: 'error' });
            }
          });
          return null;
        }

        return newMessage;
      },

      updateMessageContentInMemory: (messageId, content) => {
        const now = Date.now();
        set(state => {
          for (const conv of state.conversations) {
            const msg = conv.messages?.find(m => m.id === messageId);
            if (msg) {
              msg.content = content;
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
              Object.assign(msg, finalUpdates);
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
                  if (finalContent) Object.assign(message, { content: finalContent });
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

          if (finalContent) {
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
          if ('model_id' in updates) dbUpdates.model_id = updates.model_id;
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