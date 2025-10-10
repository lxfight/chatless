/**
 * MCP工具调用授权状态管理
 */

import { create } from 'zustand';

export interface PendingAuthorization {
  id: string; // 唯一ID
  messageId: string;
  server: string;
  tool: string;
  args?: Record<string, unknown>;
  createdAt: number;
  // 授权决策回调
  onApprove: () => void;
  onReject: () => void;
}

interface AuthorizationState {
  pendingAuthorizations: Map<string, PendingAuthorization>;
  
  // 添加待授权请求
  addPendingAuthorization: (auth: PendingAuthorization) => void;
  
  // 批准授权
  approveAuthorization: (id: string) => void;
  
  // 拒绝授权
  rejectAuthorization: (id: string) => void;
  
  // 移除授权请求（用于清理）
  removeAuthorization: (id: string) => void;
  
  // 获取待授权请求
  getPendingAuthorization: (id: string) => PendingAuthorization | undefined;
  
  // 检查是否有待授权请求
  hasPendingAuthorization: (id: string) => boolean;
}

export const useAuthorizationStore = create<AuthorizationState>((set, get) => ({
  pendingAuthorizations: new Map(),
  
  addPendingAuthorization: (auth) => {
    set((state) => {
      const newMap = new Map(state.pendingAuthorizations);
      newMap.set(auth.id, auth);
      return { pendingAuthorizations: newMap };
    });
  },
  
  approveAuthorization: (id) => {
    const auth = get().getPendingAuthorization(id);
    if (auth) {
      auth.onApprove();
      get().removeAuthorization(id);
    }
  },
  
  rejectAuthorization: (id) => {
    const auth = get().getPendingAuthorization(id);
    if (auth) {
      auth.onReject();
      get().removeAuthorization(id);
    }
  },
  
  removeAuthorization: (id) => {
    set((state) => {
      const newMap = new Map(state.pendingAuthorizations);
      newMap.delete(id);
      return { pendingAuthorizations: newMap };
    });
  },
  
  getPendingAuthorization: (id) => {
    return get().pendingAuthorizations.get(id);
  },
  
  hasPendingAuthorization: (id) => {
    return get().pendingAuthorizations.has(id);
  },
}));

