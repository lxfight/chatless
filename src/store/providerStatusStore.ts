import { create } from 'zustand';

// Provider 连接状态枚举
export type ProviderStatusCode =
  | 'UNKNOWN'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'NOT_CONNECTED'
  | 'NO_KEY';

export interface ProviderStatus {
  status: ProviderStatusCode;
  message?: string | null;
  lastChecked?: number; // epoch ms
}

interface ProviderStatusState {
  /** key: providerName → 连接状态 */
  map: Record<string, ProviderStatus>;

  /** 更新单个 provider 状态 */
  setStatus: (
    providerName: string,
    next: ProviderStatus,
    /** 是否持久化到 ProviderRepository, 默认 true */
    persist?: boolean,
  ) => void;

  /** 批量写入，用于初始化 */
  bulkSet: (
    bulk: Record<string, ProviderStatus>,
    /** 是否持久化, 默认 false */
    persist?: boolean,
  ) => void;

  /** 读取单个 */
  get: (providerName: string) => ProviderStatus | undefined;
}

export const useProviderStatusStore = create<ProviderStatusState>()((set, get) => ({
  map: {},

  setStatus: (providerName, next, persist = true) => {
    set((state) => {
      const prev = state.map[providerName];
      const unchanged = prev &&
        prev.status === next.status &&
        prev.message === next.message &&
        prev.lastChecked === next.lastChecked;
      if (unchanged) return {};
      return { map: { ...state.map, [providerName]: next } };
    });

    if (persist) {
      import('@/lib/provider/ProviderRepository').then(({ providerRepository }) => {
        providerRepository.update({
          name: providerName,
          lastStatus: next.status,
          lastMessage: next.message,
          lastChecked: next.lastChecked ?? Date.now(),
        }).catch(() => {});
      });
    }
  },

  bulkSet: (bulk, persist = false) => {
    set({ map: { ...get().map, ...bulk } });
    if (persist) {
      // 顺序写入
      Object.entries(bulk).forEach(([name, stat]) => {
        import('@/lib/provider/ProviderRepository').then(({ providerRepository }) => {
          providerRepository.update({
            name,
            lastStatus: stat.status,
            lastMessage: stat.message,
            lastChecked: stat.lastChecked ?? Date.now(),
          }).catch(() => {});
        });
      });
    }
  },

  get: (providerName) => get().map[providerName],
})); 