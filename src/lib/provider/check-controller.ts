import { providerStatusService } from './services/ProviderStatusService';
import { providerModelService } from './services/ProviderModelService';
import type { ProviderEntity } from './types';

type CheckReason = 'blur' | 'url_saved' | 'manual' | 'init' | 'pref_changed';

export type CheckResult = {
  name: string;
  entity?: ProviderEntity;
  status: 'CONNECTED' | 'NOT_CONNECTED' | 'NO_KEY' | 'UNKNOWN';
  reason?: string;
  message?: string | null;
};

interface RequestOptions {
  reason: CheckReason;
  withModels?: boolean;
  debounceMs?: number;
  minIntervalMs?: number;
}

type Listener = (p: CheckResult) => void;

class EventBus {
  private map = new Map<string, Set<Listener>>();
  on(evt: 'start'|'success'|'fail'|'timeout'|'cancel', cb: Listener) {
    const set = this.map.get(evt) ?? new Set<Listener>();
    set.add(cb);
    this.map.set(evt, set);
    return () => { set.delete(cb); };
  }
  emit(evt: 'start'|'success'|'fail'|'timeout'|'cancel', payload: CheckResult) {
    const set = this.map.get(evt); if (!set) return;
    for (const cb of set) cb(payload);
  }
}

class CheckController {
  private bus = new EventBus();
  private inflight = new Map<string, Promise<ProviderEntity | undefined>>();
  private debounceTimers = new Map<string, any>();
  private lastRunAt = new Map<string, number>();
  private lastModelFetchAt = new Map<string, number>();

  on(evt: 'start'|'success'|'fail'|'timeout'|'cancel', cb: Listener) {
    return this.bus.on(evt, cb);
  }

  requestCheck(name: string, opts: RequestOptions) {
    const { debounceMs = 300, minIntervalMs = 2000 } = opts;
    const now = Date.now();
    const last = this.lastRunAt.get(name) || 0;
    if (now - last < minIntervalMs && opts.reason !== 'manual') {
      return; // 节流：短时间内避免重复检查
    }
    if (this.debounceTimers.has(name)) {
      clearTimeout(this.debounceTimers.get(name));
    }
    const timer = setTimeout(() => this.run(name, opts).catch(() => {}), debounceMs);
    this.debounceTimers.set(name, timer);
  }

  cancel(name: string) {
    const t = this.debounceTimers.get(name);
    if (t) clearTimeout(t);
    this.debounceTimers.delete(name);
    const p = this.inflight.get(name);
    if (p) {
      // 无法真正取消 Promise，但发出取消事件用于 UI 清理
      this.bus.emit('cancel', { name, status: 'UNKNOWN' });
    }
  }

  private async run(name: string, opts: RequestOptions) {
    this.lastRunAt.set(name, Date.now());
    this.bus.emit('start', { name, status: 'UNKNOWN' });

    try {
      const promise = providerStatusService.refresh(name).finally(() => {
        this.inflight.delete(name);
      });
      this.inflight.set(name, promise);

      const updated = await promise;
      if (!updated) {
        this.bus.emit('fail', { name, status: 'UNKNOWN', message: '刷新失败' });
        return;
      }

      // 成功后：按需拉取模型，做节流
      if ((updated as any).status === 'CONNECTED' && (opts.withModels ?? true)) {
        const lastFetch = this.lastModelFetchAt.get(name) || 0;
        if (Date.now() - lastFetch > 60_000) {
          try { await providerModelService.fetchIfNeeded(name); } catch {}
          this.lastModelFetchAt.set(name, Date.now());
        }
      }

      const status = ((): CheckResult['status'] => {
        switch ((updated as any).status) {
          case 'CONNECTED': return 'CONNECTED';
          case 'NOT_CONNECTED': return 'NOT_CONNECTED';
          case 'NO_KEY': return 'NO_KEY';
          default: return 'UNKNOWN';
        }
      })();

      this.bus.emit('success', {
        name,
        entity: updated,
        status,
        reason: (updated as any).lastReason,
        message: (updated as any).lastMessage ?? null,
      });
    } catch (e: any) {
      const msg = e?.message || String(e ?? '');
      const isTimeout = msg.includes('TIMEOUT') || msg.toLowerCase().includes('timeout');
      this.bus.emit(isTimeout ? 'timeout' : 'fail', { name, status: 'NOT_CONNECTED', message: msg });
    }
  }
}

export const checkController = new CheckController();


