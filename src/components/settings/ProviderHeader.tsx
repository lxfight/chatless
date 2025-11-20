"use client";
import React from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Loader2, Wifi, BugPlay, MoreVertical, Undo2, Settings as SettingsIcon, Sliders } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import type { ProviderWithStatus } from "@/hooks/useProviderManagement";

// 格式化最后检查时间
function formatLastCheckedTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) { // 1分钟内
    return '刚刚';
  } else if (diff < 3600000) { // 1小时内
    const minutes = Math.floor(diff / 60000);
    return `${minutes}分钟前`;
  } else if (diff < 86400000) { // 1天内
    const hours = Math.floor(diff / 3600000);
    return `${hours}小时前`;
  } else {
    const days = Math.floor(diff / 86400000);
    return `${days}天前`;
  }
}

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
  onOpenFetchDebugger?: (provider: ProviderWithStatus) => void;
  hasFetchRule?: boolean;
  onOpenSettings?: () => void;
  onResetUrl?: () => void;
  onPreferenceChange?: (providerName: string, preferences: { useBrowserRequest?: boolean }) => Promise<void>;
}

function ProviderHeaderImpl(props: ProviderHeaderProps) {
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
    onOpenToggle,
    onRefresh,
  } = props;

  return (
    <div
      className={cn(
        "flex items-center justify-between w-full px-4 py-1.5 transition-colors rounded-t-xl",
        isOpen
          ? "bg-indigo-50/70 dark:bg-indigo-900/20 ring-0 ring-indigo-200 dark:ring-indigo-700"
          : "bg-white/80 dark:bg-gray-800/40 hover:bg-indigo-50/70 dark:hover:bg-indigo-900/20 hover:ring-0 hover:ring-indigo-200 dark:hover:ring-indigo-700"
      )}
      onClick={onOpenToggle}
    >
      <div className="flex items-center gap-2 flex-grow min-w-0 mr-3">
        <div className={cn("flex items-center justify-center w-8 h-8 rounded-lg text-lg flex-shrink-0 ring-1 ring-gray-200/70 dark:ring-gray-700/60 bg-gray-50")}> 
          <Image
            src={resolvedIconSrc}
            alt={`${provider.name} 图标`}
            width={20}
            height={20}
            className="w-5 h-5 text-gray-800 dark:text-gray-200"
            priority
            key={`${provider.name}-${resolvedIconSrc}`}
          />
        </div>
        <div className="flex-grow min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-base text-gray-800 dark:text-gray-200 truncate">{provider.name}</span>
            {/* 只在有状态时显示徽章，放在名称后面 */}
            {statusText && StatusIcon && (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant={badgeVariant} className={cn("text-xs font-medium px-1.5 py-0.5 flex-shrink-0", badgeClasses)}>
                      <StatusIcon className={cn("w-3 h-3 mr-1", provider.temporaryStatus === 'CONNECTING' && 'animate-spin')} />
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
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity">
        {props.onOpenFetchDebugger && (
          <button
            onClick={(e) => { e.stopPropagation(); props.onOpenFetchDebugger?.(provider); }}
            className={cn("p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 dark:focus:ring-offset-gray-800",
              props.hasFetchRule ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400")}
            title="模型获取调试器"
          >
            <BugPlay className="w-4 h-4" />
          </button>
        )}
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={async (e) => { 
                  e.stopPropagation(); 
                  onRefresh(provider);
                }}
                disabled={isConnecting || isGloballyInitializing}
                className="p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md  dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="center">
              <div className="text-xs max-w-xs">
                {isConnecting ? (
                  <p>正在检查状态...</p>
                ) : provider.lastCheckedAt ? (
                  <div>
                    <p className="font-medium">最后检查：{formatLastCheckedTime(provider.lastCheckedAt)}</p>
                    <p className="text-gray-500 mt-1">点击重新检查状态</p>
                  </div>
                ) : (
                  <p>点击检查状态</p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {/* 设置下拉菜单 - 三个点 */}
        {props.onOpenSettings && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md focus:outline-none transition-colors",
                  provider.preferences?.useBrowserRequest && "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                )}
                title="提供商设置"
              >
                <MoreVertical className="w-4 h-4" />
                {provider.preferences?.useBrowserRequest && (
                  <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full border border-white dark:border-gray-800"></div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuLabel className="flex items-center gap-1.5 text-xs font-semibold">
                <SettingsIcon className="w-3.5 h-3.5 text-blue-600" />
                提供商设置
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              {props.onResetUrl && (
                <DropdownMenuItem 
                  onClick={(e) => { 
                    e.stopPropagation();
                    props.onResetUrl?.(); 
                  }} 
                  className="flex items-center gap-2 px-2 py-2 text-xs cursor-pointer"
                >
                  <div className="flex items-center justify-center w-7 h-7 bg-slate-100 dark:bg-slate-700 rounded">
                    <Undo2 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium">重置地址</span>
                    <span className="text-[10px] text-slate-500">恢复默认配置</span>
                  </div>
                </DropdownMenuItem>
              )}
              
              {props.onResetUrl && <DropdownMenuSeparator />}
              
              <DropdownMenuItem 
                onClick={(e) => { 
                  e.stopPropagation();
                  props.onOpenSettings?.(); 
                }} 
                className="flex items-center gap-2 px-2 py-2 text-xs cursor-pointer"
              >
                <div className="flex items-center justify-center w-7 h-7 bg-blue-100 dark:bg-blue-900/50 rounded">
                  <Sliders className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">高级选项</span>
                    {provider.preferences?.useBrowserRequest && (
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500">请求方式等</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
export const ProviderHeader = React.memo(ProviderHeaderImpl, (prev, next) => {
  // 仅在关键渲染相关的属性变化时更新，避免展开其它项时触发全部重渲染
  return (
    prev.provider.name === next.provider.name &&
    prev.resolvedIconSrc === next.resolvedIconSrc &&
    prev.isOpen === next.isOpen &&
    prev.isConnecting === next.isConnecting &&
    prev.isGloballyInitializing === next.isGloballyInitializing &&
    prev.statusText === next.statusText &&
    prev.badgeVariant === next.badgeVariant &&
    prev.badgeClasses === next.badgeClasses
  );
});
