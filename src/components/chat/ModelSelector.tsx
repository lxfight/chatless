"use client";

import { useEffect, useState, useRef, useMemo } from 'react';
import { Select, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, Check } from 'lucide-react';
import type { ProviderMetadata, ModelMetadata } from '@/lib/metadata/types';
import { metadataService } from '@/lib/metadata/MetadataService';
import { specializedStorage } from '@/lib/storage';
import Image from "next/image";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ModelSelectContent } from './ModelSelectContent';
import { ModelParametersDialog } from './ModelParametersDialog';

interface ModelSelectorProps {
  currentModelId: string | null;
  allMetadata: ProviderMetadata[];
  onModelChange: (newModelId: string) => void;
  disabled?: boolean;
}

export function ModelSelector({ 
  currentModelId, 
  allMetadata,
  onModelChange, 
  disabled = false
}: ModelSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [recentModels, setRecentModels] = useState<string[]>([]);
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
      const last = await specializedStorage.models.getLastSelectedModel();
      setGlobalDefaultModel(last);
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

  const updateRecentModels = async (modelId: string) => {
    try {
      const newRecent = [modelId, ...recentModels.filter(id => id !== modelId)].slice(0, 3);
      setRecentModels(newRecent);
      
      const { specializedStorage } = await import('@/lib/storage');
      await specializedStorage.models.setRecentModels(newRecent);
    } catch (error) {
      console.error('更新最近使用模型失败:', error);
    }
  };

  const handleInternalModelChange = (value: string) => {
    updateRecentModels(value);
    onModelChange(value);
  };

  const isSvgPath = (icon?: string): icon is string => {
    return Boolean(icon && typeof icon === 'string' && (icon.startsWith('/') || icon.startsWith('data:image')));
  };

  const currentProvider = useMemo(() => {
    if (!allMetadata || allMetadata.length === 0 || !currentModelId) return null;
    for (const provider of allMetadata) {
      const foundModel = provider.models.find(m => m.name === currentModelId);
      if (foundModel) return provider;
    }
    return null;
  }, [allMetadata, currentModelId]);

  const filteredModels = useMemo(() => {
    const query = searchQuery.toLowerCase();
    if (!query) return allMetadata;

    return allMetadata.map(provider => ({
      ...provider,
      models: provider.models.filter(modelMeta =>
        modelMeta.name.toLowerCase().includes(query) ||
        provider.name.toLowerCase().includes(query)
      )
    })).filter(provider => provider.models.length > 0);
  }, [allMetadata, searchQuery]);

  const recentModelDetails = useMemo(() => {
    const result: { provider: ProviderMetadata, model: ModelMetadata }[] = [];
    if (!allMetadata) return result;
    recentModels.forEach(modelName => {
      for (const provider of allMetadata) {
        const foundModel = provider.models.find(m => m.name === modelName);
        if (foundModel) {
          result.push({ provider, model: foundModel });
          break;
        }
      }
    });
    return result;
  }, [allMetadata, recentModels]);

  const handleOpenChange = (open: boolean) => {
    if (open) {
      setTimeout(() => {
        // We now need to focus the input inside the content component.
        // This ref is just a placeholder now. The logic is passed down.
      }, 100);
    } else {
      setSearchQuery('');
    }
  };

  const handleSetDefault = async (e: React.MouseEvent, providerName: string, modelName: string) => {
    e.stopPropagation();
    e.preventDefault();
    const newDefaultIdentifier = `${providerName}/${modelName}`;
    if (globalDefaultModel === newDefaultIdentifier) {
      await specializedStorage.models.setLastSelectedModel('');
      setGlobalDefaultModel(null);
      toast.info("默认模型已清除");
    } else {
      await specializedStorage.models.setLastSelectedModel(newDefaultIdentifier);
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
    const maxLength = 12;
    return currentModelId.length > maxLength
      ? `${currentModelId.substring(0, maxLength)}...`
      : currentModelId;
  };

  const SENTINEL_VALUE = '__none__';
  const selectValue = searchQuery ? SENTINEL_VALUE : (currentModelId || '');

  return (
    <>
      <Select
        value={selectValue}
        onValueChange={handleInternalModelChange}
        disabled={disabled}
        onOpenChange={handleOpenChange}
      >
        <SelectTrigger className="h-8 px-2 bg-transparent border-0 rounded-md text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:ring-0">
          {currentModelId
            ? currentProvider
              ? `${currentModelId} (${currentProvider.name})`
              : currentModelId
            : allMetadata.length === 0
              ? '加载模型中...'
              : '选择模型'}
        </SelectTrigger>
        
        <ModelSelectContent
          filteredModels={filteredModels}
          recentModelDetails={recentModelDetails}
          globalDefaultModel={globalDefaultModel}
          currentModelId={currentModelId}
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