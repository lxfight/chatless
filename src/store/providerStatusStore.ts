import { create } from 'zustand';

// Provider 状态枚举
export type ProviderStatusCode =
  | 'UNKNOWN'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'NOT_CONNECTED'
  | 'NO_KEY';

// 临时状态（检查后显示，不持久化）
export type TemporaryStatusCode = 'CONNECTING' | 'CONNECTED' | 'NOT_CONNECTED';

// 配置状态（持久化，因为这是配置问题）
export type ConfigStatusCode = 'NO_KEY' | 'NO_FETCHER';

export interface ProviderStatus {
  // 不保存实时状态，只保存检查时间
  lastCheckedAt?: number;
  // 临时状态（检查后显示，不持久化）
  temporaryStatus?: TemporaryStatusCode;
  // 配置状态（持久化，因为这是配置问题）
  configStatus?: ConfigStatusCode;
  // 临时状态的消息
  temporaryMessage?: string | null;
}

interface ProviderStatusState {
  /** key: providerName → 状态 */
  map: Record<string, ProviderStatus>;

  /** 更新单个 provider 状态 */
  setStatus: (
    providerName: string,
    next: Partial<ProviderStatus>,
    /** 是否持久化到 ProviderRepository, 默认 false */
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

  /** 清除临时状态 */
  clearTemporaryStatus: (providerName: string) => void;
}

export const useProviderStatusStore = create<ProviderStatusState>()((set, get) => ({
  map: {},

  setStatus: (providerName, next, persist = false) => {
    set((state) => {
      const prev = state.map[providerName] || {};
      const updated = { ...prev, ...next };
      
      // 检查是否有变化
      const unchanged = 
        prev.lastCheckedAt === updated.lastCheckedAt &&
        prev.temporaryStatus === updated.temporaryStatus &&
        prev.configStatus === updated.configStatus &&
        prev.temporaryMessage === updated.temporaryMessage;
      
      if (unchanged) return {};
      return { map: { ...state.map, [providerName]: updated } };
    });

    // 只持久化配置状态
    if (persist && next.configStatus) {
      void import('@/lib/provider/ProviderRepository').then(({ providerRepository }) => {
        providerRepository.update({
          name: providerName,
          status: next.configStatus as any,
          lastMessage: next.temporaryMessage,
          lastChecked: next.lastCheckedAt ?? Date.now(),
        }).catch(() => {});
      });
    }
  },

  bulkSet: (bulk, persist = false) => {
    set({ map: { ...get().map, ...bulk } });
    if (persist) {
      // 只持久化配置状态
      Object.entries(bulk).forEach(([name, stat]) => {
        if (stat.configStatus) {
          void import('@/lib/provider/ProviderRepository').then(({ providerRepository }) => {
            providerRepository.update({
              name,
              status: stat.configStatus as any,
              lastMessage: stat.temporaryMessage,
              lastChecked: stat.lastCheckedAt ?? Date.now(),
            }).catch(() => {});
          });
        }
      });
    }
  },

  get: (providerName) => get().map[providerName],

  clearTemporaryStatus: (providerName) => {
    set((state) => {
      const current = state.map[providerName];
      if (!current) return {};
      
      const updated = { ...current };
      delete updated.temporaryStatus;
      delete updated.temporaryMessage;
      
      return { map: { ...state.map, [providerName]: updated } };
    });
  },
})); 