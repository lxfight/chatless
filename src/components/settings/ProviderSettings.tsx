import { useState, useRef } from 'react';
import React from 'react';
import { InputField } from './InputField';
import { CheckCircle, XCircle, KeyRound, RefreshCcw, ChevronDown, ChevronUp, Database, Loader2, AlertTriangle, HelpCircle, Search, ExternalLink, Settings, RotateCcw, Wifi, Undo2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"; // 使用 shadcn 折叠组件
import { Badge } from "@/components/ui/badge"; // 导入 Badge
import Image from "next/image"; // 导入Image组件
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // 导入 Tooltip 相关组件
import type { ModelMetadata } from '@/lib/metadata/types';
import { ModelParametersDialog } from '@/components/chat/ModelParametersDialog';
import { linkOpener } from '@/lib/utils/linkOpener';
import { toast } from 'sonner';

// 导入 ProviderWithStatus 类型
import type { ProviderWithStatus } from '@/hooks/useProviderManagement';

interface ProviderSettingsProps {
  provider: ProviderWithStatus;
  isConnecting: boolean; // 单个 Provider 是否正在连接 (用于 Loading 状态)
  isInitialChecking: boolean; // 是否处于全局初始检查状态 (用于禁用按钮)
  onUrlChange: (providerName: string, url: string) => void;
  onUrlBlur: (providerName: string) => void;
  onDefaultApiKeyChange: (providerName: string, apiKey: string) => void;
  onDefaultApiKeyBlur: (providerName: string) => void;
  onModelApiKeyChange: (modelName: string, apiKey: string) => void; // Model 也使用 name
  onModelApiKeyBlur: (modelName: string) => void;
  onRefresh: (provider: ProviderWithStatus) => void;
}

export function ProviderSettings({
  provider,
  isConnecting,
  isInitialChecking,
  onUrlChange,
  onUrlBlur,
  onDefaultApiKeyChange,
  onDefaultApiKeyBlur,
  onModelApiKeyChange,
  onModelApiKeyBlur,
  onRefresh
}: ProviderSettingsProps) {
  const [isOpen, setIsOpen] = useState(false); // 默认折叠
  const [iconError, setIconError] = useState(false); // 添加图标加载错误状态
  const [showModelSearch, setShowModelSearch] = useState(false); // 控制模型搜索输入框的显示
  const [modelSearch, setModelSearch] = useState(''); // 模型搜索输入框的值
  const [modelsExpanded, setModelsExpanded] = useState(false); // 模型列表展开
  
  // 模型参数设置弹窗状态
  const [parametersDialogOpen, setParametersDialogOpen] = useState(false);
  const [selectedModelForParams, setSelectedModelForParams] = useState<{
    providerName: string;
    modelId: string;
    modelLabel?: string;
  } | null>(null);

  // provider-specific API key doc links
  const keyDocLinks: Record<string, string> = {
    'openai': 'https://platform.openai.com/account/api-keys',
    'anthropic': 'https://console.anthropic.com/settings/keys',
    'google ai': 'https://aistudio.google.com/app/apikey',
    'deepseek': 'https://deepseek.com',
    // Ollama 不需要 API Key
  };
  const providerKey = provider.name.toLowerCase();
  const docUrl = keyDocLinks[providerKey];

  // 判断图标是否为SVG路径
  const isSvgPath = provider.icon && typeof provider.icon === 'string' && provider.icon.startsWith('/');

  // 处理打开模型参数设置弹窗
  const handleOpenParameters = (modelId: string, modelLabel?: string) => {
    setSelectedModelForParams({ 
      providerName: provider.name, 
      modelId, 
      modelLabel 
    });
    setParametersDialogOpen(true);
  };

  // 获取默认URL
  const getDefaultUrl = (providerName: string): string => {
    switch (providerName.toLowerCase()) {
      case 'ollama':
        return 'http://localhost:11434';
      case 'openai':
        return 'https://api.openai.com/v1';
      case 'anthropic':
        return 'https://api.anthropic.com/v1';
      case 'google ai':
        return 'https://generativelanguage.googleapis.com/v1beta';
      case 'deepseek':
        return 'https://api.deepseek.com';
      default:
        return '';
    }
  };

  // 重置URL到默认值
  const handleResetUrl = () => {
    const defaultUrl = getDefaultUrl(provider.name);
    setLocalUrl(defaultUrl);
    onUrlChange(provider.name, defaultUrl);
    onUrlBlur(provider.name);
    toast.success('已重置为默认地址', { description: defaultUrl });
  };

  // 优先判断是否正在进行初始检查 或 单个正在连接
  // const currentlyChecking = isConnecting || isInitialChecking; // <-- REMOVE THIS LINE or modify its usage
  // Display text/icon should primarily depend on isConnecting (individual status)
  // Button disabling can still use isInitialChecking
  const isGloballyInitializing = isInitialChecking; // Keep for disabling elements globally

  // 根据 displayStatus 确定文本、图标和样式
  let statusText = '未知';
  let StatusIcon = HelpCircle; // Default icon
  let badgeVariant: "secondary" | "destructive" | "outline" = "secondary";
  let badgeClasses = "";

  switch (provider.displayStatus) {
      case 'CONNECTING':
          statusText = '检查中...';
          StatusIcon = Loader2;
          badgeVariant = 'secondary';
          badgeClasses = "text-yellow-700 dark:text-yellow-300 bg-yellow-100/60 dark:bg-yellow-900/30 animate-pulse"; // Animate pulse for connecting
          break;
      case 'CONNECTED':
          statusText = '已连接';
          StatusIcon = CheckCircle;
          badgeVariant = 'secondary';
          badgeClasses = "text-green-700 dark:text-green-300 bg-green-100/60 dark:bg-green-900/30";
          break;
      case 'NOT_CONNECTED':
          statusText = '未连接';
          StatusIcon = XCircle;
          badgeVariant = 'destructive'; // Keep destructive variant for visual cue
          badgeClasses = "text-red-700 dark:text-red-300 bg-red-100/60 dark:bg-red-900/30 border border-red-200 dark:border-red-800/50"; // Mild red background
          break;
      case 'NO_KEY':
          statusText = '未配置密钥';
          StatusIcon = KeyRound; // Use Key icon
          badgeVariant = 'outline'; // Use outline variant for less emphasis
          badgeClasses = "text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600"; // Neutral colors
          break;
      case 'NO_FETCHER':
          statusText = '未实现检查';
          StatusIcon = AlertTriangle; // Use Alert icon
          badgeVariant = 'outline';
          badgeClasses = "text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-700"; // Warning colors
          break;
      default: // 'UNKNOWN' 或默认 → 显示“检查中...”
          statusText = '检查中...';
          StatusIcon = Loader2;
          badgeVariant = 'secondary';
          badgeClasses = "text-yellow-700 dark:text-yellow-300 bg-yellow-100/60 dark:bg-yellow-900/30 animate-pulse";
          break;
  }

  // 本地 state 用于输入框内容
  const [localUrl, setLocalUrl] = useState(provider.api_base_url);
  const [localDefaultApiKey, setLocalDefaultApiKey] = useState(provider.default_api_key || '');
  const [localModelApiKeys, setLocalModelApiKeys] = useState<{ [modelName: string]: string }>(
    () => {
      const obj: { [modelName: string]: string } = {};
      if (provider.models) {
        provider.models.forEach((model: ModelMetadata) => {
          obj[model.name] = model.api_key || '';
        });
      }
      return obj;
    }
  );

  // 使用 ref 来跟踪是否是用户正在输入
  const isUserTypingRef = useRef(false);
  const lastProviderUrlRef = useRef(provider.api_base_url);

  // 同步外部 provider 变更到本地 state，但避免在用户输入时重置
  React.useEffect(() => {
    // 只有当provider的URL真正发生变化（不是用户正在输入导致的）时才更新
    if (provider.api_base_url !== lastProviderUrlRef.current && !isUserTypingRef.current) {
      setLocalUrl(provider.api_base_url);
      lastProviderUrlRef.current = provider.api_base_url;
    }
    
    setLocalDefaultApiKey(provider.default_api_key || '');
    const obj: { [modelName: string]: string } = {};
    if (provider.models) {
      provider.models.forEach((model: ModelMetadata) => {
        obj[model.name] = model.api_key || '';
      });
    }
    setLocalModelApiKeys(obj);
  }, [provider.api_base_url, provider.default_api_key, provider.models]);

  // 是否显示 API Key 相关字段 (Ollama 等不需要)
  const showApiKeyFields = provider.requiresApiKey !== false;

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden bg-white/60 dark:bg-gray-800/30 hover:bg-gray-50/40 transition-colors">
      <div className="flex items-center justify-between w-full p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
        <div className="flex items-center gap-2 flex-grow min-w-0 mr-3">
            <div className={cn(
              "flex items-center justify-center w-8 h-8 rounded-md text-lg shadow-sm flex-shrink-0",
              "bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800"
            )}>
              {isSvgPath && !iconError && provider.icon ? (
                <Image
                  src={provider.icon}
                  alt={`${provider.name} 图标`}
                  width={20}
                  height={20}
                  className="w-5 h-5 text-gray-800 dark:text-white"
                  onError={() => setIconError(true)}
                />
              ) : provider.icon && !isSvgPath ? (
                <span className="text-base">{provider.icon}</span>
              ) : (
                <Database className="w-4 h-4" />
              )}
            </div>
            <div className="flex-grow min-w-0">
              <span className="font-semibold text-base text-gray-800 dark:text-gray-200 block truncate">{provider.name}</span>
              <TooltipProvider delayDuration={100}>
                  <Tooltip>
                      <TooltipTrigger asChild>
                         <Badge 
                            variant={badgeVariant}
                            className={cn("mt-1 text-xs font-medium px-1.5 py-0.5", badgeClasses)}
                         >
                            <StatusIcon className={cn("w-3 h-3 mr-1", provider.displayStatus === 'CONNECTING' && 'animate-spin')} />
                            {statusText}
                         </Badge>
                      </TooltipTrigger>
                      {/* Show tooltip only if there is content */}
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
              // Disable button if this one is connecting OR if globally initializing
              disabled={isConnecting || isGloballyInitializing}
              className="p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              title={`检查 ${provider.name} 连接状态`}
            >
              {/* Show loader if this one is connecting (ignore global init for button icon) */}
              {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
            </button>
             <CollapsibleTrigger 
                className="p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 dark:focus:ring-offset-gray-800"
                aria-label={isOpen ? "折叠" : "展开"}
                // Disable trigger if this one is connecting OR if globally initializing
                disabled={isConnecting || isGloballyInitializing}
             >
                {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </CollapsibleTrigger>
        </div>
          </div>

      <CollapsibleContent className="px-4 pb-4 pt-3 bg-gray-50/50 dark:bg-gray-800/30 border-t border-gray-200 dark:border-gray-700">
        <div className="space-y-3">
          {/* 服务地址输入框和重置按钮 */}
          <div className="group mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              服务地址
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <input
                  value={localUrl}
                  onChange={(e) => {
                    setLocalUrl(e.target.value);
                    isUserTypingRef.current = true;
                  }}
                  onBlur={() => {
                    onUrlChange(provider.name, localUrl);
                    onUrlBlur(provider.name);
                    isUserTypingRef.current = false;
                  }}
                  placeholder={provider.name.toLowerCase()==='ollama' ? 'http://localhost:11434' : '服务地址 (http://...)'}
                  className="w-full p-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary focus:border-transparent transition-all duration-200 hover:border-primary dark:hover:border-primary dark:text-gray-200 h-8 text-sm"
                />
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={handleResetUrl}
                      className="p-2 text-gray-500 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-1 dark:focus:ring-offset-gray-800 transition-all duration-200"
                      title="重置为默认地址"
                    >
                      <Undo2 className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>重置为默认地址</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          {showApiKeyFields && (
          <div className="flex items-center gap-2">
          <div className="flex-1">
          <InputField
            label="默认 API Key"
            type="password"
            value={localDefaultApiKey}
            onChange={(e) => {
              setLocalDefaultApiKey(e.target.value);
              isUserTypingRef.current = true;
            }}
            onBlur={() => {
              onDefaultApiKeyChange(provider.name, localDefaultApiKey);
              onDefaultApiKeyBlur(provider.name);
              isUserTypingRef.current = false;
            }}
            placeholder="API Key"
            className="h-8 text-sm w-full"
            icon={<KeyRound className="w-4 h-4 text-gray-400" />}
          />
          {docUrl && (
            <button
              type="button"
              onClick={async () => {
                try {
                  const success = await linkOpener.openLink(docUrl);
                  if (!success) {
                    toast.error('无法打开链接，请稍后重试');
                  }
                } catch (error) {
                  console.error('打开链接失败:', error);
                  toast.error('打开链接失败');
                }
              }}
              className="p-1 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 rounded focus:outline-none"
              title="前往秘钥管理"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          )}
          </div>
          </div>
          )}

          {/* 模型列表和配置 */}
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            {/* 标题 + 搜索 */}
            <div className="flex items-center justify-between mb-2 gap-2">
              <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400">可用模型配置</h4>
              {/* 当模型较多时提供筛选 */}
              {provider.models && provider.models.length > 8 && (
                showModelSearch ? (
                  <Input
                    value={modelSearch}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setModelSearch(e.target.value)}
                    onBlur={() => {
                      if (modelSearch.trim() === '') {
                        setShowModelSearch(false);
                      }
                    }}
                    placeholder="筛选模型..."
                    className="h-6 w-32 text-xs"
                    autoFocus
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowModelSearch(true)}
                    className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    aria-label="筛选模型"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                )
              )}
            </div>
            {provider.models && provider.models.length > 0 ? (
              <div className="space-y-2">
                {(() => {
                  const filtered = provider.models.filter((m: ModelMetadata) =>
                    m.name.toLowerCase().includes(modelSearch.toLowerCase())
                  );
                  const toShow = modelsExpanded ? filtered : filtered.slice(0, 6);
                  return toShow.map((model: ModelMetadata) => (
                    <div key={model.name} className="flex items-center gap-2 pl-2 border-l-2 border-indigo-200 dark:border-indigo-700 py-1">
                      <span
                        className="flex-auto text-xs font-medium text-gray-700 dark:text-gray-300 truncate pr-2"
                        title={model.label || model.name}
                      >
                        {model.label || model.name}
                      </span>
                      
                      {/* 模型参数设置按钮 */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-gray-200 dark:hover:bg-gray-600 flex-shrink-0"
                        onClick={() => handleOpenParameters(model.name, model.label)}
                        title="设置模型默认参数"
                      >
                        <Settings className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                      </Button>
                      
                      {showApiKeyFields && (
                      <InputField
                        label=""
                        type="password"
                        value={localModelApiKeys[model.name] || ''}
                        onChange={(e) => {
                          setLocalModelApiKeys((prev) => ({ ...prev, [model.name]: e.target.value }));
                          isUserTypingRef.current = true;
                        }}
                        onBlur={() => {
                          onModelApiKeyChange(model.name, localModelApiKeys[model.name] || '');
                          onModelApiKeyBlur(model.name);
                          isUserTypingRef.current = false;
                        }}
                        placeholder="模型 API Key (可选)"
                        className="h-7 text-xs w-40"
                        wrapperClassName="mb-0 flex-shrink-0"
                        icon={<KeyRound className="w-3 h-3 text-gray-400" />}
                      />
                      )}
                    </div>
                  ));
                })()}
                {/* 展开/收起 */}
                {provider.models.filter((m: ModelMetadata) => m.name.toLowerCase().includes(modelSearch.toLowerCase())).length > 6 && (
                  <button
                    type="button"
                    onClick={() => setModelsExpanded(!modelsExpanded)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {modelsExpanded ? '收起' : `展开更多`}
                  </button>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 pl-2">
                {/* Model loading text: depends on individual connection status */}
                {provider.displayStatus === 'CONNECTING' ? '正在加载模型...' : 
                 provider.displayStatus === 'CONNECTED' ? '刷新后未找到可用模型。' : 
                 provider.displayStatus === 'NOT_CONNECTED' ? '服务未连接或无模型。' : 
                 provider.displayStatus === 'NO_KEY' ? '请先配置 API 密钥。' : 
                 '连接状态未知或未配置。' // Default/Unknown
                 }
              </p>
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>

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