"use client";
import React from "react";
import { AVAILABLE_PROVIDERS_CATALOG } from "@/lib/provider/catalog";
import { getResolvedUrlForBase, isUrlKnownMissing, ensureLogoCacheReady, getAvatarSync, ensureAvatarInMemory } from '@/lib/utils/logoService';
import type { ProviderWithStatus } from '@/hooks/useProviderManagement';

export function useProviderIcon(provider: ProviderWithStatus) {
  const iconStr = typeof provider.icon === 'string' ? provider.icon : '';
  const iconExts = ['png', 'svg', 'webp', 'jpeg', 'jpg'] as const;
  const iconIsData = !!(iconStr && iconStr.startsWith('data:image'));
  const iconIsCatalog = !!(iconStr && iconStr.startsWith('/llm-provider-icon/'));
  const [iconExtIdx, setIconExtIdx] = React.useState(0);
  const [iconError, setIconError] = React.useState(false);

  const nameSlugBase = `/llm-provider-icon/${provider.name.toLowerCase().replace(/\s+/g, '-')}`;
  const catalogDef = AVAILABLE_PROVIDERS_CATALOG.find((c) => c.name === provider.name);
  const catalogIdBase = catalogDef ? `/llm-provider-icon/${catalogDef.id}` : null;
  const iconBaseFromProp = iconIsCatalog ? iconStr.replace(/\.(svg|png|webp|jpeg|jpg)$/i, '') : null;
  const candidateBases = [catalogIdBase, iconBaseFromProp, nameSlugBase].filter(Boolean) as string[];

  React.useEffect(() => { ensureLogoCacheReady().catch(()=>{}); }, []);
  const resolvedIconSrc = React.useMemo(() => {
    if (iconIsData) return iconStr;
    for (const base of candidateBases) {
      const mapped = getResolvedUrlForBase(base);
      if (mapped) return mapped;
    }
    for (const base of candidateBases) {
      for (const ext of iconExts) {
        const url = `${base}.${ext}`;
        if (!isUrlKnownMissing(url)) return url;
      }
    }
    return '';
  }, [iconIsData, iconStr, candidateBases]);

  const [fallbackAvatarSrc, setFallbackAvatarSrc] = React.useState<string>(() => getAvatarSync(provider.name.toLowerCase(), provider.name, 20));
  React.useEffect(() => {
    ensureAvatarInMemory(provider.name.toLowerCase(), provider.name, 20)
      .then((v)=> setFallbackAvatarSrc(v))
      .catch(()=>{});
  }, [provider.name]);

  return {
    resolvedIconSrc,
    fallbackAvatarSrc,
    iconError,
    setIconError,
    iconIsCatalog,
    iconExtIdx,
    setIconExtIdx,
    iconExts,
  } as const;
}

