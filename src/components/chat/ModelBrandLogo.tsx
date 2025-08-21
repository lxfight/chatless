"use client";

import React from 'react';
import { PROVIDER_ICON_EXTS, getModelBrandLogoSrc, getResolvedUrlForBase, isUrlKnownMissing, ensureLogoCacheReady, markResolvedBase, markUrlMissing } from '@/lib/utils/logoService';

interface Props {
  modelId: string;
  providerName: string;
  size?: number;
  // UI 首帧的兜底（避免闪动）：比如 provider 目录图标或 avatar dataURL
  fallbackSrc: string;
  className?: string;
  alt?: string;
}

export function ModelBrandLogo({ modelId, providerName, size = 18, fallbackSrc, className, alt }: Props) {
  const initial = React.useMemo(() => getModelBrandLogoSrc(modelId, providerName) || '', [modelId, providerName]);
  const base = React.useMemo(() => {
    if (!initial) return '';
    const m = initial.match(/^(.*)\.(svg|png|webp|jpeg|jpg)$/i);
    return m ? m[1] : initial;
  }, [initial]);
  const mapped = React.useMemo(() => (base ? getResolvedUrlForBase(base) : null), [base]);
  // 优先用 initial（若已是具体 url）或命中映射，否则 fallback，避免首帧用错 provider 头像
  const [src, setSrc] = React.useState<string>(initial || mapped || fallbackSrc);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!base) return;
      await ensureLogoCacheReady();
      // ensureLogoCacheReady 可能刚合入新的 _index.json，从而使 base 的映射即时可用
      // 已有命中，则直接使用
      const hit = getResolvedUrlForBase(base);
      if (hit) { if (!cancelled) setSrc(hit); return; }
      const candidates = PROVIDER_ICON_EXTS
        .map((ext) => `${base}.${ext}`)
        .filter((u) => !isUrlKnownMissing(u));
      for (const url of candidates) {
        const ok = await new Promise<boolean>((resolve) => {
          const img = new window.Image();
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
          img.src = url;
        });
        if (ok) {
          markResolvedBase(base, url);
          if (!cancelled) setSrc(url);
          return;
        } else {
          markUrlMissing(url);
        }
      }
      // 候选均失败时，回退到提供的 fallbackSrc
      if (!cancelled && fallbackSrc) setSrc(fallbackSrc);
    })();
    return () => { cancelled = true; };
  }, [base]);

  // 当仅 fallbackSrc 变化时（base 未变或为空），确保回退资源也能更新
  React.useEffect(() => {
    if (!base && fallbackSrc) setSrc(fallbackSrc);
  }, [fallbackSrc, base]);

  return (
    <img
      src={src}
      alt={alt || modelId}
      width={size}
      height={size}
      className={className}
      onError={() => {
        try { if (src) markUrlMissing(src); } catch {}
        if (fallbackSrc && src !== fallbackSrc) setSrc(fallbackSrc);
      }}
    />
  );
}

