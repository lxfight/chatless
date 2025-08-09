import { modelRepository } from "../ModelRepository";
import { providerRepository } from "../ProviderRepository";
import { ProviderStatus } from "../types";
import { defaultCacheManager } from "@/lib/cache/CacheManager";
import { EVENTS } from "../events/keys";
import { getStaticModels } from "../staticModels";

const DEFAULT_TTL = 24 * 60 * 60 * 1000;

/**
 * 负责按需拉取模型列表，带 TTL 与错误降级。
 */
export class ProviderModelService {
  private inflight = new Map<string, Promise<void>>();

  async fetchIfNeeded(name: string, ttl: number = DEFAULT_TTL): Promise<void> {
    if (this.inflight.has(name)) return this.inflight.get(name)!;
    const p = this._fetchImpl(name, ttl).finally(() => this.inflight.delete(name));
    this.inflight.set(name, p);
    return p;
  }

  private async _fetchImpl(name: string, ttl: number): Promise<void> {
    // 改为只写入静态模型（不做在线拉取）
    const staticList = getStaticModels(name);
    if (staticList?.length) {
      await modelRepository.save(
        name,
        staticList.map((m) => ({ provider: name, name: m.id, label: m.label, aliases: [m.id] })),
        ttl
      );
      await defaultCacheManager.set(EVENTS.providerModels(name), true);
    }
  }
}

export const providerModelService = new ProviderModelService();


