import { useState, useEffect, useCallback, useRef } from 'react';
import { isDevelopmentEnvironment } from '@/lib/utils/environment';
import { toast } from "@/components/ui/sonner";
import type { ProviderMetadata, ModelMetadata } from '@/lib/metadata/types';
import { useProviderStatusStore } from '@/store/providerStatusStore';
import { ProviderRegistry } from '@/lib/llm';
import { useOllamaStore } from '@/store/ollamaStore';
import React from 'react';
import { KeyManager } from '@/lib/llm/KeyManager';
import { providerService } from '@/lib/provider/ProviderService';
import { ProviderStatus } from '@/lib/provider/types';
// import removed: specializedStorage no longer used
import { modelRepository } from '@/lib/provider/ModelRepository';
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
  const { statuses: storedStatuses, setStatus: setStoredStatus } = useProviderStatusStore();
  const { models: ollamaModels, refreshModels: refreshOllamaModels, hasOnlineFetched } = useOllamaStore();
  const globalQuickList = useProviderMetaStore(s=>s.list);
  const setGlobalQuickList = useProviderMetaStore(s=>s.setList);
  const [providers, setProviders] = useState<ProviderWithStatus[]>(globalQuickList as any);
  const [isLoading, setIsLoading] = useState(true); // Keep track of initial loading
  const [isRefreshing, setIsRefreshing] = useState(false); // For global refresh
  const [connectingProviderName, setConnectingProviderName] = useState<string | null>(null); // For single refresh spinner
  // 初始检查已由 runInitialChecks 完成，无需额外标记


  const {
    providers: repoProviders,
    isLoading: repoLoading,
    init: initProviders,
    refreshAll: storeRefreshAll,
    refresh: storeRefresh,
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

      // 使用用户自定义排序优先
      const { providerRepository } = require('@/lib/provider/ProviderRepository');
      let userOrder: string[] = [];
      try { userOrder = await providerRepository.getUserOrder(); } catch {}
      const { PROVIDER_ORDER } = require('@/lib/llm');
      const sortedConverted = converted.sort((a, b) => {
        const ua = userOrder.indexOf(a.name);
        const ub = userOrder.indexOf(b.name);
        if (ua !== -1 || ub !== -1) return (ua === -1 ? Number.MAX_SAFE_INTEGER : ua) - (ub === -1 ? Number.MAX_SAFE_INTEGER : ub);
        const aIndex = PROVIDER_ORDER.indexOf(a.name);
        const bIndex = PROVIDER_ORDER.indexOf(b.name);
        if (aIndex === -1 && bIndex === -1) return 0;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });

      // 仅当内容确实发生变化时才更新，避免父级频繁重建导致滚动跳动
      const next = sortedConverted as any;
      const prev = providers;
      const sameLength = prev.length === next.length;
      const sameOrder = sameLength && prev.every((p, i) => p.name === next[i].name);
      const sameBasic = sameOrder && prev.every((p, i) => p.api_base_url === next[i].api_base_url && p.default_api_key === next[i].default_api_key && p.displayStatus === next[i].displayStatus);
      if (!sameBasic) {
        setProviders(next);
      }
      setIsLoading(repoLoading);
      // 后台预加载 Provider & 模型图标，提升后续界面切换的首屏渲染速度
      try { preloadProviderAndModelLogos(sortedConverted as any).catch(()=>{}); } catch {}
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
      } catch {}
    })();
  }, []);

  // ---- 将 providers 同步到全局 store (providerMetaStore) ----
  useEffect(() => {
    setGlobalQuickList(providers as any);
  }, [providers, setGlobalQuickList]);

  // 保证隐藏项不进入 UI 列表（防御，若上游漏过滤）
  useEffect(() => {
    setProviders(prev => prev.filter((p:any)=> p.isVisible !== false));
  }, []);

  // --- 数据加载 (loadData) ---
  // loadData 函数已废弃

  // --- 刷新单个 Provider（由 checkController 统一调度） ---
  const handleSingleProviderRefresh = useCallback(async (provider: ProviderWithStatus, showToast: boolean = true) => {
    const repoName = provider.aliases?.[0] || provider.name;
    if (cancelledRef.current) return;
    setConnectingProviderName(provider.name);
    setConnecting(provider.name, true);
    setProviders(prev => prev.map(p => p.name === provider.name ? { ...p, displayStatus: 'CONNECTING', statusTooltip: '正在检查连接状态...' } : p));

    const { checkController } = await import('@/lib/provider/check-controller');

    await new Promise<void>((resolve) => {
      const offStart = checkController.on('start', (p)=>{
        if (p.name !== repoName) return;
        setConnecting(provider.name, true);
      });
      const offSuccess = checkController.on('success', (p)=>{
        if (p.name !== repoName) return;
        setConnecting(provider.name, false);
        setConnectingProviderName(null);
        setProviders(prev => prev.map(x => x.name === provider.name ? { ...x, isConnected: p.status === 'CONNECTED', displayStatus: p.status, statusTooltip: p.message ?? (p.status==='CONNECTED'?'连接正常':null) } : x));
        if (showToast) {
          if (p.status === 'CONNECTED') toast.success(`${provider.name} 已连接`);
          else if (p.status === 'NOT_CONNECTED') toast.error(`${provider.name} 状态检查失败`, { description: p.message || '请检查服务地址和网络连接' });
          else if (p.status === 'NO_KEY') toast.error(`${provider.name} 未配置API密钥`, { description: '请在设置中配置API密钥' });
        }
        offStart(); offSuccess(); offFail(); offTimeout();
        resolve();
      });
      const offFail = checkController.on('fail', (p)=>{
        if (p.name !== repoName) return;
        setConnecting(provider.name, false);
        setConnectingProviderName(null);
        setProviders(prev => prev.map(x => x.name === provider.name ? { ...x, displayStatus: 'NOT_CONNECTED', statusTooltip: p.message || '检查失败' } : x));
        if (showToast) toast.error(`刷新 ${provider.name} 失败`, { description: p.message || '请检查网络连接' });
        offStart(); offSuccess(); offFail(); offTimeout();
        resolve();
      });
      const offTimeout = checkController.on('timeout', (p)=>{
        if (p.name !== repoName) return;
        setConnecting(provider.name, false);
        setConnectingProviderName(null);
        setProviders(prev => prev.map(x => x.name === provider.name ? { ...x, displayStatus: 'NOT_CONNECTED', statusTooltip: '连接超时，请稍后重试' } : x));
        if (showToast) toast.error(`${provider.name} 连接超时`, { description: '请稍后重试或检查网络' });
        offStart(); offSuccess(); offFail(); offTimeout();
        resolve();
      });

      checkController.requestCheck(repoName, { reason: 'manual', debounceMs: 0, withModels: true });
    });
  }, [setConnecting]);

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
    setProviders(currentProviders => {
        const ollamaProvider = currentProviders.find(p => p.name === 'Ollama');
        if (!ollamaProvider) return currentProviders; // Ollama provider might not exist yet

        const currentOllamaModelNames = ollamaProvider.models.map(m => m.name) || [];
        if (currentOllamaModelNames.length === ollamaModels.length &&
            currentOllamaModelNames.every(name => ollamaModels.includes(name))) {
            console.log("[useProviderManagement] Effect 3: Internal Ollama models already match store. Skipping update.");
            return currentProviders;
        }

        console.log(`[useProviderManagement] Effect 3: Updating Ollama provider models in internal state.`);
        return currentProviders.map(provider => {
            if (provider.name === 'Ollama') {
                const updatedModels = ollamaModels.map((modelName: string): ModelMetadata => {
                    const existingModelData = provider.models.find((m: ModelMetadata) => m.name === modelName);
                    return {
                        name: modelName,
                        aliases: existingModelData?.aliases || [modelName],
                        api_key: existingModelData?.api_key
                    };
                });
                return { ...provider, models: updatedModels };
            }
            return provider;
        });
    });
    console.log("[useProviderManagement] Effect 3: Ollama models sync END");
  }, [ollamaModels, hasOnlineFetched]);

  // --- 其他处理函数 ---
  
  // 处理URL保存后的状态更新
  const updateProviderStatusAfterUrlChange = useCallback((providerName: string, newUrl: string) => {
    setProviders(prev =>
      prev.map(p =>
        p.name === providerName ? { 
          ...p, 
          api_base_url: newUrl, 
          displayStatus: 'UNKNOWN', 
          isConnected: undefined, 
          statusTooltip: 'URL已更改，请刷新' 
        } : p
      )
    );
  }, []);

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

      toast.success("服务地址已保存", { description: "系统将自动更新连接状态。" });

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
          console.log(`[useProviderManagement] Ollama URL changed, triggering model list refresh using new URL: ${effectiveUrl}`);
          try {
              await refreshOllamaModels(effectiveUrl); 
              console.log(`[useProviderManagement] Ollama model list refresh triggered after URL change.`);
              const updatedProvider = providers.find(p => p.name === providerName); 
               if (updatedProvider && updatedProvider.displayStatus !== 'CONNECTING') {
                   setTimeout(async () => {
                     try {
                       const { checkController } = await import('@/lib/provider/check-controller');
                       checkController.requestCheck(providerName, { reason: 'url_saved', debounceMs: 300 });
                     } catch {}
                   }, 500);
               }
          } catch (ollamaError) {
              console.error("[useProviderManagement] Failed to trigger Ollama model refresh after URL change:", ollamaError);
          }
      } else {
           const updatedProvider = providers.find(p => p.name === providerName);
           if (updatedProvider && updatedProvider.displayStatus !== 'CONNECTING') {
                setTimeout(async () => {
                  try {
                    const { checkController } = await import('@/lib/provider/check-controller');
                    checkController.requestCheck(providerName, { reason: 'url_saved', debounceMs: 300 });
                  } catch {}
                }, 500);
           }
      }
      
    } catch (error: any) {
      console.error("Error updating provider URL:", error);
      toast.error("更新 URL 失败", { description: error?.message || "无法保存 URL 更改。" });
      // loadData(true); 
    }
  }, [refreshOllamaModels, handleSingleProviderRefresh, providers, updateProviderStatusAfterUrlChange]); 

  const handleProviderDefaultApiKeyChange = useCallback(async (providerName: string, apiKey: string) => {
    const finalApiKey = apiKey && apiKey.trim() ? apiKey.trim() : null;
    let needsRefresh = false;
    // 若值与当前相同，则直接返回，避免无谓刷新/写入
    const current = providers.find(p => p.name === providerName);
    if (current) {
      const currentNormalized = current.default_api_key && String(current.default_api_key).trim() ? String(current.default_api_key).trim() : null;
      if (currentNormalized === finalApiKey) {
        return;
      }
    }
    
    setProviders(prev =>
      prev.map(p => {
        if (p.name === providerName) {
            let newDisplayStatus = p.displayStatus;
            let newTooltip = p.statusTooltip;
             if (p.requiresApiKey && !finalApiKey && p.displayStatus !== 'CONNECTING') {
                 newDisplayStatus = 'NO_KEY';
                 newTooltip = '未配置 API 密钥';
                 needsRefresh = p.displayStatus !== 'NO_KEY'; 
            } else if (p.displayStatus === 'NO_KEY' && finalApiKey) {
                 newDisplayStatus = 'UNKNOWN'; 
                 newTooltip = 'API 密钥已配置，请刷新';
                 needsRefresh = true;
            } else if (p.displayStatus !== 'CONNECTING') { 
                newDisplayStatus = 'UNKNOWN';
                newTooltip = 'API 密钥已更改，请刷新';
                needsRefresh = true;
            }
            return { ...p, default_api_key: finalApiKey, displayStatus: newDisplayStatus, isConnected: undefined, statusTooltip: newTooltip };
        }
        return p;
     })
    );
    
    try {
      if (finalApiKey !== null) {
        await KeyManager.setProviderKey(providerName, finalApiKey);
      } else {
        await KeyManager.removeProviderKey(providerName);
      }
    // 更新仓库中的 apiKey 字段
    const { providerRepository } = await import('@/lib/provider/ProviderRepository');
    await providerRepository.update({ name: providerName, apiKey: finalApiKey });
      
      if(needsRefresh) {
          const updatedProvider = providers.find(p => p.name === providerName);
          if (updatedProvider) {
               setTimeout(async () => {
                 try {
                   const { checkController } = await import('@/lib/provider/check-controller');
                   checkController.requestCheck(providerName, { reason: 'manual', debounceMs: 0 });
                 } catch {}
               }, 100);
          }
      }
    } catch (error: any) {
      console.error("更新 Provider 默认 API Key 覆盖配置失败:", error);
      toast.error("更新 API 密钥失败", { description: error?.message || "无法保存密钥更改。" });
      // loadData(true);
    }
  }, [handleSingleProviderRefresh, providers]); 

  const handleModelApiKeyChange = useCallback(async (providerName: string, modelName: string, apiKey: string) => {
    const finalApiKey = apiKey || null;
    setProviders(prev =>
      prev.map(p => {
        if (p.name === providerName) {
          return {
            ...p,
            models: p.models.map(m => (m.name === modelName ? { ...m, api_key: finalApiKey } : m))
          };
        }
        return p;
      })
    );
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

  const handleUrlBlur = useCallback(async (providerName: string) => {
    console.log(`URL input blurred for provider ${providerName}`);
    
    // 延迟执行刷新操作，等待URL保存完成
    setTimeout(async () => {
      const provider = providers.find(p => p.name === providerName); 
      // 增加去重：如果已经在检查中，跳过
      if (!provider || provider.displayStatus === 'CONNECTING') {
        console.log(`[handleUrlBlur] 跳过刷新 ${providerName}，已在检查中或不存在`);
        return; 
      }
      
      console.log(`[handleUrlBlur] 延迟刷新 ${providerName}，当前URL: ${provider.api_base_url}`);
      await handleSingleProviderRefresh(provider, false); 
    }, 300); // 延长到300ms，给URL保存更多时间
  }, [handleSingleProviderRefresh, providers]); 

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
      const sortedUpdatedProviders = updatedProviders.sort((a, b) => {
        const aIndex = PROVIDER_ORDER.indexOf(a.name);
        const bIndex = PROVIDER_ORDER.indexOf(b.name);
        if (aIndex === -1 && bIndex === -1) return 0;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
      
      setProviders(prev => prev.map(provider => {
        const updatedProvider = sortedUpdatedProviders.find(p => p.name === provider.name);
        if (!updatedProvider) return provider;
        
        return {
          ...provider,
          isConnected: updatedProvider.status === ProviderStatus.CONNECTED,
          displayStatus: (() => {
            switch (updatedProvider.status) {
              case ProviderStatus.CONNECTED: return 'CONNECTED';
              case ProviderStatus.NOT_CONNECTED: return 'NOT_CONNECTED';
              case ProviderStatus.NO_KEY: return 'NO_KEY';
              // CONNECTING 不再作为持久化状态
              case ProviderStatus.UNKNOWN:
              default: return 'UNKNOWN';
            }
          })(),
          models: updatedProvider.models
        };
      }));
      
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
      // 更新本地state
      setProviders(prev => prev.map(p => 
        p.name === providerName 
          ? { ...p, preferences: { ...p.preferences, ...preferences } }
          : p
      ));

      // 持久化到存储
      const { providerRepository } = await import('@/lib/provider/ProviderRepository');
      const allProviders = await providerRepository.getAll();
      const provider = allProviders.find(p => p.name === providerName);
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
    }
  }, []);
  
  return {
    providers,
    isLoading,
    isRefreshing,
    connectingProviderName,
    handleServiceUrlChange,
    handleProviderDefaultApiKeyChange,
    handleModelApiKeyChange,
    handleUrlBlur,
    handleGlobalRefresh,
    handleSingleProviderRefresh,
    handlePreferenceChange
  };
}