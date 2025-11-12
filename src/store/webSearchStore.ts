import { create } from 'zustand';
import StorageUtil from '@/lib/storage';

export type SearchProvider = 'google' | 'bing' | 'custom_scrape' | 'ollama';

type ConversationProviderMap = Record<string, SearchProvider | undefined>;

interface WebSearchConfig {
  isWebSearchEnabled: boolean;
  provider: SearchProvider;
  apiKeyGoogle: string;
  cseIdGoogle: string;
  apiKeyBing: string;
  apiKeyOllama: string;
  conversationProviders: ConversationProviderMap;
}

interface WebSearchState extends WebSearchConfig {
  initialized: boolean;
  toggleWebSearch: (enabled: boolean) => void;
  setSearchProvider: (provider: SearchProvider) => void;
  setGoogleCredentials: (apiKey: string, cseId: string) => void;
  setBingCredentials: (apiKey: string) => void;
  setOllamaApiKey: (apiKey: string) => void;
  setConversationProvider: (conversationId: string, provider: SearchProvider | undefined) => void;
  getConversationProvider: (conversationId: string) => SearchProvider;
  getAvailableProviders: () => SearchProvider[];
  _save: () => Promise<void>;
  _load: () => Promise<void>;
}

const STORE_FILE = 'web-search-settings.json';
const STORE_KEY = 'web_search_config';

const defaultConfig: WebSearchConfig = {
  isWebSearchEnabled: false,
  provider: 'google',
  apiKeyGoogle: '',
  cseIdGoogle: '',
  apiKeyBing: '',
  apiKeyOllama: '',
  conversationProviders: {}
};

export const useWebSearchStore = create<WebSearchState>((set, get) => ({
  ...defaultConfig,
  initialized: false,

  toggleWebSearch: (enabled) => {
    set({ isWebSearchEnabled: enabled });
    void get()._save();
  },

  setSearchProvider: (provider) => {
    set({ provider });
    void get()._save();
  },

  setGoogleCredentials: (apiKey, cseId) => {
    set({ apiKeyGoogle: apiKey, cseIdGoogle: cseId });
    void get()._save();
  },

  setBingCredentials: (apiKey) => {
    set({ apiKeyBing: apiKey });
    void get()._save();
  },

  setOllamaApiKey: (apiKey) => {
    set({ apiKeyOllama: apiKey });
    void get()._save();
  },

  setConversationProvider: (conversationId, provider) => {
    const map = { ...(get().conversationProviders || {}) };
    if (!provider) {
      delete map[conversationId];
    } else {
      map[conversationId] = provider;
    }
    set({ conversationProviders: map });
    void get()._save();
  },

  getConversationProvider: (conversationId) => {
    const map = get().conversationProviders || {};
    return map[conversationId] || get().provider;
  },

  getAvailableProviders: () => {
    const s = get();
    const available: SearchProvider[] = [];
    if (s.apiKeyGoogle && s.cseIdGoogle) available.push('google');
    if (s.apiKeyBing) available.push('bing');
    if (s.apiKeyOllama) available.push('ollama');
    // 自定义抓取器总是可用
    available.push('custom_scrape');
    return available;
  },

  _save: async () => {
    const { initialized, _save: _a, _load: _b, getAvailableProviders: _c, getConversationProvider: _d, ...cfg } = get();
    await StorageUtil.setItem<WebSearchConfig>(STORE_KEY, cfg as WebSearchConfig, STORE_FILE);
  },

  _load: async () => {
    const saved = await StorageUtil.getItem<WebSearchConfig>(STORE_KEY, null, STORE_FILE);
    if (saved && typeof saved === 'object') {
      set({ ...(defaultConfig), ...(saved || {}), initialized: true });
    } else {
      set({ initialized: true });
    }
  },
}));

// 应用启动时加载配置
(async () => {
  try {
    await useWebSearchStore.getState()._load();
  } catch (error) {
    console.error('Failed to load web search settings:', error);
  }
})();


