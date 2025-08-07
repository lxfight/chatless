import { useState, useEffect, useCallback } from 'react';
import { useChatStore } from "@/store/chatStore";
import { useProviderMetaStore } from '@/store/providerMetaStore';
import { useProviderStore } from '@/store/providerStore';
import type { ProviderMetadata } from '@/lib/metadata/types';

// Helper function to check if a modelId is valid within the metadata
const isModelValid = (modelId: string | null | undefined, metadata: ProviderMetadata[]): boolean => {
  if (!modelId || !metadata || metadata.length === 0) return false;
  for (const provider of metadata) {
    if (provider.models.some((m: any) => m.name === modelId)) {
      return true;
    }
  }
  return false;
};

export const useModelSelection = () => {
  const [llmInitialized, setLlmInitialized] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [persistentLastModel, setPersistentLastModel] = useState<string | null>(null);
  const [currentProviderName, setCurrentProviderName] = useState<string>('');

  const allMetadata = useProviderMetaStore((s)=>s.list as unknown as ProviderMetadata[]);

  // 确保 ProviderStore 已初始化（解决聊天界面首次不显示模型的问题）
  const providerStoreInit = useProviderStore((s)=>s.init);
  useEffect(()=>{ 
    // 只在组件首次挂载时初始化，避免重复初始化
    const initProviderStore = async () => {
      try {
        await providerStoreInit();
      } catch (error) {
        console.warn('[useModelSelection] ProviderStore初始化失败:', error);
      }
    };
    
    // 检查是否已经初始化过
    const isInitialized = useProviderStore.getState().providers.length > 0;
    if (!isInitialized) {
      console.log('[useModelSelection] 首次初始化ProviderStore');
      initProviderStore();
    } else {
      console.log('[useModelSelection] ProviderStore已初始化，跳过');
    }
  }, []); // 移除providerStoreInit依赖，避免重复执行
  
  const currentConversationId = useChatStore((state) => state.currentConversationId);
  const lastUsedModel = useChatStore((state) => 
    currentConversationId ? state.lastUsedModelPerChat[currentConversationId] : null
  );
  const setLastUsedModelForChat = useChatStore((state) => state.setLastUsedModelForChat);
  const setSessionLastSelectedModel = useChatStore((state) => state.setSessionLastSelectedModel);
  const sessionLastSelectedModel = useChatStore((state) => state.sessionLastSelectedModel);
  const updateConversation = useChatStore((state) => state.updateConversation);


  // Initialize LLM (只做一次，metadata 由 Provider 管理统一提供)
  useEffect(() => {
    const init = async () => {
      setLlmInitialized(false);
      try {
        const { initializeLLM, getInterpreter } = await import('@/lib/llm');
        const ok = await initializeLLM();
        setLlmInitialized(ok);
      } catch (e) {
        console.error('[useModelSelection] LLM init failed', e);
        setLlmInitialized(false);
      }
    };
    
    // 检查是否已经初始化过
    const checkInitialization = async () => {
      try {
        const { getInterpreter } = await import('@/lib/llm');
        const isAlreadyInitialized = getInterpreter() !== null;
        if (!isAlreadyInitialized) {
          console.log('[useModelSelection] 首次初始化LLM系统');
          init();
        } else {
          console.log('[useModelSelection] LLM系统已初始化，跳过');
          setLlmInitialized(true);
        }
      } catch (e) {
        console.log('[useModelSelection] 检查初始化状态失败，执行初始化');
        init();
      }
    };
    
    checkInitialization();
  }, []); // 只在组件首次挂载时执行

  // Select initial model
  useEffect(() => {
    if (!llmInitialized || allMetadata.length === 0) {
      return;
    }

    const selectInitialModel = async () => {
        let targetModelId: string | null = null;
        let modelSource: string = 'None';
        const currentChatId = currentConversationId;

        if (persistentLastModel) {
            targetModelId = persistentLastModel;
            modelSource = 'Persistent Last';
        }

        if (!targetModelId && sessionLastSelectedModel) {
            const [providerName, modelName] = sessionLastSelectedModel.split('/');
            if (isModelValid(modelName, allMetadata)) {
                targetModelId = modelName;
                modelSource = 'Last Selected (Session)';
            }
        }

        if (!targetModelId && currentChatId && lastUsedModel && isModelValid(lastUsedModel, allMetadata)) {
            targetModelId = lastUsedModel;
            modelSource = 'Last Used (Conversation)';
        } else if (currentChatId && lastUsedModel) {
            console.warn(`[Model Selection] Last used model '${lastUsedModel}' for chat ${currentChatId} is no longer valid.`);
            setLastUsedModelForChat(currentChatId, '');
        }

        if (!targetModelId) {
            if (allMetadata.length > 0 && allMetadata[0].models.length > 0) {
                targetModelId = allMetadata[0].models[0].name;
                modelSource = 'First Available';
            } else {
                 console.warn("[Model Selection] No models available in metadata.");
            }
        }

        console.log(`[Model Selection] Initial model set to: ${targetModelId || 'None'} (Source: ${modelSource})`);
        if (targetModelId !== selectedModelId) {
             setSelectedModelId(targetModelId); 
        }
    };

    selectInitialModel();

  }, [llmInitialized, allMetadata, currentConversationId, lastUsedModel, setLastUsedModelForChat, sessionLastSelectedModel, selectedModelId, persistentLastModel]);

  // Update provider name based on selected model
  useEffect(() => {
    if (selectedModelId && allMetadata.length > 0) {
      const provider = allMetadata.find(p => p.models.some((m: any) => m.name === selectedModelId));
      setCurrentProviderName(provider ? provider.name : '');
    } else {
      setCurrentProviderName('');
    }
  }, [selectedModelId, allMetadata]);

  // 初始化时读取持久化的 lastSelectedModel
  useEffect(() => {
    (async () => {
      try {
        const { specializedStorage } = await import('@/lib/storage');
        const last = await specializedStorage.models.getLastSelectedModel();
        if (last) {
          setSelectedModelId(last);
          setPersistentLastModel(last);
        }
      } catch (_) {}
    })();
  }, []);

  // 每次 selectedModelId 变化时写入缓存
  useEffect(() => {
    if (!selectedModelId) return;
    (async () => {
      try {
        const { specializedStorage } = await import('@/lib/storage');
        await specializedStorage.models.setLastSelectedModel(selectedModelId);
        // 同步更新内存中的 persistentLastModel，防止初始模型逻辑覆盖用户选择
        setPersistentLastModel(selectedModelId);
      } catch (_) {}
    })();
  }, [selectedModelId]);

  // Handle model change
  const handleModelChange = useCallback((newModelId: string) => {
    setSelectedModelId(newModelId);
    setPersistentLastModel(newModelId);
    if (currentConversationId) {
        updateConversation(currentConversationId, {
        model_id: newModelId
      });
    }
    
    const provider = allMetadata.find(p => p.models.some((m: any) => m.name === newModelId));
    if (provider) {
      setSessionLastSelectedModel(`${provider.name}/${newModelId}`);
    } else {
      setSessionLastSelectedModel('');
      console.warn(`[Model Change] Provider not found for newly selected model ${newModelId}. Session model reset.`);
    }
  }, [allMetadata, currentConversationId, setSessionLastSelectedModel, updateConversation]);

  return {
    llmInitialized,
    allMetadata,
    selectedModelId,
    currentProviderName,
    handleModelChange
  };
}; 