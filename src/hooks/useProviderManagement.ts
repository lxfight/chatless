import { useState, useEffect, useCallback, useRef } from 'react';
import type { ProviderMetadata } from '@/lib/metadata/types';
import { toast } from '@/components/ui/sonner';

// 新的 ProviderStatusStore
import {
  useProviderStatusStore,
  ProviderStatusCode,
} from '@/store/providerStatusStore';
import { ProviderRegistry } from '@/lib/llm';
import { useOllamaStore } from '@/store/ollamaStore';
import { KeyManager } from '@/lib/llm/KeyManager';
import { useProviderMetaStore } from '@/store/providerMetaStore';
import { useProviderStore } from '@/store/providerStore';
import { mapToProviderWithStatus } from '@/lib/provider/transform';
import { preloadProviderAndModelLogos } from '@/lib/utils/logoPreloader';

// Dev mode flag for debug logging (currently unused, can be removed if not needed)
// const DEV_MODE = isDevelopmentEnvironment();

// --- 类型定义 ---
// (可以考虑移到单独的 types 文件)
export interface ProviderWithStatus extends ProviderMetadata {
  isConnected?: boolean;
  displayStatus?: 'CONNECTED' | 'CONNECTING' | 'NOT_CONNECTED' | 'NO_KEY' | 'UNKNOWN' | 'NO_FETCHER';
  statusTooltip?: string | null;
  healthCheckPath?: string;
  authenticatedHealthCheckPath?: string;
  isUserAdded?: boolean;
  isVisible?: boolean;
  /** 高级偏好设置 */
  preferences?: {
    /** 是否使用浏览器请求方式（兜底模式） */
    useBrowserRequest?: boolean;
  };
}

// --- 通用连接检查函数已抽离到 ProviderService，避免重复实现 ---

// 删除 specializedStorage 顶部导入
// import removed: specializedStorage no longer used

// 删除未使用的 isInitialCheckDoneRef


// 将旧函数 buildInitialProviders/runInitialChecks/loadData 改为占位（以后可彻底删除）


// --- 主 Hook ---
export function useProviderManagement() {
  const { map: statusMap, setStatus: setStatusStore } = useProviderStatusStore();
  const { models: ollamaModels, refreshModels: refreshOllamaModels, hasOnlineFetched } = useOllamaStore();
  const setGlobalQuickList = useProviderMetaStore(s=>s.setList);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 合并 Repository 数据与 StatusStore，以 StatusStore 为最终展示状态
  const providers = useProviderStore(s => s.providers)
    .map(mapToProviderWithStatus)
    .filter((p:any)=>p.isVisible!==false)
    .map(p=>{
      const st = statusMap[p.name];
      if(!st) return p;
      return { ...p, displayStatus: st.status, isConnected: st.status==='CONNECTED', statusTooltip: st.message ?? undefined } as ProviderWithStatus;
    });

  const {
    providers: repoProviders,
    isLoading: repoLoading,
    init: initProviders,
    refreshAll: storeRefreshAll,
  } = useProviderStore();
  const setConnecting = useProviderMetaStore(s=>s.setConnecting);

  // 页面卸载取消标记
  const cancelledRef = useRef<boolean>(false);
  useEffect(() => {
    cancelledRef.current = false;
    return () => { cancelledRef.current = true; };
  }, []);

  // 初始加载 - 调用 store.init()
  useEffect(() => {
    initProviders().catch(console.error);
  }, [initProviders]);

  // 替换同步 effect
  useEffect(() => {
    (async () => {
      const converted = repoProviders
        .map(mapToProviderWithStatus)
        .filter((p:any) => p.isVisible !== false)
        .map(p => {
          // 启动时清理任何遗留的CONNECTING状态
          if (p.displayStatus === 'CONNECTING') {
            console.warn(`发现遗留的CONNECTING状态：${p.name}，将重置为UNKNOWN`);
            return { ...p, displayStatus: 'UNKNOWN' as const, statusTooltip: '状态未知，请手动刷新' };
          }
          return p;
        });

      setIsLoading(repoLoading);
      try { preloadProviderAndModelLogos(converted as any).catch(()=>{}); } catch { /* noop */ }
    })();
     
  }, [repoProviders, repoLoading]);

  // 初始化时对“检查过期”的 Provider 进行一次静默检查
  const didInitCheckRef = useRef(false);
  useEffect(() => {
    if (didInitCheckRef.current) return;
    didInitCheckRef.current = true;
    (async () => {
      try {
        const { providerRepository } = await import('@/lib/provider/ProviderRepository');
        const list = await providerRepository.getAll();
        const STALE_MS = 10 * 60 * 1000; // 10 分钟
        const now = Date.now();
        const stale = list.filter(p => !p.lastChecked || (now - (p.lastChecked || 0)) > STALE_MS);
        if (stale.length === 0) return;
        const { checkController } = await import('@/lib/provider/check-controller');
        stale.forEach((p, idx) => {
          setTimeout(() => {
            try { checkController.requestCheck(p.name, { reason: 'init', debounceMs: 0, withModels: false }); } catch {}
          }, idx * 150);
        });
      } catch { /* noop */ }
    })();
  }, []);

  // ---- 将 providers 同步到全局 store (providerMetaStore) ----
  useEffect(() => {
    setGlobalQuickList(providers as any);
  }, [providers, setGlobalQuickList]);

  // 不再需要本地过滤 useState

  // --- 数据加载 (loadData) ---
  // loadData 函数已废弃

  // --- 刷新单个 Provider（由 checkController 统一调度） ---
  const handleSingleProviderRefresh = useCallback(async (provider: ProviderWithStatus, showToast: boolean = true) => {
    const repoName = provider.aliases?.[0] || provider.name;
    if (cancelledRef.current) return;

    // 设置 CONNECTING 状态
    setStatusStore(provider.name, {
      status: 'CONNECTING',
      message: '正在检查连接状态...',
      lastChecked: Date.now(),
    });

    const { checkController } = await import('@/lib/provider/check-controller');

    await new Promise<void>((resolve) => {
      const offStart = checkController.on('start', (p)=>{
        if (p.name !== repoName) return;
        setConnecting(provider.name, true);
      });
      const offSuccess = checkController.on('success', (p)=>{
        if (p.name !== repoName) return;
        setConnecting(provider.name, false);
        setStatusStore(provider.name, {
          status: p.status as ProviderStatusCode,
          message: p.message ?? (p.status==='CONNECTED'?'连接正常':undefined),
          lastChecked: Date.now(),
        });
        if (showToast) {
          if (p.status === 'CONNECTED') {/*不需要这个多余提示，状态已经显示了*/}
          else if (p.status === 'NOT_CONNECTED') toast.error(`${provider.name} 状态检查失败`, { description: p.message || '请检查服务地址和网络连接' });
          else if (p.status === 'NO_KEY') toast.error(`${provider.name} 未配置API密钥`, { description: '请在设置中配置API密钥' });
        }
        offStart(); offSuccess(); offFail(); offTimeout();
        resolve();
      });
      const offFail = checkController.on('fail', (p)=>{
        if (p.name !== repoName) return;
        setConnecting(provider.name, false);
        setStatusStore(provider.name, {
          status: 'NOT_CONNECTED',
          message: p.message || '检查失败',
          lastChecked: Date.now(),
        });
        if (showToast) toast.error(`刷新 ${provider.name} 失败`, { description: p.message || '请检查网络连接' });
        offStart(); offSuccess(); offFail(); offTimeout();
        resolve();
      });
      const offTimeout = checkController.on('timeout', (p)=>{
        if (p.name !== repoName) return;
        setConnecting(provider.name, false);
        setStatusStore(provider.name, {
          status: 'NOT_CONNECTED',
          message: '连接超时，请稍后重试',
          lastChecked: Date.now(),
        });
        if (showToast) toast.error(`${provider.name} 连接超时`, { description: '请稍后重试或检查网络' });
        offStart(); offSuccess(); offFail(); offTimeout();
        resolve();
      });

      checkController.requestCheck(repoName, { reason: 'manual', debounceMs: 0, withModels: true });
    });
  }, [setConnecting, setStatusStore]);

  // --- EFFECT 1: Load Initial Data on Mount ---
  // Effect 1 被移除：首次连通性检查已在 loadData > runInitialChecks 完成。

  // Effect 2 被移除：首次连通性检查已在 loadData > runInitialChecks 完成。

  // --- EFFECT 3: Sync internal providers state with ollamaStore ---
  useEffect(() => {
    console.log("[useProviderManagement] Effect 3: Ollama models sync START", ollamaModels);
    // 覆盖策略：
    // - 若从未在线拉取过（hasOnlineFetched=false），并且 store 为空：不覆盖，保持仓库/静态模型，避免误清空。
    // - 一旦进行过在线拉取（无论结果是否为空），则以 store 为准覆盖到 UI，保证“空列表”也能反映真实状态；
    //   这可以解决从地址 A(20 个) 切换到地址 B(3 个) 后，旧模型残留的问题。
    if (!hasOnlineFetched && (!ollamaModels || ollamaModels.length === 0)) {
      console.log("[useProviderManagement] Effect 3: no online fetch yet and store empty, keep current provider models.");
      return;
    }
    // setProviders(currentProviders => { // This line was removed as per the edit hint
    //     const ollamaProvider = currentProviders.find(p => p.name === 'Ollama');
    //     if (!ollamaProvider) return currentProviders; // Ollama provider might not exist yet

    //     const currentOllamaModelNames = ollamaProvider.models.map(m => m.name) || [];
    //     if (currentOllamaModelNames.length === ollamaModels.length &&
    //         currentOllamaModelNames.every(name => ollamaModels.includes(name))) {
    //         console.log("[useProviderManagement] Effect 3: Internal Ollama models already match store. Skipping update.");
    //         return currentProviders;
    //     }

    //     console.log(`[useProviderManagement] Effect 3: Updating Ollama provider models in internal state.`);
    //     return currentProviders.map(provider => {
    //         if (provider.name === 'Ollama') {
    //             const updatedModels = ollamaModels.map((modelName: string): ModelMetadata => {
    //                 const existingModelData = provider.models.find((m: ModelMetadata) => m.name === modelName);
    //                 return {
    //                     name: modelName,
    //                     aliases: existingModelData?.aliases || [modelName],
    //                     api_key: existingModelData?.api_key
    //                 };
    //             });
    //             return { ...provider, models: updatedModels };
    //         }
    //         return provider;
    //     });
    // }); // This line was removed as per the edit hint
    console.log("[useProviderManagement] Effect 3: Ollama models sync END");
  }, [ollamaModels, hasOnlineFetched]);

  // --- 其他处理函数 ---
  
  // 处理URL保存后的状态更新
  const updateProviderStatusAfterUrlChange = useCallback((providerName: string, _newUrl: string) => {
    setStatusStore(providerName, {
      status: 'UNKNOWN',
      message: 'URL已更改，请刷新',
      lastChecked: Date.now(),
    }, false);
  }, [setStatusStore]);

  const handleServiceUrlChange = useCallback(async (providerName: string, newUrl: string) => {
    // 移除立即更新providers状态的代码，避免在用户输入时重置输入框
    // setProviders(prev =>
    //     prev.map(p =>
    //         p.name === providerName ? { ...p, api_base_url: newUrl, displayStatus: 'UNKNOWN', isConnected: undefined, statusTooltip: 'URL已更改，请刷新' } : p
    //     )
    // );
    
    try {
      // 处理空URL的情况
      const effectiveUrl = newUrl.trim() || (providerName === 'Ollama' ? 'http://localhost:11434' : '');
      // 始终写入（避免因本地 state 未同步导致跳过写入的情况）
      
      // 保存到 ProviderRepository
      const { providerRepository } = await import('@/lib/provider/ProviderRepository');
      await providerRepository.update({ name: providerName, url: effectiveUrl });

      // 如果是 Ollama，同时保存到 OllamaConfigService
      if (providerName === 'Ollama') {
        const { OllamaConfigService } = await import('@/lib/config/OllamaConfigService');
        // 如果URL为空，清除配置而不是保存空字符串
        if (!newUrl.trim()) {
          const config = await OllamaConfigService.getConfig();
          delete config.api_base_url;
          await OllamaConfigService.setConfig(config);
          console.log(`[useProviderManagement] Ollama URL 已清除，将使用默认值`);
        } else {
          await OllamaConfigService.setOllamaUrl(newUrl);
          console.log(`[useProviderManagement] Ollama URL 已保存到 OllamaConfigService: ${newUrl}`);
        }
      }

      // 保存成功后更新状态
      updateProviderStatusAfterUrlChange(providerName, effectiveUrl);

      toast.success("服务地址已保存", { description: "请手动刷新以检测新地址。" });

      // 同步更新 ProviderRegistry 中的 Provider 实例 baseUrl
      try {
        const strat = ProviderRegistry.get(providerName);
        if (strat) {
          (strat as any).baseUrl = effectiveUrl;
          console.log(`[useProviderManagement] Updated ProviderRegistry baseUrl for ${providerName} → ${effectiveUrl}`);
        }
        
        // 如果是Ollama，同时更新llm/index中的OllamaProvider
        if (providerName === 'Ollama') {
          const { updateOllamaProviderUrl } = await import('@/lib/llm');
          await updateOllamaProviderUrl(effectiveUrl);
          console.log(`[useProviderManagement] 已同步更新 llm/index 中的 OllamaProvider URL: ${effectiveUrl}`);
        }
      } catch (e) { console.warn('Update ProviderRegistry baseUrl error', e);} 

      if (providerName === 'Ollama') {
          // 更新模型缓存，但不自动检查 Provider 状态；等待用户手动刷新
          try { await refreshOllamaModels(effectiveUrl); } catch {/* noop */}
      }
      
    } catch (error: any) {
      console.error("Error updating provider URL:", error);
      toast.error("更新 URL 失败", { description: error?.message || "无法保存 URL 更改。" });
      // loadData(true); 
    }
  }, [refreshOllamaModels, handleSingleProviderRefresh, providers, updateProviderStatusAfterUrlChange]); 

  const handleProviderDefaultApiKeyChange = useCallback(async (providerName: string, apiKey: string) => {
    const finalApiKey = apiKey && apiKey.trim() ? apiKey.trim() : null;
    // 不再在失焦后自动刷新，由用户手动点刷新
    const needsRefresh = false;
    // 若值与当前相同，则直接返回，避免无谓刷新/写入
    const current = providers.find(p => p.name === providerName);
    if (current) {
      const currentNormalized = current.default_api_key && String(current.default_api_key).trim() ? String(current.default_api_key).trim() : null;
      if (currentNormalized === finalApiKey) {
        return;
      }
    }
    
    // setProviders(prev => // This line was removed as per the edit hint
    //   prev.map(p => {
    //     if (p.name === providerName) {
    //         let newDisplayStatus = p.displayStatus;
    //         let newTooltip = p.statusTooltip;
    //          if (p.requiresApiKey && !finalApiKey && p.displayStatus !== 'CONNECTING') {
    //              newDisplayStatus = 'NO_KEY';
    //              newTooltip = '未配置 API 密钥';
    //              needsRefresh = p.displayStatus !== 'NO_KEY'; 
    //         } else if (p.displayStatus === 'NO_KEY' && finalApiKey) {
    //              newDisplayStatus = 'UNKNOWN'; 
    //              newTooltip = 'API 密钥已配置，请刷新';
    //              needsRefresh = true;
    //         } else if (p.displayStatus !== 'CONNECTING') { 
    //             newDisplayStatus = 'UNKNOWN';
    //             newTooltip = 'API 密钥已更改，请刷新';
    //             needsRefresh = true;
    //         }
    //         return { ...p, default_api_key: finalApiKey, displayStatus: newDisplayStatus, isConnected: undefined, statusTooltip: newTooltip };
    //     }
    //     return p;
    //  })
    // ); // This line was removed as per the edit hint
    
    try {
      if (finalApiKey !== null) {
        await KeyManager.setProviderKey(providerName, finalApiKey);
      } else {
        await KeyManager.removeProviderKey(providerName);
      }
    // 更新仓库中的 apiKey 字段
    const { providerRepository } = await import('@/lib/provider/ProviderRepository');
    await providerRepository.update({ name: providerName, apiKey: finalApiKey });
      
      // 不自动触发检查
    } catch (error: any) {
      console.error("更新 Provider 默认 API Key 覆盖配置失败:", error);
      toast.error("更新 API 密钥失败", { description: error?.message || "无法保存密钥更改。" });
      // loadData(true);
    }
  }, [handleSingleProviderRefresh, providers]); 

  const handleModelApiKeyChange = useCallback(async (providerName: string, modelName: string, apiKey: string) => {
    const finalApiKey = apiKey || null;
    // setProviders(prev => // This line was removed as per the edit hint
    //   prev.map(p => {
    //     if (p.name === providerName) {
    //       return {
    //         ...p,
    //         models: p.models.map(m => (m.name === modelName ? { ...m, api_key: finalApiKey } : m))
    //       };
    //     }
    //     return p;
    //   })
    // ); // This line was removed as per the edit hint
    try {
      if (finalApiKey !== null) {
        await KeyManager.setModelKey(providerName, modelName, finalApiKey);
      } else {
        await KeyManager.removeModelKey(providerName, modelName);
      }
    } catch (error: any) {
      console.error("更新 Model API Key 覆盖配置失败:", error);
      toast.error("更新模型 API 密钥失败", { description: error?.message || "无法保存密钥更改。" });
      // loadData(true);
    }
  }, []); 

  const handleGlobalRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await storeRefreshAll();
      
      // 全局刷新后，重新加载所有提供商的最新模型数据
      const { modelRepository } = await import('@/lib/provider/ModelRepository');
      const { providerRepository } = await import('@/lib/provider/ProviderRepository');
      
      const allProviders = await providerRepository.getAll();
      
      // 先获取所有模型数据
      const updatedProviders = await Promise.all(
        allProviders.map(async (updatedProvider) => {
          const latestModels = await modelRepository.get(updatedProvider.name);
          return {
            name: updatedProvider.name,
            status: updatedProvider.status,
            models: latestModels?.map(m => ({
              name: m.name,
              label: m.label,
              aliases: m.aliases,
              api_key: (m as any).apiKey
            })) || []
          };
        })
      );
      
      // 然后更新UI状态，按PROVIDER_ORDER排序
      const { PROVIDER_ORDER } = require('@/lib/llm');
      /* const sortedUpdatedProviders = updatedProviders.sort((a, b) => {
        const aIndex = PROVIDER_ORDER.indexOf(a.name);
        const bIndex = PROVIDER_ORDER.indexOf(b.name);
        if (aIndex === -1 && bIndex === -1) return 0;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });*/
      
      // setProviders(prev => prev.map(provider => { // This line was removed as per the edit hint
      //   const updatedProvider = sortedUpdatedProviders.find(p => p.name === provider.name);
      //   if (!updatedProvider) return provider;
          
      //   return {
      //     ...provider,
      //     isConnected: updatedProvider.status === ProviderStatus.CONNECTED,
      //     displayStatus: (() => {
      //       switch (updatedProvider.status) {
      //         case ProviderStatus.CONNECTED: return 'CONNECTED';
      //         case ProviderStatus.NOT_CONNECTED: return 'NOT_CONNECTED';
      //         case ProviderStatus.NO_KEY: return 'NO_KEY';
      //         // CONNECTING 不再作为持久化状态
      //         case ProviderStatus.UNKNOWN:
      //         default: return 'UNKNOWN';
      //       }
      //     })(),
      //     models: updatedProvider.models
      //   };
      // })); // This line was removed as per the edit hint
      
      toast.success("提供商刷新完成");
    } catch (e:any) {
      console.error("Global refresh failed", e);
      toast.error("刷新失败", { description: e?.message || String(e) });
    }
    setIsRefreshing(false);
  }, [storeRefreshAll]);

  // 处理偏好设置更改
  const handlePreferenceChange = useCallback(async (providerName: string, preferences: { useBrowserRequest?: boolean }) => {
    try {
      // 先更新本地 providers 状态，确保 UI 立即反映变化
      // setProviders(prev => prev.map(p => { // This line was removed as per the edit hint
      //   if (p.name === providerName || p.aliases?.includes(providerName)) {
      //     return {
      //       ...p,
      //       preferences: { ...p.preferences, ...preferences }
      //     };
      //   }
      //   return p;
      // })); // This line was removed as per the edit hint

      // 持久化到存储
      const { providerRepository } = await import('@/lib/provider/ProviderRepository');
      const allProviders = await providerRepository.getAll();
      const provider = allProviders.find(p => p.name === providerName || p.displayName === providerName);
      if (provider) {
        await providerRepository.upsert({
          ...provider,
          preferences: { ...provider.preferences, ...preferences }
        });
      }

      // 清理浏览器请求缓存，确保新设置立即生效
      const { invalidateProviderCache } = await import('@/lib/provider/browser-fallback-utils');
      invalidateProviderCache();
      
      toast.success(`已更新 ${providerName} 的高级设置`);
    } catch (error) {
      console.error("Failed to update provider preferences:", error);
      toast.error("设置更新失败");
      
      // 如果保存失败，回滚本地状态
      // 回滚逻辑省略：下次 repoProviders 重新同步即可
    }
  }, []);
  
  return {
    providers,
    isLoading,
    isRefreshing,
    handleServiceUrlChange,
    handleProviderDefaultApiKeyChange,
    handleModelApiKeyChange,
    handleGlobalRefresh,
    handleSingleProviderRefresh,
    handlePreferenceChange
  };
}