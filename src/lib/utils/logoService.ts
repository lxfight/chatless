/**
 * 统一 Logo/头像服务门面
 * - 组件层只依赖这里的 API，不关心后缀轮换/命中映射/持久化/并发预热等细节
 * - 保证首帧稳定：头像走 dataURL 同步返回；目录 Logo 走命中映射优先
 * - 失败/命中会持久化，避免重复 404；提供批量预热能力提升首屏命中率
 */
export { getAvatarSync, ensureAvatarInMemory, prewarmAvatars } from './avatarCache';
export {
  preloadInitialLogos,
  preloadProviderAndModelLogos,
  preloadUrls,
  ensureLogoCacheReady,
  getResolvedUrlForBase,
  isUrlKnownMissing,
  markResolvedBase,
  markUrlMissing,
  getKnownIconBasesSync,
} from './logoPreloader';

// 统一的扩展名与目录（由预加载模块实际使用）；暴露给上层仅做候选构造时使用
export const PROVIDER_ICON_EXTS = ['png', 'svg', 'webp', 'jpeg', 'jpg'] as const;
export const PROVIDER_ICON_BASE = (id: string) => `/llm-provider-icon/${id}`;

// —— 模型品牌 Logo 统一入口 ——
import { getModelLogoAsset } from '@/lib/provider/staticModels';
import { getResolvedUrlForBase, isUrlKnownMissing, getKnownIconBasesSync } from './logoPreloader';

/**
 * 依据模型ID和Provider名称返回“品牌logo”的可用 src。
 * 策略：
 *  - 从静态规则得到候选 key → 组合为 /llm-provider-icon/{key}.{ext}
 *  - 命中映射优先；否则过滤缺失后缀顺序探测
 *  - 命中/缺失会写回缓存，提升后续命中率
 */
export function getModelBrandLogoSrc(modelId: string, providerName?: string): string | null {
  // 1) 尝试基于 _index.json 导入的已知基名做“包含匹配（忽略大小写）”
  const lower = (modelId || '').toLowerCase();
  if (lower) {
    const bases = getKnownIconBasesSync();
    let best: { base: string; idx: number } | null = null;
    for (const base of bases) {
      const idx = lower.indexOf(base.toLowerCase());
      if (idx >= 0 && (best == null || idx < best.idx)) {
        best = { base, idx };
      }
    }
    if (best) {
      const basePath = `/llm-provider-icon/${best.base}`;
      const mapped = getResolvedUrlForBase(basePath);
      if (mapped) return mapped;
      for (const ext of PROVIDER_ICON_EXTS) {
        const url = `${basePath}.${ext}`;
        if (!isUrlKnownMissing(url)) return url;
      }
    }
  }

  // 2) 回退到静态规则
  const asset = getModelLogoAsset(modelId, { providerName });
  const m = asset.src.match(/^(.*)\.(svg|png|webp|jpeg|jpg)$/i);
  const base = m ? m[1] : asset.src.replace(/\.(svg|png|webp|jpeg|jpg)$/i, '');
  const mapped = getResolvedUrlForBase(base);
  if (mapped) return mapped;
  for (const ext of PROVIDER_ICON_EXTS) {
    const url = `${base}.${ext}`;
    if (!isUrlKnownMissing(url)) return url;
  }
  return null;
}

/** 批量预热模型品牌 logo。非阻塞，内部去重与并发控制 */
export async function prewarmModelBrandLogos(
  models: Array<{ modelId: string; providerName?: string }>,
  maxConcurrency: number = 8,
  options?: { limit?: number; skipKnownMissing?: boolean }
) {
  const urls: string[] = [];
  const baseSet = new Set<string>();
  for (const m of models) {
    const src = getModelBrandLogoSrc(m.modelId, m.providerName);
    if (!src) continue;
    const base = src.replace(/\.(svg|png|webp|jpeg|jpg)$/i, '');
    if (baseSet.has(base)) continue;
    baseSet.add(base);
    for (const ext of PROVIDER_ICON_EXTS) urls.push(`${base}.${ext}`);
    if (options?.limit && baseSet.size >= options.limit) break;
  }
  const { preloadUrls } = await import('./logoPreloader');
  await preloadUrls(urls, maxConcurrency);
}

