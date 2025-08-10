"use client";

import Image from "next/image";
import { Check, Sparkles, Settings } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ProviderMetadata, ModelMetadata } from '@/lib/metadata/types';

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

  return (
    <div className={cn(
      "flex items-center gap-3 p-2.5 rounded-lg transition-colors cursor-pointer",
      isSelected ? "bg-blue-100 dark:bg-blue-600/40" : "hover:bg-gray-100 dark:hover:bg-gray-700/50"
    )}>
      {isImgSrc(provider.icon) ? (
        <Image
          src={provider.icon}
          alt={`${provider.name}`}
          width={20}
          height={20}
          className="w-5 h-5 flex-shrink-0 rounded-sm"
        />
      ) : (
        <div className="w-5 h-5 flex-shrink-0 bg-gray-200 dark:bg-gray-600/60 rounded-sm flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-gray-500 dark:text-gray-300" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate text-gray-700 dark:text-gray-200">
          {model.label || model.name}
        </p>
      </div>

      <div className="flex items-center gap-1" />
    </div>
  );
} 