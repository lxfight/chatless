import { create } from 'zustand';
import StorageUtil from '@/lib/storage';

const PROXY_URL_KEY = 'network_proxy_url';
const USE_SYSTEM_PROXY_KEY = 'network_use_system_proxy';

interface NetworkPreferencesState {
  proxyUrl: string;
  useSystemProxy: boolean;
  offline: boolean;
  initialized: boolean;
  setProxyUrl: (url: string) => void;
  setUseSystemProxy: (use: boolean) => void;
  setOffline: (flag: boolean) => void;
}

const OFFLINE_KEY = 'network_offline_mode';

export const useNetworkPreferences = create<NetworkPreferencesState>((set, get) => ({
  proxyUrl: '',
  useSystemProxy: false,
  offline: false,
  initialized: false,

  setProxyUrl: (url) => {
    set({ proxyUrl: url });
    StorageUtil.setItem(PROXY_URL_KEY, url, 'user-preferences.json');
  },

  setUseSystemProxy: (use) => {
    set({ useSystemProxy: use });
    StorageUtil.setItem(USE_SYSTEM_PROXY_KEY, use, 'user-preferences.json');
  },

  setOffline: (flag) => {
    set({ offline: flag });
    StorageUtil.setItem(OFFLINE_KEY, flag, 'user-preferences.json');
  },
}));

// 异步初始化
(async () => {
  const [url, use, offlineFlag] = await Promise.all([
    StorageUtil.getItem<string>(PROXY_URL_KEY, '', 'user-preferences.json'),
    StorageUtil.getItem<boolean>(USE_SYSTEM_PROXY_KEY, false, 'user-preferences.json'),
    StorageUtil.getItem<boolean>(OFFLINE_KEY, false, 'user-preferences.json'),
  ]);
  useNetworkPreferences.setState({ proxyUrl: url || '', useSystemProxy: !!use, offline: !!offlineFlag, initialized: true });
})(); 