import StorageUtil from '@/lib/storage';

interface CachedServerInfo {
  serverName: string;
  tools: any[];
  lastConnected: number;
  version?: string; // 用于检测服务器更新
  connectionConfig?: any; // 连接配置，用于重连
}

interface PersistentCache {
  servers: Record<string, CachedServerInfo>;
  lastUpdate: number;
}

const CACHE_VERSION = '1.0.0';
const CACHE_FILE = 'mcp-persistent-cache.json';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24小时
const PRECONNECT_TIMEOUT = 3000; // 预连接超时

/**
 * 持久化MCP工具缓存管理器
 * 提供离线工具信息和快速重连功能
 */
export class PersistentMcpCache {
  private cache: PersistentCache | null = null;
  private loading = false;

  async init(): Promise<void> {
    if (this.loading || this.cache) return;
    this.loading = true;

    try {
      const cached = await StorageUtil.getItem<PersistentCache>(
        'persistent_cache', 
        { servers: {}, lastUpdate: 0 }, 
        CACHE_FILE
      );
      
      // 检查缓存版本，如果不匹配则重置
      if (!cached || this.isCacheExpired(cached)) {
        this.cache = { servers: {}, lastUpdate: Date.now() };
        await this.save();
      } else {
        this.cache = cached;
      }
      
      console.log(`[MCP-Cache] 已加载缓存，包含 ${Object.keys(this.cache.servers).length} 个服务器信息`);
    } catch (error) {
      console.warn('[MCP-Cache] 缓存初始化失败，使用空缓存:', error);
      this.cache = { servers: {}, lastUpdate: Date.now() };
    } finally {
      this.loading = false;
    }
  }

  private isCacheExpired(cache: PersistentCache): boolean {
    return Date.now() - cache.lastUpdate > CACHE_TTL;
  }

  private async save(): Promise<void> {
    if (!this.cache) return;
    
    try {
      await StorageUtil.setItem('persistent_cache', this.cache, CACHE_FILE);
    } catch (error) {
      console.warn('[MCP-Cache] 保存缓存失败:', error);
    }
  }

  /**
   * 获取缓存的工具信息（优先使用缓存，后台更新）
   */
  async getToolsWithCache(serverName: string): Promise<any[]> {
    await this.init();
    
    const cachedInfo = this.cache?.servers[serverName];
    const hasValidCache = cachedInfo && 
      Date.now() - cachedInfo.lastConnected < CACHE_TTL &&
      Array.isArray(cachedInfo.tools) &&
      cachedInfo.tools.length > 0;

    // 如果有有效缓存，立即返回并后台更新
    if (hasValidCache) {
      console.log(`[MCP-Cache] 使用缓存的工具信息: ${serverName} (${cachedInfo.tools.length}个工具)`);
      
      // 后台尝试更新（不等待）
      this.updateToolsInBackground(serverName).catch(() => {
        // 静默失败，继续使用缓存
      });
      
      return cachedInfo.tools;
    }

    // 无有效缓存，尝试实时获取
    return this.fetchAndCacheTools(serverName);
  }

  /**
   * 实时获取并缓存工具信息
   */
  private async fetchAndCacheTools(serverName: string): Promise<any[]> {
    try {
      const { serverManager } = await import('./ServerManager');
      
      console.log(`[MCP-Cache] 实时获取工具信息: ${serverName}`);
      const tools = await this.withTimeout(
        serverManager.listTools(serverName),
        PRECONNECT_TIMEOUT
      );

      if (Array.isArray(tools)) {
        await this.updateCache(serverName, tools);
        return tools;
      }
    } catch (error) {
      console.warn(`[MCP-Cache] 获取工具失败: ${serverName}`, error);
      
      // 尝试使用过期缓存作为降级方案
      const cachedInfo = this.cache?.servers[serverName];
      if (cachedInfo?.tools) {
        console.log(`[MCP-Cache] 使用过期缓存作为降级方案: ${serverName}`);
        return cachedInfo.tools;
      }
    }

    return [];
  }

  /**
   * 后台更新工具信息
   */
  private async updateToolsInBackground(serverName: string): Promise<void> {
    try {
      const { serverManager } = await import('./ServerManager');
      
      const tools = await this.withTimeout(
        serverManager.listTools(serverName),
        PRECONNECT_TIMEOUT
      );

      if (Array.isArray(tools)) {
        await this.updateCache(serverName, tools);
        console.log(`[MCP-Cache] 后台更新完成: ${serverName}`);
      }
    } catch (error) {
      // 静默失败，继续使用现有缓存
      console.debug(`[MCP-Cache] 后台更新失败: ${serverName}`, error);
    }
  }

  /**
   * 更新缓存
   */
  private async updateCache(serverName: string, tools: any[]): Promise<void> {
    if (!this.cache) return;

    this.cache.servers[serverName] = {
      serverName,
      tools,
      lastConnected: Date.now(),
      version: CACHE_VERSION
    };

    this.cache.lastUpdate = Date.now();
    await this.save();
  }

  /**
   * 预连接指定的服务器（用于提示词生成前）
   */
  async preconnectServers(serverNames: string[]): Promise<Record<string, any[]>> {
    await this.init();
    
    const results: Record<string, any[]> = {};
    
    // 并行预连接所有服务器
    const promises = serverNames.map(async (serverName) => {
      try {
        const tools = await this.getToolsWithCache(serverName);
        results[serverName] = tools;
        return { serverName, success: true, toolCount: tools.length };
      } catch (error) {
        console.warn(`[MCP-Cache] 预连接失败: ${serverName}`, error);
        results[serverName] = [];
        return { serverName, success: false, error };
      }
    });

    const connectionResults = await Promise.allSettled(promises);
    
    const successCount = connectionResults
      .filter(r => r.status === 'fulfilled' && r.value.success)
      .length;
      
    console.log(`[MCP-Cache] 预连接完成: ${successCount}/${serverNames.length} 个服务器成功`);
    
    return results;
  }

  /**
   * 清除指定服务器的缓存
   */
  async clearCache(serverName?: string): Promise<void> {
    await this.init();
    
    if (!this.cache) return;

    if (serverName) {
      delete this.cache.servers[serverName];
      console.log(`[MCP-Cache] 已清除缓存: ${serverName}`);
    } else {
      this.cache.servers = {};
      console.log('[MCP-Cache] 已清除所有缓存');
    }

    this.cache.lastUpdate = Date.now();
    await this.save();
  }

  /**
   * 获取缓存统计信息
   */
  async getCacheStats(): Promise<{
    totalServers: number;
    cachedServers: string[];
    lastUpdate: number;
    cacheSize: number;
  }> {
    await this.init();
    
    if (!this.cache) {
      return { totalServers: 0, cachedServers: [], lastUpdate: 0, cacheSize: 0 };
    }

    const cachedServers = Object.keys(this.cache.servers);
    const cacheSize = JSON.stringify(this.cache).length;

    return {
      totalServers: cachedServers.length,
      cachedServers,
      lastUpdate: this.cache.lastUpdate,
      cacheSize
    };
  }

  /**
   * 带超时的Promise包装器
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error(`操作超时 (${timeoutMs}ms)`)), timeoutMs)
      )
    ]);
  }
}

// 单例实例
export const persistentCache = new PersistentMcpCache();
