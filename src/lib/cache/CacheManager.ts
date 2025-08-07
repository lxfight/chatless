import { specializedStorage } from "@/lib/storage";

/**
 * 通用缓存管理器：提供最小 get/set/evict/subscribe 能力并支持 TTL。
 * 首步实现仅使用内存 Map；后续将逐步接入 specializedStorage 持久化。
 */
export interface CacheOptions {
  /** 毫秒级 TTL；如果省略则不过期 */
  ttl?: number;
}

interface CacheEntry<T = any> {
  value: T;
  expiresAt: number | null; // null == 永不过期
}

/**
 * 观察者函数签名
 */
export type CacheListener = (key: string, value: unknown) => void;

export class CacheManager {
  private store = new Map<string, CacheEntry>();
  private listeners = new Map<string, Set<CacheListener>>();

  /** 读取缓存；如果不存在且提供 loader 则调用 loader 填充 */
  async get<T>(
    key: string,
    loader?: () => Promise<T>,
    opts?: CacheOptions
  ): Promise<T | undefined> {
    const entry = this.store.get(key);
    const now = Date.now();

    if (entry && (entry.expiresAt === null || entry.expiresAt > now)) {
      return entry.value as T;
    }

    if (loader) {
      const data = await loader();
      await this.set(key, data, opts);
      return data;
    }
    return undefined;
  }

  /** 写入缓存 */
  async set<T>(key: string, value: T, opts?: CacheOptions): Promise<void> {
    const expiresAt = opts?.ttl ? Date.now() + opts.ttl : null;
    this.store.set(key, { value, expiresAt });

    // TODO: 后续接入持久化存储 specializedStorage.cache

    // 通知监听器
    const set = this.listeners.get(key);
    if (set) {
      set.forEach((cb) => {
        try {
          cb(key, value);
        } catch (_) {}
      });
    }
  }

  /** 删除缓存 */
  async evict(key: string): Promise<void> {
    this.store.delete(key);
    // TODO: specializedStorage.cache?.evict(key)
  }

  /** 清理所有缓存 */
  async clear(): Promise<void> {
    this.store.clear();
    this.listeners.clear();
    // TODO: specializedStorage.cache?.clear()
  }

  /** 订阅指定 key 的变化，返回取消函数 */
  subscribe(key: string, listener: CacheListener): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener);
    return () => this.listeners.get(key)!.delete(listener);
  }
}

// 默认单例，可按需注入自定义实例
export const defaultCacheManager = new CacheManager(); 