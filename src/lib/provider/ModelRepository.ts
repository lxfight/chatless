import { defaultCacheManager } from "@/lib/cache/CacheManager";
import { ModelEntity } from "./types";
import { specializedStorage } from "@/lib/storage";

const MODEL_KEY_PREFIX = "models:"; // 每个 provider 独立缓存
const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 小时

type Listener = (provider: string) => void;

export class ModelRepository {
  private listeners: Set<Listener> = new Set();

  private key(name: string) {
    return MODEL_KEY_PREFIX + name;
  }

  async get(provider: string): Promise<ModelEntity[] | undefined> {
    // 先读内存缓存
    const inMem = await defaultCacheManager.get<ModelEntity[]>(this.key(provider));
    if (inMem) return inMem; // 允许为空数组作为已知状态

    // 尝试读取持久化存储
    try {
      const names = await specializedStorage.models.getProviderModels(provider);
      if (names && names.length) {
        const arr: ModelEntity[] = names.map((n) => ({ provider, name: n, aliases: [n] }));
        await defaultCacheManager.set(this.key(provider), arr);
        return arr;
      }
    } catch (_) {}

    // 不存在则返回空数组并写入缓存，减少上层判空复杂度
    await defaultCacheManager.set(this.key(provider), []);
    return [];
  }

  async save(provider: string, models: ModelEntity[], ttl: number = DEFAULT_TTL) {
    await defaultCacheManager.set(this.key(provider), models, { ttl });
    try {
      await specializedStorage.models.setProviderModels(provider, models.map(m=>m.name));
    } catch (_) {}

    // notify
    this.listeners.forEach(l=>l(provider));
  }

  /** 清空指定 provider 模型（保留键值结构） */
  async clear(provider: string) {
    await defaultCacheManager.set(this.key(provider), []);
    try { await specializedStorage.models.setProviderModels(provider, []);} catch(_){}
    this.listeners.forEach(l=>l(provider));
  }

  subscribe(provider: string, cb: (models: ModelEntity[] | undefined) => void): () => void {
    return defaultCacheManager.subscribe(this.key(provider), () => {
      this.get(provider).then(cb).catch(console.error);
    });
  }

  subscribeAll(cb: Listener) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
}

export const modelRepository = new ModelRepository(); 