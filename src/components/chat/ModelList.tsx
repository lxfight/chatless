"use client";

import { SelectItem, SelectLabel, SelectGroup } from "@/components/ui/select";
import { ChevronRight } from "lucide-react";
import { ModelSelectItem } from "./ModelSelectItem";
import { Bot, Search } from "lucide-react";
import type { ProviderMetadata } from '@/lib/metadata/types';
import { useState } from "react";
import { cn } from "@/lib/utils";

interface ModelListProps {
  models: ProviderMetadata[];
  globalDefaultModel: string | null;
  currentModelId: string | null;
  searchQuery: string;
  onSetDefault: (e: React.MouseEvent, providerName: string, modelName: string) => void;
  onOpenParameters?: (providerName: string, modelId: string, modelLabel?: string) => void;
}

export function ModelList({
  models,
  globalDefaultModel,
  currentModelId,
  searchQuery,
  onSetDefault,
  onOpenParameters,
}: ModelListProps) {
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (currentModelId) {
      const provider = models.find(p => p.models.some(m => m.name === currentModelId));
      if (provider) initial.add(provider.name);
    }
    return initial;
  });

  const toggleProvider = (name: string) => {
    setExpandedProviders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(name)) newSet.delete(name); else newSet.add(name);
      return newSet;
    });
  };

  if (models.length === 0) {
    return (
      <div className="py-6 text-center text-gray-500 dark:text-gray-400">
        {searchQuery ? (
          <>
            <Search className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">未找到匹配的模型</p>
          </>
        ) : (
          <>
            <Bot className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">无可用模型数据</p>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      {models.map((provider) => {
        const expanded = expandedProviders.has(provider.name);
        return (
          <SelectGroup key={provider.name}>
            <div
              className="flex items-center justify-between px-2.5 py-1.5 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
              onClick={() => toggleProvider(provider.name)}
            >
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                {provider.name}
              </span>
              <ChevronRight className={cn("w-3 h-3 transition-transform", expanded && "rotate-90")}/>
            </div>
            {expanded && provider.models.map((model) => (
              <SelectItem key={model.name} value={model.name} className="p-0 focus:bg-transparent">
                <ModelSelectItem
                  provider={provider}
                  model={model}
                  isDefault={globalDefaultModel === `${provider.name}/${model.name}`}
                  isSelected={currentModelId === model.name}
                  onSetDefault={onSetDefault}
                  onOpenParameters={onOpenParameters}
                />
              </SelectItem>
            ))}
          </SelectGroup>
        );
      })}
    </>
  );
} 