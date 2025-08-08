import { modelRepository } from "../ModelRepository";
import { providerRepository } from "../ProviderRepository";
import { ProviderStatus } from "../types";
import { ProviderRegistry } from "@/lib/llm";
import { defaultCacheManager } from "@/lib/cache/CacheManager";
import { EVENTS } from "../events/keys";

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
    const providers = await providerRepository.getAll();
    const target = providers.find((p) => p.name === name);
    if (!target) return;
    if (target.status !== ProviderStatus.CONNECTED) return; // 仅在已连接时拉取

    const strat = ProviderRegistry.get(name);
    if (!strat || !strat.fetchModels) return;

    try {
      const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), 10000));
      const modelsRaw = await Promise.race([Promise.resolve(strat.fetchModels()), timeoutPromise]);
      if (modelsRaw && modelsRaw.length) {
        await modelRepository.save(
          name,
          modelsRaw.map((m) => ({ provider: name, name: m.name, label: m.label, aliases: m.aliases || [m.name] })),
          ttl
        );
        await defaultCacheManager.set(EVENTS.providerModels(name), true);
      }
    } catch (_) {
      // 降级：保持旧缓存
    }
  }
}

export const providerModelService = new ProviderModelService();


