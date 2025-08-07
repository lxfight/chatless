/**
 * 消息解析缓存管理器
 * 缓存消息解析结果，避免重复解析相同的消息内容
 */
export class MessageParseCache {
  private cache = new Map<string, {
    content: string;
    parsed: any;
    timestamp: number;
  }>();
  
  private readonly MAX_CACHE_SIZE = 100; // 最大缓存条目数
  private readonly CACHE_TTL = 5 * 60 * 1000; // 缓存生存时间（5分钟）

  /**
   * 获取解析结果
   */
  get(content: string, parser: (content: string) => any) {
    const cacheKey = this.generateCacheKey(content);
    const cached = this.cache.get(cacheKey);
    
    if (cached && this.isValid(cached)) {
      return cached.parsed;
    }
    
    // 解析并缓存
    const parsed = parser(content);
    this.set(content, parsed);
    
    return parsed;
  }

  /**
   * 设置缓存
   */
  private set(content: string, parsed: any) {
    const cacheKey = this.generateCacheKey(content);
    
    // 检查缓存大小，如果超过限制则清理最旧的条目
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.cleanup();
    }
    
    this.cache.set(cacheKey, {
      content,
      parsed,
      timestamp: Date.now()
    });
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(content: string): string {
    // 使用内容的哈希作为缓存键
    return this.hashString(content);
  }

  /**
   * 简单的字符串哈希函数
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return hash.toString();
  }

  /**
   * 检查缓存是否有效
   */
  private isValid(cached: { content: string; parsed: any; timestamp: number }): boolean {
    return Date.now() - cached.timestamp < this.CACHE_TTL;
  }

  /**
   * 清理过期和多余的缓存条目
   */
  private cleanup() {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    
    // 按时间戳排序，保留最新的条目
    entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
    
    // 保留最新的 MAX_CACHE_SIZE / 2 个条目
    const keepCount = Math.floor(this.MAX_CACHE_SIZE / 2);
    const toKeep = entries.slice(0, keepCount);
    
    this.cache.clear();
    toKeep.forEach(([key, value]) => {
      if (this.isValid(value)) {
        this.cache.set(key, value);
      }
    });
  }

  /**
   * 清空缓存
   */
  clear() {
    this.cache.clear();
  }

  /**
   * 获取缓存统计信息
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
      ttl: this.CACHE_TTL
    };
  }
}

// 全局实例
export const messageParseCache = new MessageParseCache(); 