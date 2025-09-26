/**
 * MCP预热系统
 * 在用户输入@mention时主动预连接和缓存工具信息
 */

import { persistentCache } from './persistentCache';
import { getGlobalEnabledServers } from './chatIntegration';

// 预热状态管理
interface PreheatingState {
  serverName: string;
  startTime: number;
  status: 'preheating' | 'completed' | 'failed';
}

class McpPreheater {
  private preheatingServers = new Map<string, PreheatingState>();
  private preheatingQueue = new Set<string>();
  private readonly PREHEAT_TIMEOUT = 5000; // 5秒超时
  private readonly DEBOUNCE_DELAY = 500; // 防抖延迟

  /**
   * 从输入文本中提取@mention的服务器名称
   */
  private extractMentionedServers(inputText: string): string[] {
    const mentionRegex = /@([a-zA-Z0-9_-]+)/g;
    const mentioned: string[] = [];
    let match;
    
    while ((match = mentionRegex.exec(inputText)) !== null) {
      const serverName = match[1];
      if (serverName && !mentioned.includes(serverName)) {
        mentioned.push(serverName);
      }
    }
    
    return mentioned;
  }

  /**
   * 检查服务器是否已启用
   */
  private async filterEnabledServers(serverNames: string[]): Promise<string[]> {
    try {
      const globalEnabled = await getGlobalEnabledServers();
      return serverNames.filter(name => globalEnabled.includes(name));
    } catch (error) {
      console.warn('[MCP-Preheater] 获取启用服务器列表失败:', error);
      return [];
    }
  }

  /**
   * 预热单个服务器
   */
  private async preheatServer(serverName: string): Promise<void> {
    const startTime = Date.now();
    
    // 更新预热状态
    this.preheatingServers.set(serverName, {
      serverName,
      startTime,
      status: 'preheating'
    });

    try {
      console.log(`[MCP-Preheater] 开始预热服务器: ${serverName}`);
      
      // 使用持久化缓存的超时获取
      const tools = await this.withTimeout(
        persistentCache.getToolsWithCache(serverName),
        this.PREHEAT_TIMEOUT
      );

      const duration = Date.now() - startTime;
      console.log(`[MCP-Preheater] 预热完成: ${serverName} (${duration}ms, ${tools.length}个工具)`);
      
      // 更新状态为完成
      this.preheatingServers.set(serverName, {
        serverName,
        startTime,
        status: 'completed'
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      console.warn(`[MCP-Preheater] 预热失败: ${serverName} (${duration}ms)`, error);
      
      // 更新状态为失败
      this.preheatingServers.set(serverName, {
        serverName,
        startTime,
        status: 'failed'
      });
    } finally {
      // 从队列中移除
      this.preheatingQueue.delete(serverName);
    }
  }

  /**
   * 带超时的Promise包装器
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error(`预热超时 (${timeoutMs}ms)`)), timeoutMs)
      )
    ]);
  }

  /**
   * 防抖处理函数
   */
  private debounceTimers = new Map<string, NodeJS.Timeout>();

  /**
   * 主要API：根据输入文本预热@mention的服务器
   */
  async preheatFromInput(inputText: string): Promise<void> {
    if (!inputText || typeof inputText !== 'string') {
      return;
    }

    // 提取@mention的服务器
    const mentionedServers = this.extractMentionedServers(inputText);
    if (mentionedServers.length === 0) {
      return;
    }

    // 过滤出启用的服务器
    const enabledServers = await this.filterEnabledServers(mentionedServers);
    if (enabledServers.length === 0) {
      return;
    }

    // 防抖处理：为每个服务器设置独立的防抖
    for (const serverName of enabledServers) {
      // 清除之前的防抖计时器
      const existingTimer = this.debounceTimers.get(serverName);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // 检查是否需要预热
      const currentState = this.preheatingServers.get(serverName);
      const shouldPreheat = !currentState || 
                           currentState.status === 'failed' || 
                           (Date.now() - currentState.startTime > 30000); // 30秒后可重新预热

      if (shouldPreheat && !this.preheatingQueue.has(serverName)) {
        // 设置新的防抖计时器
        const timer = setTimeout(() => {
          this.preheatingQueue.add(serverName);
          this.preheatServer(serverName).catch(() => {
            // 错误已在preheatServer中处理
          });
          this.debounceTimers.delete(serverName);
        }, this.DEBOUNCE_DELAY);

        this.debounceTimers.set(serverName, timer);
      }
    }
  }

  /**
   * 获取预热状态（用于调试或UI显示）
   */
  getPreheatingStatus(): Record<string, PreheatingState> {
    const result: Record<string, PreheatingState> = {};
    this.preheatingServers.forEach((state, serverName) => {
      result[serverName] = { ...state };
    });
    return result;
  }

  /**
   * 检查服务器是否已预热完成
   */
  isServerPreheated(serverName: string): boolean {
    const state = this.preheatingServers.get(serverName);
    return state?.status === 'completed';
  }

  /**
   * 清理过期的预热状态（清理内存）
   */
  cleanup(): void {
    const now = Date.now();
    const CLEANUP_THRESHOLD = 5 * 60 * 1000; // 5分钟

    this.preheatingServers.forEach((state, serverName) => {
      if (now - state.startTime > CLEANUP_THRESHOLD) {
        this.preheatingServers.delete(serverName);
      }
    });

    // 清理防抖计时器
    this.debounceTimers.forEach((timer, serverName) => {
      const state = this.preheatingServers.get(serverName);
      if (!state || state.status !== 'preheating') {
        clearTimeout(timer);
        this.debounceTimers.delete(serverName);
      }
    });
  }
}

// 导出单例实例
export const mcpPreheater = new McpPreheater();

// 定期清理（可选，避免内存泄漏）
if (typeof window !== 'undefined') {
  setInterval(() => {
    mcpPreheater.cleanup();
  }, 5 * 60 * 1000); // 每5分钟清理一次
}
