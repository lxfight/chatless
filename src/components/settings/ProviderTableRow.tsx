"use client";
import React, { useState } from 'react';
import { KeyRound, AlertTriangle, Wifi, MoreVertical, ChevronDown, ChevronRight, GripVertical, Sliders, Pencil, BugPlay, ChevronUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ProviderConnectionSection } from './ProviderConnectionSection';
import { ProviderModelList } from './ProviderModelList';
import { useStableProviderIcon } from './useStableProviderIcon';
import { AddProvidersDialog } from './AddProvidersDialog';
import { getAvatarSync } from '@/lib/utils/logoService';
import { isDevelopmentEnvironment } from '@/lib/utils/environment';
import ModelFetchDebugger from './ModelFetchDebugger';
import { cn } from '@/lib/utils';
import type { ProviderWithStatus } from '@/hooks/useProviderManagement';
import type { ModelMetadata } from '@/lib/metadata/types';
import { AdvancedSettingsDialog } from '@/components/settings/AdvancedSettingsDialog';
import { ModelParametersDialog } from '@/components/chat/ModelParametersDialog';
import { useProviderStatusStore } from '@/store/providerStatusStore';
import { useProviderMetaStore } from '@/store/providerMetaStore';

interface ProviderTableRowProps {
  provider: ProviderWithStatus;
  _index: number;
  isConnecting: boolean;
  isInitialChecking: boolean;
  onUrlChange: (providerName: string, url: string) => void;
  onDefaultApiKeyChange: (providerName: string, apiKey: string) => void;
  onDefaultApiKeyBlur: (providerName: string) => void;
  onModelApiKeyChange: (modelName: string, apiKey: string) => void;
  onModelApiKeyBlur: (modelName: string) => void;
  onRefresh: (provider: ProviderWithStatus) => void;
  onPreferenceChange?: (providerName: string, preferences: { useBrowserRequest?: boolean }) => Promise<void>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function formatLastCheckedTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  if (diff < 60000) { return '刚刚'; }
  else if (diff < 3600000) { const minutes = Math.floor(diff / 60000); return `${minutes}分钟前`; }
  else if (diff < 86400000) { const hours = Math.floor(diff / 3600000); return `${hours}小时前`; }
  else { const days = Math.floor(diff / 86400000); return `${days}天前`; }
}

// 绝对时间格式化（本地化显示）
function formatDateTime(ts?: number) {
  if (!ts) return undefined;
  try { return new Date(ts).toLocaleString(); } catch { return undefined; }
}

export function ProviderTableRow({
  provider,
  _index,
  isConnecting,
  isInitialChecking,
  onUrlChange,
  onDefaultApiKeyChange,
  onDefaultApiKeyBlur,
  onModelApiKeyChange,
  onModelApiKeyBlur,
  onRefresh,
  onPreferenceChange,
  // 来自父级Sortable：把手监听与属性
  dragHandleProps,
  open,
  onOpenChange
}: ProviderTableRowProps & { dragHandleProps?: any }) {
  // 实时订阅该 provider 的最新检查结果，确保无需切页即可更新
  const live = useProviderStatusStore(s => s.map[provider.name]);
  const lastCheckedAt = live?.lastCheckedAt ?? provider.lastCheckedAt;
  const lastResult = (live as any)?.lastResult ?? (provider as any).lastResult;
  const lastMessage = (live as any)?.lastMessage ?? (provider as any).lastMessage;
  const isControlled = open !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const isExpanded = isControlled ? !!open : internalOpen;
  const setIsExpanded = (v: boolean) => { if (!isControlled) setInternalOpen(v); onOpenChange?.(v); };
  const [fetchDebuggerOpen, setFetchDebuggerOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const hasAdvanced = !!(provider.preferences?.useBrowserRequest);

  // 连接中状态采用 providerMetaStore 的实时标记，避免依赖父组件传入
  const isConnectingLive = useProviderMetaStore(s => s.connectingSet.has(provider.name));

  // 模型参数设置对话框状态
  const [parametersDialogOpen, setParametersDialogOpen] = useState(false);
  const [selectedModelForParams, setSelectedModelForParams] = useState<{
    providerName: string;
    modelId: string;
    modelLabel?: string;
  } | null>(null);

  // 处理打开模型参数设置弹窗
  const handleOpenParameters = (modelId: string, modelLabel?: string) => {
    setSelectedModelForParams({ 
      providerName: provider.name, 
      modelId, 
      modelLabel 
    });
    setParametersDialogOpen(true);
  };

  // 本行的可编辑本地状态（确保输入可键入）
  const [localUrl, setLocalUrl] = useState<string>(provider.api_base_url || '');
  const [localDefaultApiKey, setLocalDefaultApiKey] = useState<string>(provider.default_api_key || '');
  React.useEffect(() => {
    setLocalUrl(provider.api_base_url || '');
    setLocalDefaultApiKey(provider.default_api_key || '');
  }, [provider.name, provider.api_base_url, provider.default_api_key]);
  
  // 模型搜索本地状态（用于 ProviderModelList 的筛选输入框）
  const [modelSearch, setModelSearch] = useState<string>('');
  
  // 状态显示逻辑
  let statusText: string | undefined;
  let StatusIcon: any = undefined;
  let badgeVariant: "secondary" | "destructive" | "outline" = "secondary";
  let badgeClasses = "";

  // 根据本地输入覆盖“未配置密钥”的显示：输入框里只要有值，就不显示 NO_KEY 徽章
  const effectiveConfigStatus: typeof provider.configStatus = (provider.configStatus === 'NO_KEY' && (localDefaultApiKey && localDefaultApiKey.trim()))
    ? undefined
    : provider.configStatus;

  // 优先显示配置状态（持久）
  if (effectiveConfigStatus) {
    switch (provider.configStatus) {
      case 'NO_KEY':
        statusText = '未配置密钥';
        StatusIcon = KeyRound;
        badgeVariant = 'secondary';
        // 去边框，微底色
        badgeClasses = "text-gray-700 dark:text-gray-200 bg-gray-100/60 dark:bg-gray-800/40 px-2 py-1 text-xs font-medium rounded";
        break;
      case 'NO_FETCHER':
        statusText = '未实现检查';
        StatusIcon = AlertTriangle;
        badgeVariant = 'secondary';
        badgeClasses = "text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 px-2 py-1 text-xs font-medium";
        break;
    }
  }
  // 设计意见：检查态/连通态改用通知，不在此处展示徽章

  // 图标处理
  const { iconSrc } = useStableProviderIcon(provider);
  const fallbackAvatarSrc = getAvatarSync(provider.name.toLowerCase(), provider.name, 20);

  // 订阅模型仓库，保证刷新后本卡片的模型列表即时更新
  const [localRepoModels, setLocalRepoModels] = React.useState<ModelMetadata[] | null>(null);
  React.useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    (async () => {
      try {
        const { modelRepository } = await import('@/lib/provider/ModelRepository');
        const list = await modelRepository.get(provider.name);
        if (list) {
          setLocalRepoModels(list.map((m: any) => ({ name: m.name, label: m.label || m.name, aliases: m.aliases || [], api_key: (m).apiKey })) as any);
        }
        unsubscribe = modelRepository.subscribe(provider.name, async () => {
          const latest = await modelRepository.get(provider.name);
          setLocalRepoModels((latest || []).map((m: any) => ({ name: m.name, label: m.label || m.name, aliases: m.aliases || [], api_key: (m).apiKey })) as any);
        });
      } catch (e) { console.error(e); }
    })();
    return () => { try { unsubscribe?.(); } catch { /* noop */ } };
  }, [provider.name]);

  return (
    <>
      <div className={"px-4 py-3 rounded-lg transition-colors "+(isExpanded?"bg-blue-50/30 dark:bg-blue-900/18 ring-1 ring-blue-200 dark:ring-blue-700/50":"hover:bg-blue-50/20 dark:hover:bg-blue-900/12 hover:ring-1 hover:ring-blue-200 dark:hover:ring-blue-700/40")}>
        <div className="grid grid-cols-12 gap-4 items-center">
          {/* 拖拽手柄 */}
          <div className="col-span-1 flex items-center gap-2 select-none">
            <button
              type="button"
              className="cursor-grab active:cursor-grabbing text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded"
              {...(dragHandleProps || {})}
              onMouseDown={(e)=>{ e.preventDefault(); }}
            >
              <GripVertical className="w-4 h-4" />
            </button>
            <div className="text-gray-400 dark:text-gray-500">
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </div>
          </div>

          {/* 可点击区域 - 提供商、状态 */}
            <div 
            className="col-span-9 flex items-center px-2 gap-4 cursor-pointer select-text"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {/* 提供商 */}
            <div className="flex items-center gap-3 flex-1">
              <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
                <img
                  src={iconSrc}
                  alt={provider.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = fallbackAvatarSrc;
                  }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{provider.displayName || provider.name}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {((localRepoModels ?? provider.models ?? []) as any[]).length} 个模型
              </div>
              </div>
            </div>

            {/* 状态 */}
            <div className="flex-shrink-0">
              {statusText && StatusIcon ? (
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant={badgeVariant} className={cn("text-xs font-medium px-2 py-1", badgeClasses)}>
                        <StatusIcon className={cn("w-3 h-3 mr-1", provider.temporaryStatus === 'CONNECTING' && 'animate-spin')} />
                        {statusText}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" align="start">
                      <div className="text-xs max-w-xs space-y-1">
                        {provider.lastCheckedAt ? (
                          <p>最后检查：{formatLastCheckedTime(provider.lastCheckedAt)}</p>
                        ) : <p>尚未检查</p>}
                        {provider.lastResult ? (
                          <p>上次结果：{provider.lastResult === 'CONNECTED' ? '基本可用' : provider.lastResult === 'NOT_CONNECTED' ? '无法访问' : '未知'}</p>
                        ) : null}
                        {provider.lastMessage ? (<p>{provider.lastMessage}</p>) : null}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-sm text-gray-400 dark:text-gray-500"></span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" align="start">
                      <div className="text-xs max-w-xs space-y-1">
                        {provider.lastCheckedAt ? (
                          <p>最后检查：{formatLastCheckedTime(provider.lastCheckedAt)}</p>
                        ) : <p>尚未检查</p>}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>

          {/* 操作按钮区域 - 不可点击展开 */}
            <div className="col-span-2 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      // 刷新前先同步保存输入框的密钥，避免判断基于旧值
                      try {
                        if ((localDefaultApiKey ?? '') !== (provider.default_api_key ?? '')) {
                          await onDefaultApiKeyChange(provider.name, localDefaultApiKey || '');
                        }
                      } catch { /* noop */ }
                      onRefresh(provider);
                    }}
                    disabled={isConnectingLive || isInitialChecking}
                    className="h-8 w-8 p-0 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  >
                    {isConnectingLive ? <Loader2 className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="center">
                  <div className="text-xs max-w-xs space-y-1">
                    {isConnectingLive ? (
                      <p>正在检查状态...</p>
                    ) : (
                      <>
                        {lastCheckedAt ? (
                          <p className="font-medium">最后检查：{formatDateTime(lastCheckedAt)}</p>
                        ) : (
                          <p>尚未检查</p>
                        )}
                        {lastResult ? (
                          <p>上次结果：{lastResult === 'CONNECTED' ? '基本可用' : lastResult === 'NOT_CONNECTED' ? '无法访问' : '未知'}</p>
                        ) : null}
                        {lastMessage ? (
                          <p className="text-gray-500">{lastMessage}</p>
                        ) : null}
                        <p className="text-gray-500 mt-1">点击重新检查状态</p>
                      </>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuItem onClick={() => setEditDialogOpen(true)} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-md">
                  <div className="flex items-center justify-center w-8 h-8 rounded-md ring-1 ring-gray-300 dark:ring-gray-600 bg-transparent">
                    <Pencil className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">修改提供商</span>
                    <span className="text-xs text-gray-500">重命名、服务地址、策略等</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAdvancedOpen(true)} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-md">
                  <div className="flex items-center justify-center w-8 h-8 rounded-md ring-1 ring-gray-300 dark:ring-gray-600 bg-transparent">
                    <Sliders className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">高级设置</span>
                    <span className="text-xs text-gray-500">网络请求方式等高级选项</span>
                  </div>
                  {hasAdvanced && <span className="ml-auto w-2 h-2 rounded-full bg-blue-500" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsExpanded(!isExpanded)} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-md">
                  <div className="flex items-center justify-center w-8 h-8 rounded-md ring-1 ring-gray-300 dark:ring-gray-600 bg-transparent">
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-700 dark:text-gray-300" /> : <ChevronDown className="w-4 h-4 text-gray-700 dark:text-gray-300" />}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{isExpanded ? '收起详情' : '展开详情'}</span>
                  </div>
                </DropdownMenuItem>
                {isDevelopmentEnvironment() && (
                  <DropdownMenuItem onClick={() => setFetchDebuggerOpen(true)} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-md">
                    <div className="flex items-center justify-center w-8 h-8 rounded-md ring-1 ring-gray-300 dark:ring-gray-600 bg-transparent">
                      <BugPlay className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">调试网络请求</span>
                    </div>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* 展开的详情内容 */}
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleContent className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="space-y-4">
              <ProviderConnectionSection
                provider={provider}
                localUrl={localUrl}
                setLocalUrl={setLocalUrl}
                onUrlChange={onUrlChange}
                onResetUrl={() => undefined}
                showApiKeyFields={true}
                localDefaultApiKey={localDefaultApiKey}
                setLocalDefaultApiKey={setLocalDefaultApiKey}
                docUrl={undefined}
                onDefaultApiKeyChange={onDefaultApiKeyChange}
                onDefaultApiKeyBlur={onDefaultApiKeyBlur}
                endpointPreview={provider.api_base_url}
                onPreferenceChange={onPreferenceChange}
                showInlineMenu={false}
              />
              
              <ProviderModelList
                provider={provider}
                modelsForDisplay={(localRepoModels ?? provider.models ?? []) as any}
                modelSearch={modelSearch}
                setModelSearch={setModelSearch}
                showApiKeyFields={true}
                localModelApiKeys={{}}
                setLocalModelApiKeys={() => {}}
                onModelApiKeyChange={onModelApiKeyChange}
                onModelApiKeyBlur={onModelApiKeyBlur}
                onOpenParameters={handleOpenParameters}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* 调试器 */}
      {isDevelopmentEnvironment() && (
        <ModelFetchDebugger
          open={fetchDebuggerOpen}
          onOpenChange={setFetchDebuggerOpen}
          provider={provider}
          baseUrl={provider.api_base_url}
        />
      )}

      {/* 编辑提供商对话框 */}
      <AddProvidersDialog
        trigger={<div style={{ display: 'none' }} />}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        editOnly
        editProvider={editDialogOpen ? {
          name: provider.name, // 使用原始name作为唯一标识
          api_base_url: provider.api_base_url,
          strategy: 'openai-compatible', // 默认策略，可以根据需要调整
          displayName: provider.displayName || provider.name // 使用displayName或回退到name
        } : null}
      />

      {/* 高级设置对话框 */}
      <AdvancedSettingsDialog
        open={advancedOpen}
        onOpenChange={setAdvancedOpen}
        provider={provider}
        onPreferenceChange={onPreferenceChange}
      />

      {/* 模型参数设置弹窗 */}
      <ModelParametersDialog
        open={parametersDialogOpen && !!selectedModelForParams}
        onOpenChange={setParametersDialogOpen}
        providerName={selectedModelForParams?.providerName || ''}
        modelId={selectedModelForParams?.modelId || ''}
        modelLabel={selectedModelForParams?.modelLabel}
      />
    </>
  );
}
