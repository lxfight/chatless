import { create } from 'zustand';

interface ProviderStatusState {
  // 使用 Record<string, boolean | undefined> 来存储状态
  // key: providerName, value: isConnected (true/false/undefined)
  statuses: Record<string, boolean | undefined>;
  // 更新特定 provider 状态的函数
  setStatus: (providerName: string, status: boolean | undefined) => void;
  // (可选) 获取特定 provider 状态的函数
  getStatus: (providerName: string) => boolean | undefined;
}

// 使用 Zustand 推荐的类型方式
export const useProviderStatusStore = create<ProviderStatusState>()((set, get) => ({
  statuses: {},
  setStatus: (providerName, status) =>
    set((state) => {
      if (state.statuses[providerName] === status) {
        return {}; // 返回空对象表示不更新
      }
      return {
        statuses: {
          ...state.statuses,
          [providerName]: status,
        },
      };
    }),
  getStatus: (providerName) => get().statuses[providerName],
})); 