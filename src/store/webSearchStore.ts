import { create } from 'zustand';
import StorageUtil from '@/lib/storage';

export type SearchProvider = 'google' | 'bing' | 'custom_scrape' | 'ollama' | 'duckduckgo';

type ConversationProviderMap = Record<string, SearchProvider | undefined>;

interface WebSearchConfig {
  isWebSearchEnabled: boolean;
  autoAuthorizeWebSearch: boolean;
  provider: SearchProvider;
  apiKeyGoogle: string;
  cseIdGoogle: string;
  apiKeyBing: string;
  apiKeyOllama: string;
  // —— 高级参数（按提供商/通用） ——
  // DuckDuckGo / Custom Scraper（HTML）
  ddgLimit: number;               // 默认 5
  ddgKl: string;                  // 例如 "us-en"（地区/语言）
  ddgAcceptLanguage: string;      // 请求头 Accept-Language
  ddgSafe: boolean;               // 安全搜索（true=开启，false=关闭）
  ddgSite: string;                // site 限定（可为空）
  // Ollama
  ollamaMaxResults: number;       // 默认 5（不改则不传）
  // 通用 fetch 降级选项
  fetchMaxContentChars: number;   // 默认 2000
  fetchMaxLinks: number;          // 默认 50
  fetchUseReadability: boolean;   // 默认 true，启用“可读性”正文提取
  conversationProviders: ConversationProviderMap;
}

interface WebSearchState extends WebSearchConfig {
  initialized: boolean;
  toggleWebSearch: (enabled: boolean) => void;
  setAutoAuthorizeWebSearch: (enabled: boolean) => void;
  setSearchProvider: (provider: SearchProvider) => void;
  setGoogleCredentials: (apiKey: string, cseId: string) => void;
  setBingCredentials: (apiKey: string) => void;
  setOllamaApiKey: (apiKey: string) => void;
  setDdgAdvanced: (opts: Partial<Pick<WebSearchConfig, 'ddgLimit'|'ddgKl'|'ddgAcceptLanguage'|'ddgSafe'|'ddgSite'>>) => void;
  setOllamaAdvanced: (opts: Partial<Pick<WebSearchConfig, 'ollamaMaxResults'>>) => void;
  setFetchAdvanced: (opts: Partial<Pick<WebSearchConfig, 'fetchMaxContentChars'|'fetchMaxLinks'>>) => void;
  setFetchReadability: (enabled: boolean) => void;
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
  autoAuthorizeWebSearch: true, // 默认对 web_search 启用自动授权（可在设置里关闭）
  // 默认搜索提供商：优先使用 DuckDuckGo（免费且无需密钥）
  // 已有用户的选择会通过持久化配置覆盖此默认值
  provider: 'duckduckgo',
  apiKeyGoogle: '',
  cseIdGoogle: '',
  apiKeyBing: '',
  apiKeyOllama: '',
  // 高级参数默认
  ddgLimit: 5,
  ddgKl: '',
  ddgAcceptLanguage: '',
  ddgSafe: false,
  ddgSite: '',
  ollamaMaxResults: 5,
  fetchMaxContentChars: 2000,
  fetchMaxLinks: 50,
  fetchUseReadability: true,
  conversationProviders: {}
};

export const useWebSearchStore = create<WebSearchState>((set, get) => ({
  ...defaultConfig,
  initialized: false,

  toggleWebSearch: (enabled) => {
    set({ isWebSearchEnabled: enabled });
    void get()._save();
  },

  setAutoAuthorizeWebSearch: (enabled) => {
    set({ autoAuthorizeWebSearch: enabled });
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

  setDdgAdvanced: (opts) => {
    set({
      ddgLimit: typeof opts.ddgLimit === 'number' ? opts.ddgLimit : get().ddgLimit,
      ddgKl: typeof opts.ddgKl === 'string' ? opts.ddgKl : get().ddgKl,
      ddgAcceptLanguage: typeof opts.ddgAcceptLanguage === 'string' ? opts.ddgAcceptLanguage : get().ddgAcceptLanguage,
      ddgSafe: typeof opts.ddgSafe === 'boolean' ? opts.ddgSafe : get().ddgSafe,
      ddgSite: typeof opts.ddgSite === 'string' ? opts.ddgSite : get().ddgSite,
    });
    void get()._save();
  },

  setOllamaAdvanced: (opts) => {
    set({
      ollamaMaxResults: typeof opts.ollamaMaxResults === 'number' ? opts.ollamaMaxResults : get().ollamaMaxResults,
    });
    void get()._save();
  },

  setFetchAdvanced: (opts) => {
    set({
      fetchMaxContentChars: typeof opts.fetchMaxContentChars === 'number' ? opts.fetchMaxContentChars : get().fetchMaxContentChars,
      fetchMaxLinks: typeof opts.fetchMaxLinks === 'number' ? opts.fetchMaxLinks : get().fetchMaxLinks,
    });
    void get()._save();
  },

  setFetchReadability: (enabled) => {
    set({ fetchUseReadability: !!enabled });
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
    // DuckDuckGo 与 自定义抓取器总是可用
    available.push('duckduckgo');
    available.push('custom_scrape');
    return available;
  },

  _save: async () => {
    const { initialized: _initialized, _save: _a, _load: _b, getAvailableProviders: _c, getConversationProvider: _d, ...cfg } = get();
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
void (async () => {
	try {
		await useWebSearchStore.getState()._load();
	} catch (error) {
		console.error('Failed to load web search settings:', error);
	}
})(); 


