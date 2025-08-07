import { StorageUtil } from "@/lib/storage";
import { ProviderEntity } from "./types";
import { defaultCacheManager } from "@/lib/cache/CacheManager";

export class ProviderRepository {
  async getAll(): Promise<ProviderEntity[]> {
    // 先尝试从内存缓存读取
    const cached = await defaultCacheManager.get<ProviderEntity[]>("providers");
    if (cached) return cached;

    // 内存未命中则从持久化存储读取
    const list = await StorageUtil.getItem<ProviderEntity[]>("providers", [], "providers-config.json");

    // 写回内存缓存以便后续快速访问 & 触发订阅
    await defaultCacheManager.set("providers", list ?? []);
    return list ?? [];
  }

  /** 覆盖写入完整列表 */
  async saveAll(list: ProviderEntity[]): Promise<void> {
    // 写入内存缓存
    await defaultCacheManager.set("providers", list);
    // 持久化到磁盘
    await StorageUtil.setItem("providers", list, "providers-config.json");
  }

  /** 更新指定 Provider 条目（按 name 匹配） */
  async update(partial: Partial<ProviderEntity> & { name: string }): Promise<void> {
    const list = await this.getAll();
    const idx = list.findIndex((p) => p.name === partial.name);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...partial } as ProviderEntity;
    } else {
      list.push(partial as ProviderEntity);
    }
    await this.saveAll(list);
  }

  /** 订阅全列表变化 */
  subscribe(cb: (list: ProviderEntity[]) => void): () => void {
    return defaultCacheManager.subscribe("providers", () => {
      this.getAll().then(cb).catch(console.error);
    });
  }
}

export const providerRepository = new ProviderRepository(); 