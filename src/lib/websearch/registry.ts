import type { SearchProvider } from '@/store/webSearchStore';

type ProviderMeta = {
  id: SearchProvider;
  label: string;
};

const PROVIDERS: ProviderMeta[] = [
  { id: 'google', label: 'Google' },
  { id: 'bing', label: 'Bing' },
  { id: 'ollama', label: 'Ollama' },
  { id: 'duckduckgo', label: 'DuckDuckGo' },
  { id: 'custom_scrape', label: 'Custom Scraper' },
];

export function listAllProviders(): SearchProvider[] {
  return PROVIDERS.map(p => p.id);
}

export function providerLabel(id: SearchProvider): string {
  const m = PROVIDERS.find(p => p.id === id);
  return m ? m.label : id;
}

export function providerOptions(): Array<{ value: SearchProvider; label: string }> {
  return PROVIDERS.map(p => ({ value: p.id, label: p.label }));
}

export type ProviderConfigKeys = {
  apiKeyGoogle?: string;
  cseIdGoogle?: string;
  apiKeyBing?: string;
  apiKeyOllama?: string;
};

export function providerConfiguredMap(keys: ProviderConfigKeys): Record<SearchProvider, boolean> {
  return {
    google: !!(keys.apiKeyGoogle && keys.cseIdGoogle),
    bing: !!keys.apiKeyBing,
    ollama: !!keys.apiKeyOllama,
    duckduckgo: true,
    custom_scrape: true,
  };
}

export function isProviderConfigured(id: SearchProvider, keys: ProviderConfigKeys): boolean {
  const map = providerConfiguredMap(keys);
  return !!map[id];
}

// ====== Orchestrator helpers to avoid magic values ======
export type WebSearchCredentials = { apiKey?: string; cseId?: string };

export function getProviderCredentials(id: SearchProvider, keys: ProviderConfigKeys): WebSearchCredentials {
  switch (id) {
    case 'google':
      return { apiKey: keys.apiKeyGoogle, cseId: keys.cseIdGoogle };
    case 'bing':
      return { apiKey: keys.apiKeyBing };
    case 'ollama':
      return { apiKey: keys.apiKeyOllama };
    case 'duckduckgo':
    case 'custom_scrape':
    default:
      return {};
  }
}

export function isMissingRequiredCredentials(id: SearchProvider, keys: ProviderConfigKeys): boolean {
  const cred = getProviderCredentials(id, keys);
  if (id === 'google') return !(cred.apiKey && cred.cseId);
  if (id === 'bing') return !cred.apiKey;
  if (id === 'ollama') return !cred.apiKey;
  return false; // duckduckgo/custom_scrape 不需要
}


