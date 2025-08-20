import { create } from 'zustand';
import { specializedStorage } from '@/lib/storage';
import { providerModelService } from '@/lib/provider/services/ProviderModelService';
import { modelRepository } from '@/lib/provider/ModelRepository';
import { ProviderRegistry } from '@/lib/llm';

/**
 * 仅用于设置页联动的极简映射 store：
 * - 真正的数据源是 provider 模型仓库（ModelRepository）；
 * - 本 store 只是把仓库中的结果转成字符串数组给 UI 使用，
 *   并提供 refreshModels 触发服务层拉取；
 */
interface OllamaState {
    models: string[];
    setModels: (models: string[]) => void;
    clearModels: () => void;
    refreshModels: (url: string) => Promise<void>;
    isLoading: boolean;
    /** 是否至少进行过一次在线拉取（无论成功与否、结果是否为空） */
    hasOnlineFetched: boolean;
}

// 初始化并加载之前保存的模型列表
const loadSavedModels = async (): Promise<string[]> => {
    try {
        const savedModels = await specializedStorage.models.getOllamaModels();
        return savedModels || [];
    } catch (error) {
        console.error('Failed to load saved Ollama models:', error);
        return [];
    }
};

// 保存模型列表到持久化存储
const saveModels = async (models: string[]): Promise<void> => {
    try {
        await specializedStorage.models.setOllamaModels(models);
        console.log(`已将${models.length}个Ollama模型保存到持久化存储`);
    } catch (error) {
        console.error('Failed to save Ollama models:', error);
    }
};

// 创建zustand store
export const useOllamaStore = create<OllamaState>((set, get) => ({
    models: [], // 初始为空，稍后异步加载
    isLoading: false,
    hasOnlineFetched: false,
    
    setModels: (models) => {
        set({ models });
        // 当模型被设置时，同时保存到持久化存储
        saveModels(models);
    },
    
    clearModels: () => {
        set({ models: [] });
        // 清空持久化存储
        saveModels([]);
    },
    
    refreshModels: async (url: string) => {
        set({ isLoading: true });
        try {
            // 临时同步 ProviderRegistry 中 Ollama 的 baseUrl，确保本次拉取命中新地址
            try {
              const inst: any = ProviderRegistry.get('Ollama');
              const effectiveUrl = (url && url.trim()) ? url.trim() : inst?.baseUrl;
              if (inst && effectiveUrl && inst.baseUrl !== effectiveUrl) inst.baseUrl = effectiveUrl;
            } catch {}

            await providerModelService.fetchIfNeeded('Ollama');
            const list = await modelRepository.get('Ollama');
            const names = (list || []).map(m => m.name);
            set({ models: names, hasOnlineFetched: true });
            await saveModels(names);
        } catch (error) {
            console.error('Failed to refresh Ollama models:', error);
            set({ hasOnlineFetched: true });
        } finally {
            set({ isLoading: false });
        }
    },
}));

// 启动时立即加载保存的模型
if (typeof window !== 'undefined') { // 确保只在客户端执行
    (async () => {
        try {
            const savedModels = await loadSavedModels();
            if (savedModels.length > 0) {
                console.log(`从持久化存储加载了${savedModels.length}个Ollama模型`);
                useOllamaStore.getState().setModels(savedModels);
            }
        } catch (error) {
            console.error('Failed to initialize Ollama models from storage:', error);
        }
    })();
} 