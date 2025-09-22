/**
 * providerStore
 * -----------------------------------------------
 * 「业务数据源层」
 * 1. 只负责把 ProviderRepository / ModelRepository 中的持久化数据
 *    拉进内存并保持订阅同步。
 * 2. 结构保持 **后端实体** (ProviderEntity & ModelEntity)。
 * 3. 任何"写操作"都必须走 ProviderService → ProviderRepository，
 *    **绝不可**在组件 / Hook 中直接 set() providerStore。
 * 4. 请勿在 UI 直接依赖 providerStore，UI 一律使用 providerMetaStore，
 *    通过 mapToProviderWithStatus 做转换，防止耦合后端字段。
 * -----------------------------------------------
 */

import { create } from 'zustand';
import { ProviderEntity } from '@/lib/provider/types';
import { providerService } from '@/lib/provider/ProviderService';
import { refreshProviderUseCase } from '@/lib/provider/usecases/RefreshProvider';
import { refreshAllProvidersUseCase } from '@/lib/provider/usecases/RefreshAllProviders';
import { updateProviderConfigUseCase } from '@/lib/provider/usecases/UpdateProviderConfig';
import { updateModelKeyUseCase } from '@/lib/provider/usecases/UpdateModelKey';
import { providerRepository } from '@/lib/provider/ProviderRepository';
import { modelRepository } from '@/lib/provider/ModelRepository';
// 静态导入，避免 HMR 期间的动态导入警告与重复实例化
import { useProviderMetaStore } from '@/store/providerMetaStore';
import { mapToProviderWithStatus } from '@/lib/provider/transform';
import { ProviderRegistry } from '@/lib/llm';

// 维护对各 Provider 模型仓库的订阅，确保“新增 Provider”也能及时同步模型变更
const __modelSubscriptions = new Map<string, () => void>();
function __ensureModelSubscription(name: string, set: (s: Partial<ProviderState>) => void, get: () => ProviderState) {
  if (__modelSubscriptions.has(name)) return;
  const unsubscribe = modelRepository.subscribe(name, () => {
    (async () => {
      const current = get().providers;
      const newModels = await modelRepository.get(name) ?? [];
      const next = current.map((prov) => prov.name === name ? { ...prov, models: newModels } : prov);
      set({ providers: next });
      try { useProviderMetaStore.getState().setList(next.map(mapToProviderWithStatus) as any); } catch (e) { console.error(e); }
    })().catch((e)=>console.error(e));
  });
  __modelSubscriptions.set(name, unsubscribe);
}

type ProviderWithModels = ProviderEntity & { models?: ReturnType<typeof modelRepository.get> extends Promise<infer R> ? R : any };

interface ProviderState {
  providers: ProviderWithModels[];
  isLoading: boolean;
  /** 初始化并开始监听仓库变化 */
  init: () => Promise<void>;
  /** 刷新指定 provider 状态 */
  refresh: (name: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  updateConfig: (name: string, input: { url?: string; apiKey?: string | null }) => Promise<void>;
  updateModelKey: (providerName: string, modelName: string, apiKey: string | null) => Promise<void>;
}

export const useProviderStore = create<ProviderState>((set, get) => ({
  providers: [],
  isLoading: true,

  init: async () => {
    if (!get().isLoading && get().providers.length > 0) return; // 已初始化

    console.log('[ProviderStore] 开始初始化...');

    // 若仓库尚无数据则创建
    const existing = await providerRepository.getAll();
    console.log(`[ProviderStore] 检查现有数据: ${existing.length} 个提供商`);
    
    // 检查是否缺少必需的providers
    const { PROVIDER_ORDER } = await import('@/lib/llm');
    const missingProviders = PROVIDER_ORDER.filter(name => !existing.some(p => p.name === name));
    
    if (existing.length === 0 || missingProviders.length > 0) {
      console.log(`[ProviderStore] 检测到数据不完整，缺少: ${missingProviders.join(', ')}，开始创建初始提供商...`);
      await providerService.saveInitialProviders();
    } else {
      console.log('[ProviderStore] 使用现有提供商数据，跳过初始化');
      
      // 检查是否有有效的配置（不是默认的localhost）
      const hasValidConfig = existing.some(p => {
        if (p.name === 'Ollama') {
          return p.url && p.url !== 'http://localhost:11434';
        }
        return p.url && p.url.trim() !== '';
      });
      
      if (!hasValidConfig) {
        console.log('[ProviderStore] 检测到无效配置，重新初始化...');
        await providerService.saveInitialProviders();
      }
    }
    
    const list = await providerRepository.getAll();
    console.log(`[ProviderStore] 最终获取到 ${list.length} 个提供商:`, list.map(p => p.name));
    
    // 读取用户自定义排序，若存在则优先生效，否则按 PROVIDER_ORDER
    const userOrder = await providerRepository.getUserOrder();
    const sortedList = list.sort((a, b) => {
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
    
    const withModels = await Promise.all(sortedList.map(async (p) => {
      const models = await modelRepository.get(p.name) ?? [];
      return { ...p, models } as ProviderWithModels;
    }));

    set({ providers: withModels, isLoading: false });
    console.log('[ProviderStore] 初始化完成');

    // ---- 同步 providerMetaStore ----
    useProviderMetaStore.getState().setList(withModels.map(mapToProviderWithStatus) as any);

    // ------ 同步 ProviderRegistry baseUrl ------
    try {
      list.forEach(p => {
        const strat = ProviderRegistry.get(p.name);
        if (strat && (strat as any).baseUrl !== p.url) {
          (strat as any).baseUrl = p.url;
          console.log(`[ProviderStore] 已同步 ${p.name} 的 baseUrl: ${p.url}`);
        }
      });
    } catch (e) { console.error(e); }

    // 取消自动后台刷新：仅在用户主动点击“检查状态”时再触发

    // 订阅后续变化
    providerRepository.subscribe((updated) => {
      (async () => {
        const combined = await Promise.all(updated.map(async (p) => ({ ...p, models: await modelRepository.get(p.name) ?? [] })));
      
      // 使用用户排序优先
      const userOrder = await providerRepository.getUserOrder();
      const sortedCombined = combined.sort((a, b) => {
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
      
        set({ providers: sortedCombined });

        // 同步 providerMetaStore
        try { useProviderMetaStore.getState().setList(sortedCombined.map(mapToProviderWithStatus) as any); } catch (e) { console.error(e); }
        // 确保新 Provider 也建立模型订阅
        sortedCombined.forEach((p) => { __ensureModelSubscription(p.name, set, get); });
      })().catch((e)=>console.error(e));
    });

    // 订阅各 provider 模型变化（含首次）
    list.forEach((p) => { __ensureModelSubscription(p.name, set, get); });
  },

  refresh: async (name: string) => {
    await refreshProviderUseCase.execute(name, { withModels: true });
  },

  refreshAll: async () => {
    await refreshAllProvidersUseCase.execute();
  },
  
  updateConfig: async (name: string, input: { url?: string; apiKey?: string | null }) => {
    await updateProviderConfigUseCase.execute(name, input);
  },
  updateModelKey: async (providerName: string, modelName: string, apiKey: string | null) => {
    await updateModelKeyUseCase.execute(providerName, modelName, apiKey);
  },
})); 