import { LIST_TOOLS_TTL_MS, LIST_TOOLS_TIMEOUT_MS } from './constants';

// 获取工具缓存（从zustand store）
export async function getToolsCached(serverName: string): Promise<any[]> {
  try {
    // 动态导入避免循环依赖
    const { useMcpStore } = await import('@/store/mcpStore');
    const store = useMcpStore.getState();
    const cache = store.toolsCache[serverName];
    
    // 检查缓存是否有效
    if (cache && cache.ttl > Date.now()) {
      return cache.tools;
    }
    
    // 缓存过期或不存在，尝试从服务器获取
    const { serverManager } = await import('@/lib/mcp/ServerManager');
    const tools = await serverManager.listTools(serverName);
    if (Array.isArray(tools)) {
      store.updateToolsCache(serverName, tools);
      return tools;
    }
  } catch (error) {
    console.warn(`Failed to get tools for ${serverName}:`, error);
  }
  
  return [];
}

// 清除工具缓存
export function invalidateTools(serverName?: string): void {
  try {
    // 动态导入避免循环依赖
    import('@/store/mcpStore').then(({ useMcpStore }) => {
      const store = useMcpStore.getState();
      store.clearToolsCache(serverName);
    }).catch(error => {
      console.warn('Failed to invalidate tools cache:', error);
    });
  } catch (error) {
    console.warn('Failed to invalidate tools cache:', error);
  }
}
