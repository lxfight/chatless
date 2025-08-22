"use client";

import Image from "next/image";
import { useMemo, useState } from 'react';
import { Check, Sparkles, Settings } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ProviderMetadata, ModelMetadata } from '@/lib/metadata/types';
import { PROVIDER_ICON_EXTS, getModelBrandLogoSrc, getResolvedUrlForBase, isUrlKnownMissing, markUrlMissing } from '@/lib/utils/logoService';
import { ModelBrandLogo } from './ModelBrandLogo';
import { generateAvatarDataUrl } from '@/lib/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ModelSelectItemProps {
  provider: ProviderMetadata;
  model: ModelMetadata;
  isDefault: boolean;
  isSelected: boolean;
  onSetDefault: (e: React.MouseEvent, providerName: string, modelName: string) => void;
  onOpenParameters?: (providerName: string, modelId: string, modelLabel?: string) => void;
}

const isImgSrc = (icon?: string): icon is string => {
  return Boolean(icon && typeof icon === 'string' && (icon.startsWith('/') || icon.startsWith('data:image')));
};

export function ModelSelectItem({
  provider,
  model,
  isDefault,
  isSelected,
  onSetDefault,
  onOpenParameters
}: ModelSelectItemProps) {
  const handleSettingsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenParameters?.(provider.name, model.name, model.label);
  };

  // 统一回退链：模型品牌 → Provider 目录图标 → 自定义 data:avatar
  const iconExts = PROVIDER_ICON_EXTS;

  // 1) 模型品牌 logo 基址（门面统一处理规则）
  const modelLogoBase = useMemo(() => {
    const src = getModelBrandLogoSrc(model.name, provider.name);
    if (!src) return '';
    const m = src.match(/^(.*)\.(svg|png|webp|jpeg|jpg)$/i);
    return m ? m[1] : src;
  }, [model.name, provider.name]);
  const [modelExtIdx, setModelExtIdx] = useState(0);
  const modelLogoSrc = `${modelLogoBase}.${iconExts[Math.min(modelExtIdx, iconExts.length - 1)]}`;

  // 2) Provider 图标（目录/自定义）
  const providerIsCatalog = typeof provider.icon === 'string' && provider.icon.startsWith('/llm-provider-icon/');
  const providerBase = providerIsCatalog ? (provider.icon as string).replace(/\.(svg|png|webp|jpeg|jpg)$/i, '') : provider.icon;
  const [providerExtIdx, setProviderExtIdx] = useState(0);
  const providerCatalogSrc = providerIsCatalog ? (() => {
    const mapped = getResolvedUrlForBase(providerBase as string);
    if (mapped) return mapped;
    let idx = providerExtIdx;
    while (idx < iconExts.length && isUrlKnownMissing(`${providerBase}.${iconExts[idx]}`)) idx++;
    return `${providerBase}.${iconExts[Math.min(idx, iconExts.length - 1)]}`;
  })() : provider.icon;
  const providerAvatarSrc = !providerIsCatalog && typeof provider.icon === 'string' && provider.icon.startsWith('data:image')
    ? (provider.icon)
    : generateAvatarDataUrl(provider.name.toLowerCase(), provider.name, 20);

  // 渲染用状态：先尝试模型 logo，失败后切换到 provider 目录图标，再失败回退到 avatar
  const [useProviderIcon, setUseProviderIcon] = useState(false);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn(
          "flex items-center gap-3 p-2.5 rounded-lg transition-colors cursor-pointer",
          isSelected ? "bg-blue-100 dark:bg-blue-600/40" : "hover:bg-gray-100 dark:hover:bg-gray-700/50"
        )}>
      {(!useProviderIcon) ? (
        <div className="w-5 h-5 bg-gray-100 dark:bg-gray-200 rounded-sm">
        <ModelBrandLogo
          modelId={model.name}
          providerName={provider.name}
          size={20}
          fallbackSrc={providerIsCatalog ? (providerCatalogSrc as string) : providerAvatarSrc}
          className="w-5 h-5 flex-shrink-0 rounded-sm"
          alt={model.name}
        />
        </div>
      ) : (
        isImgSrc(providerCatalogSrc) ? (
          <div className="w-5 h-5 dark:bg-gray-100 rounded-sm">
            <Image
              src={providerCatalogSrc}
              alt={`${provider.name}`}
              width={20}
              height={20}
              className="w-5 h-5 flex-shrink-0 rounded-sm"
              onError={() => {
                if (providerIsCatalog) {
                  markUrlMissing(providerCatalogSrc);
                  if (providerExtIdx < iconExts.length - 1) {
                    setProviderExtIdx((i) => i + 1);
                  } else {
                    setUseProviderIcon(true);
                  }
                } else {
                  setUseProviderIcon(true);
                }
              }}
            />
          </div>
        ) : (
          <div className="w-5 h-5 dark:bg-gray-100 rounded-sm">
          <Image
            src={providerAvatarSrc}
            alt={`${provider.name}`}
            width={20}
            height={20}
            className="w-5 h-5 flex-shrink-0 rounded-sm"
          />
          </div>
        )
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate text-gray-700 dark:text-gray-200">
          {model.label || model.name}
        </p>
      </div>

      <div className="flex items-center gap-1" />
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={6} avoidCollisions={false} className="max-w-[520px] break-words text-xs">
        <div className="space-y-1">
          <div><span className="text-gray-400 mr-1">ID:</span>{model.name}</div>
          <div className="text-gray-400">{provider.name}</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
} 