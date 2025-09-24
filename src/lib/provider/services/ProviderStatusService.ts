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
    console.log('[ProviderStatusService] refresh start', name);
    const providers = await providerRepository.getAll();
    const target = providers.find((p) => p.name === name);
    if (!target) return undefined;

    // 若未配置服务地址（且不是内置有默认地址的 Provider），直接判定为不可用
    const lacksUrl = !target.url || !String(target.url).trim();
    if (lacksUrl && name !== 'Ollama') {
      const now = Date.now();
      const updated: ProviderEntity = { ...target, status: ProviderStatus.NOT_CONNECTED, lastChecked: now, lastReason: 'UNKNOWN', lastMessage: '未配置服务地址' } as any;
      await providerRepository.update(updated);
      try {
        const { useProviderStatusStore } = await import('@/store/providerStatusStore');
        useProviderStatusStore.getState().setStatus(name, { lastCheckedAt: now, lastResult: 'NOT_CONNECTED', lastMessage: '未配置服务地址' }, false);
      } catch {}
      console.log('[ProviderStatusService] no url, mark NOT_CONNECTED', name);
      return updated;
    }

    // 新策略：检查连通性时不再依赖真实密钥；
    // UI 对“是否配置密钥”的提示由设置页输入框负责展示。
    // 这里不再因缺失密钥而提前返回 NO_KEY。
    // 仍然读取一次（调试/扩展用），但不参与可达性判定
    const _latestKey = target.requiresKey ? await KeyManager.getProviderKey(name) : null;

    let finalStatus = ProviderStatus.NOT_CONNECTED;
    let lastReason: "NO_KEY" | "AUTH" | "NETWORK" | "TIMEOUT" | "UNKNOWN" | undefined = undefined;
    let lastMessage: string | null | undefined = undefined;
    try {
      // 确保运行时已注册该 Provider（用户自定义的 provider 需要动态注册）
      let strategy = ProviderRegistry.get(name);
      if (!strategy) {
        try {
          console.warn('[ProviderStatusService] strategy not found, syncing dynamic providers...', name);
          const { syncDynamicProviders } = await import('@/lib/llm');
          await syncDynamicProviders();
          strategy = ProviderRegistry.get(name);
        } catch (e) {
          console.warn('[ProviderStatusService] syncDynamicProviders failed', e);
        }
      }
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
          } catch {
            // noop
          }
        }

        // 交由 provider 自身实现超时/错误分类，这里不再二次Race，避免误将401/HTML当作超时
        console.log('[ProviderStatusService] calling checkConnection', name, effectiveUrl);
        const raw = await Promise.resolve(strategy.checkConnection() as any);
        const res: CheckResult = (raw)?.ok !== undefined
          ? (raw as CheckResult)
          : ("success" in (raw)
              ? { ok: !!(raw).success, message: (raw).message }
              : { ok: false, reason: 'UNKNOWN', message: 'Invalid check result' });

        finalStatus = res.ok ? ProviderStatus.CONNECTED : ProviderStatus.NOT_CONNECTED;
        lastReason = res.reason;
        lastMessage = res.message ?? null;
        console.log('[ProviderStatusService] checkConnection result', name, res);
      } else {
        finalStatus = ProviderStatus.UNKNOWN;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("TIMEOUT")) { finalStatus = ProviderStatus.NOT_CONNECTED; lastReason = 'TIMEOUT'; }
      else { finalStatus = ProviderStatus.NOT_CONNECTED; lastReason = 'NETWORK'; }
      lastMessage = msg;
    }

    const checkedAt = Date.now();
    const updated: ProviderEntity = { ...target, status: finalStatus, lastChecked: checkedAt, lastReason, lastMessage: lastMessage ?? null } as any;
    await providerRepository.update(updated);
    // 同步到前端状态存储：精确 lastCheckedAt 与上次结果/消息
    try {
      const { useProviderStatusStore } = await import('@/store/providerStatusStore');
      useProviderStatusStore.getState().setStatus(name, {
        lastCheckedAt: checkedAt,
        lastResult: (finalStatus as any) as ('CONNECTED'|'NOT_CONNECTED'|'UNKNOWN'),
        lastMessage: lastMessage ?? null,
      }, false);
    } catch {}
    console.log('[ProviderStatusService] refresh done', name, updated.status, updated.lastReason, updated.lastMessage);
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

 
