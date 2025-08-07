import { create } from 'zustand';
import { fetchOllamaModels } from '@/lib/ai-providers';
import { specializedStorage } from '@/lib/storage';

interface OllamaState {
    models: string[];
    setModels: (models: string[]) => void;
    clearModels: () => void;
    refreshModels: (url: string) => Promise<void>;
    isLoading: boolean;
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
            const latestModels = await fetchOllamaModels(url);
            if (Array.isArray(latestModels)) {
                set({ models: latestModels });
                // 保存到持久化存储
                await saveModels(latestModels);
            }
        } catch (error) {
            console.error('Failed to refresh Ollama models:', error);
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