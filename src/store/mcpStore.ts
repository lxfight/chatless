import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export interface McpServerStatus {
  name: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  lastUpdate: Date;
}

export interface McpToolsCache {
  [serverName: string]: {
    tools: any[];
    lastUpdate: Date;
    ttl: number;
  };
}

interface McpState {
  // 服务器状态
  serverStatuses: Record<string, string>; // name -> status
  // 工具缓存
  toolsCache: McpToolsCache;
  
  // Actions
  setServerStatus: (name: string, status: string) => void;
  setServerStatuses: (statuses: Record<string, string>) => void;
  updateToolsCache: (serverName: string, tools: any[]) => void;
  clearToolsCache: (serverName?: string) => void;
  reset: () => void;
}

const initialState = {
  serverStatuses: {},
  toolsCache: {}
};

export const useMcpStore = create<McpState>()(
  devtools(
    persist(
      (set, get) => ({
      ...initialState,

      setServerStatus: (name: string, status: string) => {
        set((state) => ({
          serverStatuses: { ...state.serverStatuses, [name]: status }
        }));
      },

      setServerStatuses: (statuses: Record<string, string>) => {
        set({ serverStatuses: statuses });
      },

      updateToolsCache: (serverName: string, tools: any[]) => {
        set((state) => ({
          toolsCache: {
            ...state.toolsCache,
            [serverName]: {
              tools,
              lastUpdate: new Date(),
              ttl: Date.now() + 5 * 60 * 1000 // 5分钟TTL
            }
          }
        }));
      },

      clearToolsCache: (serverName?: string) => {
        if (serverName) {
          set((state) => {
            const newCache = { ...state.toolsCache };
            delete newCache[serverName];
            return { toolsCache: newCache };
          });
        } else {
          set({ toolsCache: {} });
        }
      },

              reset: () => {
          set(initialState);
        }
      }),
      {
        name: 'mcp-store',
        // 仅持久化工具缓存，服务器状态属于运行时信息
        partialize: (state) => ({
          toolsCache: state.toolsCache
        })
      }
    ),
    {
      name: 'mcp-store'
    }
  )
);

// 便捷的hooks
export const useMcpServerStatuses = () => useMcpStore((state) => state.serverStatuses);
export const useMcpToolsCache = () => useMcpStore((state) => state.toolsCache);

