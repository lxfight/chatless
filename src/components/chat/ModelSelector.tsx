"use client";

import { useEffect, useState, useRef, useMemo } from 'react';
import { Select, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, Check } from 'lucide-react';
import type { ProviderMetadata, ModelMetadata } from '@/lib/metadata/types';
import { metadataService } from '@/lib/metadata/MetadataService';
import { specializedStorage } from '@/lib/storage';
import Image from "next/image";
import { ModelBrandLogo } from './ModelBrandLogo';
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import { ModelSelectContent } from './ModelSelectContent';
import { ModelParametersDialog } from './ModelParametersDialog';
import { PROVIDER_ICON_EXTS, getResolvedUrlForBase, isUrlKnownMissing, getModelBrandLogoSrc, prewarmModelBrandLogos, markUrlMissing } from '@/lib/utils/logoService';
import { generateAvatarDataUrl } from '@/lib/avatar';

interface ModelSelectorProps {
  currentModelId: string | null;
  allMetadata: ProviderMetadata[];
  onModelChange: (newModelId: string) => void;
  disabled?: boolean;
  currentProviderName?: string;
}

export function ModelSelector({ 
  currentModelId, 
  allMetadata,
  onModelChange, 
  disabled = false,
  currentProviderName
}: ModelSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [recentModels, setRecentModels] = useState<Array<{provider: string; modelId: string}>>([]);
  const [globalDefaultModel, setGlobalDefaultModel] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // 模型参数设置弹窗状态
  const [parametersDialogOpen, setParametersDialogOpen] = useState(false);
  const [selectedModelForParams, setSelectedModelForParams] = useState<{
    providerName: string;
    modelId: string;
    modelLabel?: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const pair = await specializedStorage.models.getLastSelectedModelPair();
      setGlobalDefaultModel(pair ? `${pair.provider}/${pair.modelId}` : null);
    })();
  }, []);

  useEffect(() => {
    const loadRecentModels = async () => {
      try {
        const { specializedStorage } = await import('@/lib/storage');
        const recent = await specializedStorage.models.getRecentModels();
        setRecentModels(recent || []);
      } catch (error) {
        console.error('加载最近使用模型失败:', error);
        setRecentModels([]);
      }
    };
    
    loadRecentModels();
  }, []);

  const updateRecentModels = async (providerName: string, modelId: string) => {
    try {
      const newPair = { provider: providerName, modelId };
      const newRecent = [newPair, ...recentModels.filter(p => !(p.provider === providerName && p.modelId === modelId))].slice(0, 3);
      setRecentModels(newRecent);
      
      const { specializedStorage } = await import('@/lib/storage');
      await specializedStorage.models.setRecentModels(newRecent);
    } catch (error) {
      console.error('更新最近使用模型失败:', error);
    }
  };

  const handleInternalModelChange = (value: string) => {
    let providerName: string | undefined;
    let modelId: string = value;
    if (value.includes('::')) {
      const parts = value.split('::');
      if (parts.length === 2) {
        providerName = parts[0];
        modelId = parts[1];
      }
    }

    // 更新最近使用列表（记录 provider+model）
    if (providerName) updateRecentModels(providerName, modelId);

    if (providerName) {
      (async () => {
        try {
          const { specializedStorage } = await import('@/lib/storage');
          await specializedStorage.models.setLastSelectedModelPair(providerName, modelId);
        } catch (_) {}
      })();
      onModelChange(`${providerName}::${modelId}`);
    } else {
      onModelChange(modelId);
    }
  };

  const isImgSrc = (icon?: string): icon is string => {
    return Boolean(icon && typeof icon === 'string' && (icon.startsWith('/') || icon.startsWith('data:image')));
  };

  const currentProvider = useMemo(() => {
    if (!allMetadata || allMetadata.length === 0 || !currentModelId) return null;
    // 优先：使用外部传入的 providerName 进行精确匹配
    if (currentProviderName) {
      const byName = allMetadata.find(p => p.name === currentProviderName);
      if (byName && byName.models.some(m => m.name === currentModelId)) return byName;
    }
    // 兜底：如果传入的 providerName 缺失或不匹配（例如应用重启后恢复阶段），
    // 则根据“最近选择的 pair”去定位，避免跨 provider 同名模型误配
    // 注意：此兜底只在渲染时做一次同步判断，不写入存储
    const pair = metadataService ? null : null; // no-op 占位，避免 tree-shaking 误删导入
    const byScan = allMetadata.find(p => p.models.some(m => m.name === currentModelId)) || null;
    return byScan;
  }, [allMetadata, currentModelId, currentProviderName]);

  // 统一：只显示 isVisible !== false 的提供商，防御上游漏过滤
  const visibleProviders = useMemo(() => allMetadata.filter((p: any)=>p?.isVisible !== false), [allMetadata]);

  const filteredModels = useMemo(() => {
    const query = searchQuery.toLowerCase();
    if (!query) return visibleProviders;

    return visibleProviders.map(provider => ({
      ...provider,
      models: provider.models.filter(modelMeta =>
        modelMeta.name.toLowerCase().includes(query) ||
        provider.name.toLowerCase().includes(query)
      )
    })).filter(provider => provider.models.length > 0);
  }, [visibleProviders, searchQuery]);

  const recentModelDetails = useMemo(() => {
    const result: { provider: ProviderMetadata, model: ModelMetadata }[] = [];
    if (!visibleProviders) return result;
    recentModels.forEach(({ provider, modelId }) => {
      const p = visibleProviders.find(v => v.name === provider);
      const m = p?.models.find(mm => mm.name === modelId);
      if (p && m) result.push({ provider: p, model: m });
    });
    return result;
  }, [visibleProviders, recentModels]);

  // —— 选择器触发器上的图标显示（模型优先 → provider → 头像） ——
  const iconExts = PROVIDER_ICON_EXTS;
  const currentModel = useMemo(() => {
    if (!currentProvider || !currentModelId) return null;
    return currentProvider.models.find(m => m.name === currentModelId) || null;
  }, [currentProvider, currentModelId]);

  const modelLogoBase = useMemo(() => {
    if (!currentProvider || !currentModelId) return '';
    const src = getModelBrandLogoSrc(currentModelId, currentProvider.name);
    if (!src) return '';
    const m = src.match(/^(.*)\.(svg|png|webp|jpeg|jpg)$/i);
    return m ? m[1] : src;
  }, [currentProvider, currentModelId]);
  const [modelExtIdx, setModelExtIdx] = useState(0);
  const modelLogoSrc = modelLogoBase ? `${modelLogoBase}.${iconExts[Math.min(modelExtIdx, iconExts.length - 1)]}` : '';

  const providerIsCatalog = typeof currentProvider?.icon === 'string' && currentProvider.icon.startsWith('/llm-provider-icon/');
  const providerBase = providerIsCatalog ? (currentProvider?.icon as string).replace(/\.(svg|png|webp|jpeg|jpg)$/i, '') : (currentProvider?.icon || '');
  const [providerExtIdx, setProviderExtIdx] = useState(0);
  const providerCatalogSrc = providerIsCatalog ? (() => {
    const mapped = getResolvedUrlForBase(providerBase);
    if (mapped) return mapped;
    let idx = providerExtIdx;
    while (idx < iconExts.length && isUrlKnownMissing(`${providerBase}.${iconExts[idx]}`)) idx++;
    return `${providerBase}.${iconExts[Math.min(idx, iconExts.length - 1)]}`;
  })() : (currentProvider?.icon || '');
  const providerAvatarSrc = !providerIsCatalog && typeof currentProvider?.icon === 'string' && currentProvider.icon.startsWith('data:image')
    ? (currentProvider.icon)
    : generateAvatarDataUrl((currentProvider?.name || 'prov').toLowerCase(), currentProvider?.name || 'Provider', 20);
  const [useProviderIcon, setUseProviderIcon] = useState(false);

  const handleOpenChange = (open: boolean) => {
    if (open) {
      setTimeout(() => {
        // We now need to focus the input inside the content component.
        // This ref is just a placeholder now. The logic is passed down.
      }, 100);
      // 后台预热当前可见 provider 的品牌 logo（非阻塞）
      try {
        const modelsToWarm: Array<{ modelId: string; providerName?: string }> = [];
        filteredModels.forEach(p => p.models.forEach(m => modelsToWarm.push({ modelId: m.name, providerName: p.name })));
        // 仅预热前 50 个，避免大列表一次性预热过多
        prewarmModelBrandLogos(modelsToWarm, 8, { limit: 50 }).catch(()=>{});
      } catch {}
    } else {
      setSearchQuery('');
    }
  };

  const handleSetDefault = async (e: React.MouseEvent, providerName: string, modelName: string) => {
    e.stopPropagation();
    e.preventDefault();
    const newDefaultIdentifier = `${providerName}/${modelName}`;
    if (globalDefaultModel === newDefaultIdentifier) {
      await specializedStorage.models.removeLastSelectedModelPair?.();
      setGlobalDefaultModel(null);
      toast.info("默认模型已清除");
    } else {
      await specializedStorage.models.setLastSelectedModelPair(providerName, modelName);
      setGlobalDefaultModel(newDefaultIdentifier);
      toast.success(`${modelName} 已设为默认模型`);
    }
  };

  // 手动刷新模型列表
  const handleRefreshModels = async () => {
    try {
      const { useProviderMetaStore } = await import('@/store/providerMetaStore');
      const merged = metadataService.get();
      useProviderMetaStore.getState().setList(merged as any);
      toast.success('模型列表已刷新');
    } catch (e) {
      console.error('刷新模型列表失败', e);
      toast.error('刷新模型列表失败');
    }
  };

  // 处理打开模型参数设置弹窗
  const handleOpenParameters = (providerName: string, modelId: string, modelLabel?: string) => {
    setSelectedModelForParams({ providerName, modelId, modelLabel });
    setParametersDialogOpen(true);
  };

  const getCurrentModelDisplayText = () => {
    if (!currentModelId || !currentProvider) return "选择模型";
    const model = currentProvider.models.find(m => m.name === currentModelId);
    const providerLabel = (currentProvider as any).displayName || currentProvider.name;
    const text = model?.label || currentModelId;
    const maxLength = 16;
    const modelText = text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
    return `${modelText} (${providerLabel})`;
  };

  const SENTINEL_VALUE = '__none__';
  const pairSelection = useMemo(() => {
    if (currentProvider && currentModelId) return `${currentProvider.name}::${currentModelId}`;
    return null;
  }, [currentProvider, currentModelId]);

  const selectValue = searchQuery
    ? SENTINEL_VALUE
    : (pairSelection || currentModelId || '');

  return (
    <>
      <Select
        value={selectValue}
        onValueChange={handleInternalModelChange}
        disabled={disabled}
        onOpenChange={handleOpenChange}
      >
        <SelectTrigger className="h-8 px-2 bg-transparent border-0 rounded-md text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:ring-0">
          <span className="inline-flex items-center gap-2">
            {currentProvider && currentModelId ? (
              !useProviderIcon ? (
                <div className="w-5 h-5 bg-gray-100 dark:bg-gray-200 rounded-sm">
                <ModelBrandLogo
                  modelId={currentModelId}
                  providerName={currentProvider.name}
                  size={18}
                  fallbackSrc={providerCatalogSrc || providerAvatarSrc}
                  className="w-5 h-5 rounded-sm"
                />
                </div>
              ) : (
                isImgSrc(providerCatalogSrc) ? (
                  <div className="w-5 h-5 bg-gray-100 dark:bg-gray-200 rounded-sm">
                  <Image
                    src={providerCatalogSrc}
                    alt={currentProvider.name}
                    width={18}
                    height={18}
                    className="w-5 h-5 rounded-sm"
                    onError={() => {
                      if (providerIsCatalog && providerExtIdx < iconExts.length - 1) {
                        setProviderExtIdx(i => i + 1);
                      }
                    }}
                  />
                  </div>
                ) : (
                  <div className="w-5 h-5 bg-gray-100 dark:bg-gray-200 rounded-sm">
                  <Image
                    src={providerAvatarSrc}
                    alt={currentProvider.name}
                    width={18}
                    height={18}
                    className="w-5 h-5 rounded-sm"
                  />
                  </div>
                )
              )
            ) : null}
            <span>
              {currentModelId
                ? currentProvider
                  ? `${(currentProvider.models.find(m=>m.name===currentModelId)?.label) || currentModelId} (${((currentProvider as any).displayName || currentProvider.name)})`
                  : currentModelId
                : allMetadata.length === 0
                  ? '加载模型中...'
                  : '选择模型'}
            </span>
          </span>
        </SelectTrigger>
        
        <ModelSelectContent
          filteredModels={filteredModels}
          recentModelDetails={recentModelDetails}
          globalDefaultModel={globalDefaultModel}
          currentModelId={currentModelId}
          currentSelection={pairSelection}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onSetDefault={handleSetDefault}
          onRefresh={handleRefreshModels}
          onOpenChange={handleOpenChange}
          onOpenParameters={handleOpenParameters}
        />
      </Select>

      {/* 模型参数设置弹窗 */}
      {selectedModelForParams && (
        <ModelParametersDialog
          open={parametersDialogOpen}
          onOpenChange={setParametersDialogOpen}
          providerName={selectedModelForParams.providerName}
          modelId={selectedModelForParams.modelId}
          modelLabel={selectedModelForParams.modelLabel}
        />
      )}
    </>
  );
} 