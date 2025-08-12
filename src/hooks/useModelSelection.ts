import { useState, useEffect, useCallback, useMemo } from 'react';
import { useChatStore } from "@/store/chatStore";
import { useProviderMetaStore } from '@/store/providerMetaStore';
import { useProviderStore } from '@/store/providerStore';
import type { ProviderMetadata } from '@/lib/metadata/types';

// Helper: 校验模型是否在指定 provider 下有效（若未提供 provider，则在所有 provider 下查找）
const isModelValid = (
  modelId: string | null | undefined,
  metadata: ProviderMetadata[],
  providerName?: string | null
): boolean => {
  if (!modelId || !metadata || metadata.length === 0) return false;
  if (providerName) {
    const p = metadata.find((pp) => pp.name === providerName);
    return !!p && p.models.some((m: any) => m.name === modelId);
  }
  for (const provider of metadata) {
    if (provider.models.some((m: any) => m.name === modelId)) return true;
  }
  return false;
};

export const useModelSelection = () => {
  const [llmInitialized, setLlmInitialized] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [persistentLastModel, setPersistentLastModel] = useState<string | null>(null);
  const [persistentLastPair, setPersistentLastPair] = useState<{provider: string; modelId: string} | null>(null);
  const [currentProviderName, setCurrentProviderName] = useState<string>('');
  // 标记是否已完成从存储读取的初始化，避免在初始化阶段把 provider 覆盖成“第一个匹配项”
  const [storageInitialized, setStorageInitialized] = useState(false);

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
  const currentConversationProvider = useChatStore((state) => {
    const id = state.currentConversationId;
    const conv = id ? state.conversations.find((c:any)=>c.id===id) : null;
    return conv?.model_provider || null;
  });
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
      let targetProviderName: string | null = null;
      let modelSource = 'None';
      const currentChatId = currentConversationId;

      // 1) 会话级持久化选择
      if (currentChatId) {
        try {
          const { specializedStorage } = await import('@/lib/storage');
          const convSel = await specializedStorage.models.getConversationSelectedModel(currentChatId);
          if (convSel?.modelId && isModelValid(convSel.modelId, allMetadata, convSel.provider)) {
            targetModelId = convSel.modelId;
            targetProviderName = convSel.provider || null;
            modelSource = 'Conversation Selected';
          }
        } catch (_) {}
      }

      // 2) 全局最近选择（pair）
      if (!targetModelId && persistentLastModel && isModelValid(persistentLastModel, allMetadata, persistentLastPair?.provider)) {
        targetModelId = persistentLastModel;
        modelSource = 'Global Last Pair';
        if (persistentLastPair?.provider) targetProviderName = persistentLastPair.provider;
      }

      // 3) 会话最近使用
      if (!targetModelId && currentChatId && lastUsedModel && isModelValid(lastUsedModel, allMetadata, currentConversationProvider)) {
        targetModelId = lastUsedModel;
        targetProviderName = currentConversationProvider;
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
          targetProviderName = allMetadata[0].name;
        } else {
          console.warn('[Model Selection] No models available in metadata.');
        }
      }

      console.log(`[Model Selection] Initial model set to: ${targetModelId || 'None'} (Source: ${modelSource})`);
      if (targetModelId && targetModelId !== selectedModelId) {
        setSelectedModelId(targetModelId);
      }
      if (targetProviderName) {
        setCurrentProviderName(targetProviderName);
      } else if (targetModelId) {
        // 兜底：从 metadata 中找第一个包含该模型的 provider（仅首次初始化时用）
        const p = allMetadata.find(p => p.models.some((m: any) => m.name === targetModelId));
        if (p) setCurrentProviderName(p.name);
      }
    };

    selectInitialModel();
  }, [llmInitialized, allMetadata, currentConversationId, lastUsedModel, setLastUsedModelForChat, selectedModelId, persistentLastModel]);

  // 当仅变更 selectedModelId 而 provider 未显式设置时，尽量保持现有 provider
  useEffect(() => {
    if (!selectedModelId || allMetadata.length === 0) return;
    if (currentProviderName) return; // 已有明确 provider，不覆盖
    let provider;
    if (persistentLastPair && persistentLastPair.modelId === selectedModelId) {
      provider = allMetadata.find(p => p.name === persistentLastPair.provider && p.models.some((m: any) => m.name === selectedModelId));
    }
    if (!provider) {
      provider = allMetadata.find(p => p.models.some((m: any) => m.name === selectedModelId));
    }
    if (provider) setCurrentProviderName(provider.name);
  }, [selectedModelId, allMetadata, persistentLastPair]);

  // 初始化时读取持久化的 {provider, modelId}
  useEffect(() => {
    (async () => {
      try {
        const { specializedStorage } = await import('@/lib/storage');
        // —— 迁移逻辑：如果历史 recentModels 是 string[]，转换为 pair[] ——
        try {
          const legacy = await specializedStorage.models.getRecentModels();
          if (Array.isArray(legacy) && legacy.length > 0 && typeof legacy[0] === 'string') {
            const legacyIds = legacy as unknown as string[];
            const pairs: Array<{provider: string; modelId: string}> = [];
            // 尽最大努力：按当前元数据反查第一个包含该模型的 provider
            legacyIds.forEach((mid) => {
              const p = allMetadata.find(pp => pp.models.some((m:any)=>m.name===mid));
              if (p) pairs.push({ provider: p.name, modelId: mid });
            });
            await specializedStorage.models.setRecentModels(pairs);
          }
        } catch (_) {}

        const pair = await specializedStorage.models.getLastSelectedModelPair();
        if (pair && pair.modelId) {
          setSelectedModelId(pair.modelId);
          setPersistentLastModel(pair.modelId);
          setPersistentLastPair(pair);
        }
      } catch (_) {}
      // 无论是否读到，都视为已完成初始化
      setStorageInitialized(true);
    })();
  }, [allMetadata]);

  // 每次 selectedModelId 变化时写入缓存（仅写 pair）
  useEffect(() => {
    // 1) 需要一个明确的 selectedModelId
    if (!selectedModelId) return;
    // 2) 避免在读取存储但 provider 还未确定时被覆盖
    if (!storageInitialized) return;

    (async () => {
      try {
        const { specializedStorage } = await import('@/lib/storage');

        // 优先使用当前上下文中的 provider
        let providerName: string | undefined;
        if (currentProviderName && isModelValid(selectedModelId, allMetadata, currentProviderName)) {
          providerName = currentProviderName;
        } else if (persistentLastPair && persistentLastPair.modelId === selectedModelId) {
          // 其次使用持久化的 provider（若匹配当前模型）
          const ok = isModelValid(selectedModelId, allMetadata, persistentLastPair.provider);
          providerName = ok ? persistentLastPair.provider : undefined;
        }

        // 兜底：从元数据中找到第一个包含该模型的 provider（仅在以上两者都缺失时）
        if (!providerName) {
          providerName = allMetadata.find(p => p.models.some((m: any) => m.name === selectedModelId))?.name;
        }

        if (providerName) {
          await specializedStorage.models.setLastSelectedModelPair(providerName, selectedModelId);
          setPersistentLastPair({ provider: providerName, modelId: selectedModelId });
        }
        setPersistentLastModel(selectedModelId);
      } catch (_) {}
    })();
  }, [selectedModelId, allMetadata, currentProviderName, persistentLastPair, storageInitialized]);

  // Handle model change
  const handleModelChange = useCallback((value: string) => {
    let providerName: string | undefined;
    let newModelId = value;
    if (value.includes('::')) {
      const parts = value.split('::');
      if (parts.length === 2) {
        providerName = parts[0];
        newModelId = parts[1];
      }
    }

    setSelectedModelId(newModelId);
    setPersistentLastModel(newModelId);
    if (providerName) setCurrentProviderName(providerName);

    // 精确定位 provider：优先使用传入的 providerName
    let provider = providerName
      ? allMetadata.find(p => p.name === providerName && p.models.some((m: any) => m.name === newModelId))
      : allMetadata.find(p => p.models.some((m: any) => m.name === newModelId));

    if (currentConversationId) {
      updateConversation(currentConversationId, {
        model_id: newModelId,
        model_provider: provider ? provider.name : undefined,
        model_full_id: provider ? `${provider.name}/${newModelId}` : newModelId,
      });
    }

    if (provider) {
      (async () => {
        try {
          const { specializedStorage } = await import('@/lib/storage');
          if (currentConversationId) {
            await specializedStorage.models.setConversationSelectedModel(currentConversationId, provider.name, newModelId);
          }
          await specializedStorage.models.setLastSelectedModelPair(provider.name, newModelId);
          setPersistentLastPair({ provider: provider.name, modelId: newModelId });
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