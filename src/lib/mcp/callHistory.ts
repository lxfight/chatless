/**
 * MCP工具调用历史记录，用于避免重复调用
 */

interface CallRecord {
  server: string;
  tool: string;
  args: string; // JSON字符串
  timestamp: number;
  success: boolean;
  result?: any;
}

class McpCallHistory {
  private history = new Map<string, CallRecord>();
  private readonly DUPLICATE_THRESHOLD = 60000; // 60秒内重复调用判定
  private readonly MAX_HISTORY_SIZE = 100; // 最大历史记录数

  /**
   * 生成调用的唯一键
   */
  private generateKey(server: string, tool: string, args: any): string {
    const argsStr = typeof args === 'string' ? args : JSON.stringify(args || {});
    return `${server}:${tool}:${argsStr}`;
  }

  /**
   * 检查是否是重复调用
   */
  isDuplicateCall(server: string, tool: string, args: any): boolean {
    const key = this.generateKey(server, tool, args);
    const record = this.history.get(key);
    
    if (!record) {
      return false;
    }

    const timeDiff = Date.now() - record.timestamp;
    
    // 如果在阈值时间内且上次调用成功，则认为是重复调用
    return timeDiff < this.DUPLICATE_THRESHOLD && record.success;
  }

  /**
   * 获取最近的成功调用结果
   */
  getRecentResult(server: string, tool: string, args: any): any | null {
    const key = this.generateKey(server, tool, args);
    const record = this.history.get(key);
    
    if (!record || !record.success) {
      return null;
    }

    const timeDiff = Date.now() - record.timestamp;
    
    // 10分钟内的成功结果可以复用
    if (timeDiff < 10 * 60 * 1000) {
      return record.result;
    }

    return null;
  }

  /**
   * 记录调用
   */
  recordCall(server: string, tool: string, args: any, success: boolean, result?: any): void {
    const key = this.generateKey(server, tool, args);
    
    this.history.set(key, {
      server,
      tool,
      args: typeof args === 'string' ? args : JSON.stringify(args || {}),
      timestamp: Date.now(),
      success,
      result: success ? result : undefined
    });

    // 清理过期记录
    this.cleanup();
  }

  /**
   * 清理过期记录
   */
  private cleanup(): void {
    if (this.history.size <= this.MAX_HISTORY_SIZE) {
      return;
    }

    const now = Date.now();
    const EXPIRE_TIME = 60 * 60 * 1000; // 1小时

    // 删除过期记录
    for (const [key, record] of this.history.entries()) {
      if (now - record.timestamp > EXPIRE_TIME) {
        this.history.delete(key);
      }
    }

    // 如果还是太多，删除最旧的记录
    if (this.history.size > this.MAX_HISTORY_SIZE) {
      const entries = Array.from(this.history.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toDelete = entries.slice(0, entries.length - this.MAX_HISTORY_SIZE);
      toDelete.forEach(([key]) => {
        this.history.delete(key);
      });
    }
  }

  /**
   * 获取调用统计
   */
  getStats(): {
    totalCalls: number;
    recentCalls: number;
    successRate: number;
  } {
    const now = Date.now();
    const RECENT_THRESHOLD = 5 * 60 * 1000; // 5分钟

    let recentCalls = 0;
    let recentSuccess = 0;
    let totalSuccess = 0;

    for (const record of this.history.values()) {
      if (now - record.timestamp < RECENT_THRESHOLD) {
        recentCalls++;
        if (record.success) {
          recentSuccess++;
        }
      }
      
      if (record.success) {
        totalSuccess++;
      }
    }

    return {
      totalCalls: this.history.size,
      recentCalls,
      successRate: this.history.size > 0 ? totalSuccess / this.history.size : 0
    };
  }

  /**
   * 清除所有历史记录
   */
  clear(): void {
    this.history.clear();
  }
}

// 导出单例实例
export const mcpCallHistory = new McpCallHistory();
