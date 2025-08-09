import { providerRepository } from "../ProviderRepository";
import { ProviderEntity, ProviderStatus } from "../types";
import { ProviderRegistry } from "@/lib/llm";
import { KeyManager } from "@/lib/llm/KeyManager";
import { defaultCacheManager } from "@/lib/cache/CacheManager";
import { EVENTS } from "../events/keys";

export interface CheckResult {
  ok: boolean;
  reason?: "NO_KEY" | "AUTH" | "NETWORK" | "TIMEOUT" | "UNKNOWN";
  message?: string;
  meta?: any;
}

/**
 * 负责状态刷新（不做初始化、不强耦合模型拉取）。
 */
export class ProviderStatusService {
  private inflight = new Map<string, Promise<ProviderEntity | undefined>>();

  async refresh(name: string): Promise<ProviderEntity | undefined> {
      if (this.inflight.has(name)) return this.inflight.get(name)!;
      const p = this._refreshImpl(name).finally(() => this.inflight.delete(name));
      this.inflight.set(name, p);
      return p;
  }

  private async _refreshImpl(name: string): Promise<ProviderEntity | undefined> {
    const providers = await providerRepository.getAll();
    const target = providers.find((p) => p.name === name);
    if (!target) return undefined;

    const latestKey = target.requiresKey ? await KeyManager.getProviderKey(name) : null;
    if (target.requiresKey && !(latestKey && latestKey.trim())) {
      // 更新状态为 NO_KEY 并清空仓库记录的 apiKey
      await providerRepository.update({ name, status: ProviderStatus.NO_KEY, lastChecked: Date.now(), apiKey: null });
      // 额外：清理该 Provider 的模型缓存，避免 UI 看到过期模型
      try {
        const { modelRepository } = await import('../ModelRepository');
        await modelRepository.save(name, []);
      } catch (_) {}
      return { ...target, status: ProviderStatus.NO_KEY, apiKey: null } as ProviderEntity;
    }

    let finalStatus = ProviderStatus.NOT_CONNECTED;
    try {
      const strategy = ProviderRegistry.get(name);
      if (strategy) {
        const effectiveUrl = target.url?.trim() || (name === "Ollama" ? "http://localhost:11434" : "");
        if ((strategy as any).baseUrl !== effectiveUrl) {
          (strategy as any).baseUrl = effectiveUrl;
        }

        // 更新 llm/index 中的 OllamaProvider URL（如适用）
        if (name === "Ollama") {
          try {
            const { updateOllamaProviderUrl } = await import("@/lib/llm");
            await updateOllamaProviderUrl(effectiveUrl);
          } catch (_) {}
        }

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("TIMEOUT")), 10000);
        });

        // 兼容旧的 checkConnection() 返回值，统一转换为 CheckResult
        const raw = await Promise.race([Promise.resolve(strategy.checkConnection() as any), timeoutPromise]);
        const res: CheckResult = (raw as any)?.ok !== undefined
          ? (raw as CheckResult)
          : ("success" in (raw as any)
              ? { ok: !!(raw as any).success, message: (raw as any).message }
              : { ok: false, reason: 'UNKNOWN', message: 'Invalid check result' });

        finalStatus = res.ok ? ProviderStatus.CONNECTED : ProviderStatus.NOT_CONNECTED;
        // 记录检查原因与消息供 UI 展示
        await providerRepository.update({
          name,
          lastReason: res.reason,
          lastMessage: res.message ?? null,
          lastChecked: Date.now(),
        } as any);
      } else {
        finalStatus = ProviderStatus.UNKNOWN;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("TIMEOUT")) finalStatus = ProviderStatus.NOT_CONNECTED;
      else finalStatus = ProviderStatus.NOT_CONNECTED;
    }

    const updated: ProviderEntity = { ...target, status: finalStatus, lastChecked: Date.now() };
    await providerRepository.update(updated);
    // 触发细粒度事件
    await defaultCacheManager.set(EVENTS.providerStatus(name), updated);
    return updated;
  }

  async refreshAll(): Promise<void> {
    const providers = await providerRepository.getAll();
    await Promise.all(providers.map((p) => this.refresh(p.name)));
  }
}

export const providerStatusService = new ProviderStatusService();


