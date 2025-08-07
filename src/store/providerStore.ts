/**
 * providerStore
 * -----------------------------------------------
 * 「业务数据源层」
 * 1. 只负责把 ProviderRepository / ModelRepository 中的持久化数据
 *    拉进内存并保持订阅同步。
 * 2. 结构保持 **后端实体** (ProviderEntity & ModelEntity)。
 * 3. 任何“写操作”都必须走 ProviderService → ProviderRepository，
 *    **绝不可**在组件 / Hook 中直接 set() providerStore。
 * 4. 请勿在 UI 直接依赖 providerStore，UI 一律使用 providerMetaStore，
 *    通过 mapToProviderWithStatus 做转换，防止耦合后端字段。
 * -----------------------------------------------
 */

import { create } from 'zustand';
import { ProviderEntity } from '@/lib/provider/types';
import { providerService } from '@/lib/provider/ProviderService';
import { providerRepository } from '@/lib/provider/ProviderRepository';
import { modelRepository } from '@/lib/provider/ModelRepository';

type ProviderWithModels = ProviderEntity & { models?: ReturnType<typeof modelRepository.get> extends Promise<infer R> ? R : any };

interface ProviderState {
  providers: ProviderWithModels[];
  isLoading: boolean;
  /** 初始化并开始监听仓库变化 */
  init: () => Promise<void>;
  /** 刷新指定 provider 状态 */
  refresh: (name: string) => Promise<void>;
  refreshAll: () => Promise<void>;
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
    
    // 只有当完全没有配置时才初始化
    if (existing.length === 0) {
      console.log('[ProviderStore] 检测到空数据库，开始创建初始提供商...');
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
    console.log(`[ProviderStore] 最终获取到 ${list.length} 个提供商`);
    
    const withModels = await Promise.all(list.map(async (p) => {
      const models = await modelRepository.get(p.name) ?? [];
      return { ...p, models } as ProviderWithModels;
    }));

    set({ providers: withModels, isLoading: false });
    console.log('[ProviderStore] 初始化完成');

    // ---- 同步 providerMetaStore ----
    import('@/store/providerMetaStore').then(({ useProviderMetaStore })=>{
      const { mapToProviderWithStatus } = require('@/lib/provider/transform');
      useProviderMetaStore.getState().setList(withModels.map(mapToProviderWithStatus));
    });

    // ------ 同步 ProviderRegistry baseUrl ------
    import('@/lib/llm').then(({ ProviderRegistry }) => {
      list.forEach(p => {
        const strat = ProviderRegistry.get(p.name);
        if (strat && (strat as any).baseUrl !== p.url) {
          (strat as any).baseUrl = p.url;
        }
      });
    }).catch(console.error);

    // 后台刷新所有 provider 状态，延迟执行避免阻塞主界面
    setTimeout(() => {
      providerService.refreshAll().catch(console.error);
    }, 2000); // 延迟2秒执行，让主界面先完全加载

    // 订阅后续变化
    providerRepository.subscribe(async (updated) => {
      const combined = await Promise.all(updated.map(async (p) => ({ ...p, models: await modelRepository.get(p.name) ?? [] })));
      set({ providers: combined });
    });

    // 订阅各 provider 模型变化
    list.forEach((p) => {
      modelRepository.subscribe(p.name, async () => {
        const current = get().providers;
        const newModels = await modelRepository.get(p.name) ?? [];
        set({ providers: current.map((prov) => prov.name === p.name ? { ...prov, models: newModels } : prov) });
      });
    });
  },

  refresh: async (name: string) => {
    await providerService.refreshProviderStatus(name);
  },

  refreshAll: async () => {
    await providerService.refreshAll();
  },
})); 