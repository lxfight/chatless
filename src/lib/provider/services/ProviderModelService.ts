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
    // 合并静态模型与用户已添加模型，避免覆盖用户新增项
    const staticList = getStaticModels(name) || [];
    const existing = (await modelRepository.get(name)) || [];

    const byName = new Map<string, { provider: string; name: string; label?: string; aliases: string[] }>();
    for (const m of existing) byName.set(m.name, m);
    for (const s of staticList) {
      if (!byName.has(s.id)) byName.set(s.id, { provider: name, name: s.id, label: s.label, aliases: [s.id] });
    }

    const merged = Array.from(byName.values());
    await modelRepository.save(name, merged, ttl);
    await defaultCacheManager.set(EVENTS.providerModels(name), true);
  }
}

export const providerModelService = new ProviderModelService();


