import { modelRepository } from "../ModelRepository";
import { providerRepository } from "../ProviderRepository";
import { ProviderStatus } from "../types";
import { defaultCacheManager } from "@/lib/cache/CacheManager";
import { EVENTS } from "../events/keys";
import { getStaticModels } from "../staticModels";
import { ProviderRegistry } from "@/lib/llm";
import { specializedStorage } from "@/lib/storage";
import { MODEL_FETCH_RULES, type ModelFetchRule } from "@/config/modelFetchRules";
import { tauriFetch } from "@/lib/request";

const DEFAULT_TTL = 24 * 60 * 60 * 1000;

// ---- 辅助：解析模型名用于排序（尽量鲁棒，解析失败则返回默认值） ----
function parseModelNameForSort(name: string): {
  base: string;          // 冒号前的基名，例如 "qwen2.5"
  sizeScore: number;     // 规模分数，越大越靠前（按 b/m/k 估计）
  isLatest: boolean;     // 是否包含 latest 标签
  lower: string;         // 全名小写
} {
  try {
    const lower = String(name || '').toLowerCase();
    const [baseRaw, tagRaw] = lower.split(':');
    const base = baseRaw || lower;
    const tag = tagRaw || '';

    // 尝试从 tag 或整体名中解析出规模，如 70b、7b、3.8b、500m、50k 等
    const target = tag || lower;
    const match = target.match(/(\d+(?:\.\d+)?)([bmk])\b/); // 仅识别 b/m/k
    let sizeScore = 0;
    if (match) {
      const num = parseFloat(match[1]);
      const unit = match[2];
      const mul = unit === 'b' ? 1_000_000_000 : unit === 'm' ? 1_000_000 : 1_000; // b>m>k
      sizeScore = isFinite(num) ? num * mul : 0;
    }

    const isLatest = /\blatest\b/.test(target);
    // 若 latest 且未解析出数值，给一个温和的权重，确保不至于排在最末
    if (isLatest && sizeScore === 0) sizeScore = 500_000; // 介于 k 与 m 之间，经验值

    return { base, sizeScore, isLatest, lower };
  } catch {
    return { base: String(name || ''), sizeScore: 0, isLatest: false, lower: String(name || '').toLowerCase() };
  }
}

/**
 * 负责按需拉取模型列表，带 TTL 与错误降级。
 */
export class ProviderModelService {
  private inflight = new Map<string, Promise<void>>();

  /**
   * 拉取并写入该 provider 的模型列表。
   * 语义约定：
   * - 若策略实现了 fetchModels 且返回数组：该数组即为“权威列表”（允许为空），直接覆盖保存；
   * - 若 fetchModels 返回 null：视为暂不支持/失败，回退到“现有缓存 ∪ 静态模型”的并集；
   * - 排序与去重由本服务统一完成，策略无需关心；
   * - 保存后通过事件总线通知订阅者（provider 模型变化）。
   */
  async fetchIfNeeded(name: string, ttl: number = DEFAULT_TTL): Promise<void> {
    if (this.inflight.has(name)) return this.inflight.get(name)!;
    const p = this._fetchImpl(name, ttl).finally(() => this.inflight.delete(name));
    this.inflight.set(name, p);
    return p;
  }

  private async _fetchImpl(name: string, ttl: number): Promise<void> {
    // 0) 若存在“用户覆盖/调试规则”或“内置规则（纳入版本控制）”，优先按规则拉取
    try {
      const userRule = await specializedStorage.models.getProviderFetchDebugRule(name);
      // 允许以显示名称或唯一ID作为键；按精确与不区分大小写回退匹配
      const providers = await providerRepository.getAll();
      const target = providers.find((p) => p.name === name);
      const candidateKeys: string[] = [];
      if (name) candidateKeys.push(name);
      // 若存在 provider 唯一ID（假设字段为 id），加入候选
      const targetId = (target as any)?.id;
      if (targetId) candidateKeys.push(String(targetId));
      // 大小写不敏感回退键
      const insensitiveKeys = candidateKeys.map(k => k.toLowerCase());

      let builtInRule: ModelFetchRule | undefined = undefined;
      for (const key of candidateKeys) {
        if (MODEL_FETCH_RULES[key] !== undefined) { builtInRule = MODEL_FETCH_RULES[key]; break; }
      }
      if (!builtInRule) {
        // 回退到不区分大小写匹配
        const mapLower = new Map<string, ModelFetchRule>();
        for (const [k, v] of Object.entries(MODEL_FETCH_RULES)) {
          mapLower.set(k.toLowerCase(), v);
        }
        for (const low of insensitiveKeys) {
          if (mapLower.has(low)) { builtInRule = mapLower.get(low); break; }
        }
      }

      const rule = userRule || builtInRule;
      if (rule) {
        const base0 = (target?.url?.trim() || '').replace(/\/$/, '');
        const base = rule.useV1 && !/\/v1\b/.test(base0) ? `${base0}/v1` : base0;
        const url = base + (rule.endpointSuffix || '/models');
        const headers: Record<string, string> = {};
        if (target?.requiresKey) {
          try { const { KeyManager } = await import('@/lib/llm/KeyManager'); const k = await KeyManager.getProviderKey(name); if (k) headers['Authorization'] = `Bearer ${k}`; } catch {}
        }
        let onlineList: any[] = [];
        let ruleSuccess = false;
        try {
          const res: any = await tauriFetch(url, { method: 'GET', headers });
          const pickByPath = (obj: any, path?: string) => {
            if (!path) return undefined;
            return path.split('.').reduce((acc: any, key: string) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
          };
          const arr: any[] = Array.isArray(pickByPath(res, rule.modelsArrayPath || 'data')) ? pickByPath(res, rule.modelsArrayPath || 'data') : (Array.isArray(res) ? res : []);
          const toTitleFromId = (s: string) => {
            if (!s) return s as any;
            let spaced = s.replace(/([a-z])([A-Z])/g, '$1 $2');
            spaced = spaced.replace(/[_\-:.\/]+/g, ' ');
            spaced = spaced.replace(/\s+/g, ' ').trim();
            return spaced.split(' ').map(w => w ? (w[0].toUpperCase() + w.slice(1)) : w).join(' ');
          };
          onlineList = arr.map((it) => {
            const id = (pickByPath(it, rule.idPath || 'id') ?? it?.id ?? it?.model ?? it?.name);
            let label = (pickByPath(it, rule.labelPath || '') ?? it?.label ?? it?.name);
            if ((label === undefined || label === null || String(label).trim() === '') && rule.autoLabelFromId) {
              label = toTitleFromId(String(id));
            }
            if (label === undefined || label === null || String(label).trim() === '') {
              label = String(id);
            }
            return { name: String(id), label: String(label), aliases: [String(id)] };
          }).filter((m) => m.name);
          ruleSuccess = true;
          // 将结果写入调试结果文件
          try { await specializedStorage.models.setProviderFetchDebugResult(name, onlineList.map(m=>({ name: m.name, label: m.label })) ); } catch {}
        } catch (e) {
          // 规则拉取失败则继续走常规逻辑
          console.warn('[ProviderModelService] 调试规则拉取失败，回退常规逻辑', e);
          try {
            const cached = await specializedStorage.models.getProviderFetchDebugResult(name);
            if (cached && Array.isArray(cached)) {
              onlineList = cached.map((m:any)=>({ name: m.name, label: m.label, aliases: [m.name] }));
              ruleSuccess = true;
            }
          } catch {}
        }
        if (ruleSuccess) {
          // 规则存在即认为其为权威来源（允许空数组）
          await modelRepository.save(name, onlineList as any, ttl);
          await defaultCacheManager.set(EVENTS.providerModels(name), true);
          return;
        }
      }
    } catch {}

    // 1) 在线拉取（若策略支持），优先使用网络结果
    //    目前 OllamaProvider 实现了 fetchModels，会访问 /api/tags。
    let online: Array<{ name: string; label?: string; aliases?: string[] }> | null = null;
    try {
      const strategy: any = ProviderRegistry.get(name);
      if (strategy && typeof strategy.fetchModels === 'function') {
        // 确保使用最新的 URL（例如 Ollama 可能由设置页更新）
        const providers = await providerRepository.getAll();
        const target = providers.find((p) => p.name === name);
        const effectiveUrl = target?.url?.trim() || (name === 'Ollama' ? 'http://localhost:11434' : '');
        if (strategy.baseUrl !== effectiveUrl) {
          strategy.baseUrl = effectiveUrl;
        }
        online = await strategy.fetchModels();
      }
    } catch (e) {
      // 忽略在线拉取失败，降级到本地静态与已存在的合并
      console.warn(`[ProviderModelService] 在线拉取 ${name} 模型失败，使用降级策略`, e);
    }

    // 2) 生成权威列表（authoritative）：
    //    - 若在线结果存在（即使为空数组），则使用在线结果作为唯一来源（解决 A→B 换地址后旧模型残留的问题）
    //    - 若在线结果为 null（网络/实现缺失），则回退：existing ∪ static
    const staticList = getStaticModels(name) || [];
    const existing = (await modelRepository.get(name)) || [];

    const byName = new Map<string, { provider: string; name: string; label?: string; aliases: string[] }>();

    if (Array.isArray(online)) {
      // 在线结果为权威来源：仅以在线结果构建列表
      for (const m of online) {
        const key = m.name;
        byName.set(key, { provider: name, name: key, label: m.label, aliases: m.aliases || [key] });
      }
    } else {
      // 在线失败：使用现有缓存与静态模型的并集，避免界面空白
      for (const m of existing) byName.set(m.name, m);
      for (const s of staticList) {
        if (!byName.has(s.id)) byName.set(s.id, { provider: name, name: s.id, label: s.label, aliases: [s.id] });
      }
    }

    let merged = Array.from(byName.values());
    // ---- 稳健排序：
    // 1) 同 baseName 按规模分数降序，再按是否 latest（latest 次于更大规模），再按完整小写名升序
    // 2) 不同 baseName 按 baseName 升序
    try {
      const keyCache = new Map<string, ReturnType<typeof parseModelNameForSort>>();
      const getKey = (n: string) => {
        if (!keyCache.has(n)) keyCache.set(n, parseModelNameForSort(n));
        return keyCache.get(n)!;
      };
      merged = merged.sort((a, b) => {
        const ka = getKey(a.name);
        const kb = getKey(b.name);
        if (ka.base !== kb.base) return ka.base.localeCompare(kb.base);
        if (ka.sizeScore !== kb.sizeScore) return kb.sizeScore - ka.sizeScore; // 大优先
        if (ka.isLatest !== kb.isLatest) return Number(kb.isLatest) - Number(ka.isLatest); // latest 次序
        return ka.lower.localeCompare(kb.lower);
      });
    } catch {
      // 排序异常则保持合并后的原始顺序，避免影响功能
    }
    await modelRepository.save(name, merged, ttl);
    await defaultCacheManager.set(EVENTS.providerModels(name), true);
  }
}

export const providerModelService = new ProviderModelService();


