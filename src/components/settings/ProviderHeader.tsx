"use client";
import React from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Loader2, Wifi } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ProviderWithStatus } from "@/hooks/useProviderManagement";

interface ProviderHeaderProps {
  provider: ProviderWithStatus;
  isOpen: boolean;
  isConnecting: boolean;
  isGloballyInitializing: boolean;
  statusText: string;
  StatusIcon: any;
  badgeVariant: "secondary" | "destructive" | "outline";
  badgeClasses: string;
  resolvedIconSrc: string;
  iconError: boolean;
  iconIsCatalog: boolean;
  iconExtIdx: number;
  iconExts: readonly string[];
  setIconExtIdx: (updater: (n: number) => number) => void;
  setIconError: (v: boolean) => void;
  fallbackAvatarSrc: string;
  onOpenToggle: () => void;
  onRefresh: (provider: ProviderWithStatus) => void;
}

export function ProviderHeader(props: ProviderHeaderProps) {
  const {
    provider,
    isOpen,
    isConnecting,
    isGloballyInitializing,
    statusText,
    StatusIcon,
    badgeVariant,
    badgeClasses,
    resolvedIconSrc,
    iconError,
    iconIsCatalog,
    iconExtIdx,
    iconExts,
    setIconExtIdx,
    setIconError,
    fallbackAvatarSrc,
    onOpenToggle,
    onRefresh,
  } = props;

  return (
    <div className="flex items-center justify-between w-full px-4 py-3 bg-white/80 dark:bg-gray-800/40 backdrop-blur-[2px] hover:bg-indigo-50/70 dark:hover:bg-indigo-900/20 hover:ring-1 hover:ring-indigo-200 dark:hover:ring-indigo-700 transition-all cursor-pointer" onClick={onOpenToggle}>
      <div className="flex items-center gap-2 flex-grow min-w-0 mr-3">
        <div className={cn("flex items-center justify-center w-8 h-8 rounded-lg text-lg flex-shrink-0 ring-1 ring-gray-200/70 dark:ring-gray-700/60 bg-gray-50")}> 
          {(() => {
            const isImageSrc = !!(resolvedIconSrc && (resolvedIconSrc.startsWith('/') || resolvedIconSrc.startsWith('data:image')));
            if (isImageSrc && !iconError && provider.icon) {
              return (
                <Image
                  src={resolvedIconSrc}
                  alt={`${provider.name} 图标`}
                  width={20}
                  height={20}
                  className="w-5 h-5 text-gray-800 dark:text-gray-200"
                  onError={() => {
                    if (iconIsCatalog) {
                      if (iconExtIdx < iconExts.length - 1) setIconExtIdx((i) => i + 1);
                      else setIconError(true);
                    } else { setIconError(true); }
                  }}
                />
              );
            }
            return (
              <Image src={fallbackAvatarSrc} alt={`${provider.name} 图标`} width={20} height={20} className="w-5 h-5 text-gray-800 dark:text-gray-200 rounded-sm" />
            );
          })()}
        </div>
        <div className="flex-grow min-w-0">
          <span className="font-semibold text-base text-gray-800 dark:text-gray-200 block truncate">{provider.name}</span>
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant={badgeVariant} className={cn("mt-1 text-xs font-medium px-1.5 py-0.5", badgeClasses)}>
                  <StatusIcon className={cn("w-3 h-3 mr-1", provider.displayStatus === 'CONNECTING' && 'animate-spin')} />
                  {statusText}
                </Badge>
              </TooltipTrigger>
              {provider.statusTooltip && (
                <TooltipContent side="bottom" align="start">
                  <p className="text-xs max-w-xs">{provider.statusTooltip}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onRefresh(provider); }}
          disabled={isConnecting || isGloballyInitializing}
          className="p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          title={`检查 ${provider.name} 连接状态`}
        >
          {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
        </button>
        <CollapsibleTrigger className="p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 dark:focus:ring-offset-gray-800" aria-label={isOpen ? "折叠" : "展开"} disabled={isConnecting || isGloballyInitializing}>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </CollapsibleTrigger>
      </div>
    </div>
  );
}

