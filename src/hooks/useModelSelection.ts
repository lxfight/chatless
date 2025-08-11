import { useState, useEffect, useCallback, useMemo } from 'react';
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
  const [persistentLastPair, setPersistentLastPair] = useState<{provider: string; modelId: string} | null>(null);
  const [currentProviderName, setCurrentProviderName] = useState<string>('');

  // 统一来源：使用 providerMetaStore，并在读取时过滤不可见项，保证与设置页一致
  const allMetadataRaw = useProviderMetaStore((s)=>s.list as unknown as ProviderMetadata[]);
  const allMetadata = useMemo(
    () => (allMetadataRaw || []).filter((p: any) => p?.isVisible !== false),
    [allMetadataRaw]
  );

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
  // 移除会话内临时 sessionLastSelectedModel 的依赖，统一使用 storage pair
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

  // Select initial model (防止重复切换)
  useEffect(() => {
    if (!llmInitialized || allMetadata.length === 0) return;

    // 如果当前已选择且仍然有效，直接返回，避免重复触发
    if (selectedModelId && isModelValid(selectedModelId, allMetadata)) return;

    const selectInitialModel = async () => {
      let targetModelId: string | null = null;
      let modelSource = 'None';
      const currentChatId = currentConversationId;

      // 1) 会话级持久化选择
      if (currentChatId) {
        try {
          const { specializedStorage } = await import('@/lib/storage');
          const convSel = await specializedStorage.models.getConversationSelectedModel(currentChatId);
          if (convSel?.modelId && isModelValid(convSel.modelId, allMetadata)) {
            targetModelId = convSel.modelId;
            modelSource = 'Conversation Selected';
          }
        } catch (_) {}
      }

      // 2) 全局最近选择（pair）
      if (!targetModelId && persistentLastModel && isModelValid(persistentLastModel, allMetadata)) {
        targetModelId = persistentLastModel;
        modelSource = 'Global Last Pair';
      }

      // 3) 会话最近使用
      if (!targetModelId && currentChatId && lastUsedModel && isModelValid(lastUsedModel, allMetadata)) {
        targetModelId = lastUsedModel;
        modelSource = 'Last Used (Conversation)';
      } else if (currentChatId && lastUsedModel) {
        console.warn(`[Model Selection] Last used model '${lastUsedModel}' for chat ${currentChatId} is no longer valid.`);
        setLastUsedModelForChat(currentChatId, '');
      }

      // 4) 默认第一个可用模型
      if (!targetModelId) {
        if (allMetadata.length > 0 && allMetadata[0].models.length > 0) {
          targetModelId = allMetadata[0].models[0].name;
          modelSource = 'First Available';
        } else {
          console.warn('[Model Selection] No models available in metadata.');
        }
      }

      console.log(`[Model Selection] Initial model set to: ${targetModelId || 'None'} (Source: ${modelSource})`);
      if (targetModelId && targetModelId !== selectedModelId) {
        setSelectedModelId(targetModelId);
      }
    };

    selectInitialModel();
  }, [llmInitialized, allMetadata, currentConversationId, lastUsedModel, setLastUsedModelForChat, selectedModelId, persistentLastModel]);

  // Update provider name based on selected model（若存在同名模型，优先使用 persistentLastPair 中记录的 provider）
  useEffect(() => {
    if (!selectedModelId || allMetadata.length === 0) {
      setCurrentProviderName('');
      return;
    }

    let provider;
    if (persistentLastPair && persistentLastPair.modelId === selectedModelId) {
      provider = allMetadata.find(p => p.name === persistentLastPair.provider && p.models.some((m: any) => m.name === selectedModelId));
    }
    if (!provider) {
      provider = allMetadata.find(p => p.models.some((m: any) => m.name === selectedModelId));
    }
    setCurrentProviderName(provider ? provider.name : '');
  }, [selectedModelId, allMetadata, persistentLastPair]);

  // 初始化时读取持久化的 {provider, modelId}
  useEffect(() => {
    (async () => {
      try {
        const { specializedStorage } = await import('@/lib/storage');
        const pair = await specializedStorage.models.getLastSelectedModelPair();
        if (pair && pair.modelId) {
          setSelectedModelId(pair.modelId);
          setPersistentLastModel(pair.modelId);
          setPersistentLastPair(pair);
        }
      } catch (_) {}
    })();
  }, []);

  // 每次 selectedModelId 变化时写入缓存（仅写 pair）
  useEffect(() => {
    if (!selectedModelId) return;
    (async () => {
      try {
        const { specializedStorage } = await import('@/lib/storage');
        const provider = allMetadata.find(p => p.models.some((m: any) => m.name === selectedModelId))?.name || '';
        if (provider) {
          await specializedStorage.models.setLastSelectedModelPair(provider, selectedModelId);
          setPersistentLastPair({ provider, modelId: selectedModelId });
        }
        // 同步更新内存中的 persistentLastModel，防止初始模型逻辑覆盖用户选择
        setPersistentLastModel(selectedModelId);
      } catch (_) {}
    })();
  }, [selectedModelId, allMetadata]);

  // Handle model change
  const handleModelChange = useCallback((newModelId: string) => {
    setSelectedModelId(newModelId);
    setPersistentLastModel(newModelId);
    if (currentConversationId) {
        const provider = allMetadata.find(p => p.models.some((m: any) => m.name === newModelId));
        updateConversation(currentConversationId, {
          model_id: newModelId,
          model_provider: provider ? provider.name : undefined,
          model_full_id: provider ? `${provider.name}/${newModelId}` : newModelId,
        });
    }
    
    const provider = allMetadata.find(p => p.models.some((m: any) => m.name === newModelId));
    if (provider) {
      // 会话级选择记录 provider+modelId，保障恢复
      (async () => {
        try {
          const { specializedStorage } = await import('@/lib/storage');
          if (currentConversationId) {
            await specializedStorage.models.setConversationSelectedModel(currentConversationId, provider.name, newModelId);
          }
          await specializedStorage.models.setLastSelectedModelPair(provider.name, newModelId);
        } catch (_) {}
      })();
    } else {
      console.warn(`[Model Change] Provider not found for newly selected model ${newModelId}. Session model reset.`);
    }
  }, [allMetadata, currentConversationId, updateConversation]);

  return {
    llmInitialized,
    allMetadata,
    selectedModelId,
    currentProviderName,
    handleModelChange
  };
}; 