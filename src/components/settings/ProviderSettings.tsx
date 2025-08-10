import { useState, useRef } from 'react';
import React from 'react';
import { InputField } from './InputField';
import { CheckCircle, XCircle, KeyRound, RefreshCcw, ChevronDown, ChevronUp, Database, Loader2, AlertTriangle, HelpCircle, Search, ExternalLink, Settings, RotateCcw, Wifi, Undo2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"; // 使用 shadcn 折叠组件
import { Badge } from "@/components/ui/badge"; // 导入 Badge
import Image from "next/image"; // 导入Image组件
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // 导入 Tooltip 相关组件
import { getModelCapabilities } from '@/lib/provider/staticModels';
import { Brain, Workflow, Camera, Image as ImageIcon, Mic, Volume2, Clapperboard, Globe, Braces, Layers, ListOrdered, SlidersHorizontal, Ban, MessageSquareOff } from 'lucide-react';
import type { ModelMetadata } from '@/lib/metadata/types';
import { ModelParametersDialog } from '@/components/chat/ModelParametersDialog';
import { linkOpener } from '@/lib/utils/linkOpener';
import { AVAILABLE_PROVIDERS_CATALOG } from '@/lib/provider/catalog';
import { toast } from 'sonner';
import { modelRepository } from '@/lib/provider/ModelRepository';

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
  const [newModelId, setNewModelId] = useState(''); // 新增模型 ID
  const [isAddingModel, setIsAddingModel] = useState(false);
  const [filterThinking, setFilterThinking] = useState(false);
  const [filterTools, setFilterTools] = useState(false);
  const [filterVision, setFilterVision] = useState(false);
  const [showDetailCaps, setShowDetailCaps] = useState(false); // 是否在行内展示所有能力徽标
  
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

  // 判断图标是否为可渲染的图片地址（本地路径或 data:image）
  const isImageSrc = !!(provider.icon && typeof provider.icon === 'string' && (provider.icon.startsWith('/') || provider.icon.startsWith('data:image')));

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
    // 优先从目录中查询（包括 302AI、ocoolAI、OpenRouter、Groq 等代理）
    const def = AVAILABLE_PROVIDERS_CATALOG.find(d => d.name === providerName);
    if (def?.defaultUrl) return def.defaultUrl;
    // 兜底：常见官方默认地址
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
    const repoName = provider.aliases?.[0] || provider.name;
    const defaultUrl = getDefaultUrl(provider.name);
    setLocalUrl(defaultUrl);
    onUrlChange(repoName, defaultUrl);
    onUrlBlur(repoName);
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

  // 是否允许用户新增模型（除 Ollama）
  const canAddModels = provider.name !== 'Ollama';

  // —— 模型策略选择（仅对 multi 策略类 provider 有意义，如 New API） ——
  const isMultiStrategyProvider = provider.name.toLowerCase() === 'new api' || provider.name.toLowerCase() === 'newapi';
  const STRATEGY_OPTIONS: Array<{ value: string; label: string }> = [
    { value: 'openai-compatible', label: 'OpenAI Compatible (/v1/chat/completions)' },
    { value: 'openai', label: 'OpenAI Strict' },
    { value: 'anthropic', label: 'Anthropic (messages)' },
    { value: 'gemini', label: 'Google Gemini (generateContent)' },
    { value: 'deepseek', label: 'DeepSeek (chat/completions)' },
  ];
  const [defaultStrategy, setDefaultStrategy] = useState<string>('openai-compatible');
  const [modelStrategies, setModelStrategies] = useState<Record<string, string>>({});

  React.useEffect(() => {
    (async () => {
      if (!isMultiStrategyProvider) return;
      const { specializedStorage } = await import('@/lib/storage');
      const def = await specializedStorage.models.getProviderDefaultStrategy(provider.name);
      setDefaultStrategy(def || 'openai-compatible');
      const map: Record<string, string> = {};
      for (const m of provider.models || []) {
        const s = await specializedStorage.models.getModelStrategy(provider.name, m.name);
        if (s) map[m.name] = s;
      }
      setModelStrategies(map);
    })().catch(console.error);
  }, [provider.name, provider.models, isMultiStrategyProvider]);

  const handleAddModel = async () => {
    const raw = (newModelId || '').trim();
    if (!raw) {
      toast.error('请输入模型 ID');
      return;
    }
    // 简单重复校验（对大小写不敏感）
    const exists = (provider.models || []).some((m) => m.name.toLowerCase() === raw.toLowerCase());
    if (exists) {
      toast.error('模型已存在');
      return;
    }
    setIsAddingModel(true);
    try {
      // 读取当前存储模型 → 追加 → 保存
      const current = (await modelRepository.get(provider.name)) || [];
      const next = [
        ...current,
        { provider: provider.name, name: raw, label: raw, aliases: [raw] },
      ];
      await modelRepository.save(provider.name, next);
      // 刷新上层 Provider 数据
      await onRefresh(provider);
      setNewModelId('');
      toast.success('已添加模型', { description: raw });
    } catch (err: any) {
      console.error(err);
      toast.error('添加模型失败', { description: err?.message || String(err) });
    }
    setIsAddingModel(false);
  };

  const renderCapabilityIcons = (modelId: string) => {
    const caps = getModelCapabilities(modelId);
    const items: Array<{ key: string; show: boolean; title: string; Icon: any; className?: string }> = [
      { key: 'thinking', show: caps.supportsThinking, title: '支持思考/推理', Icon: Brain },
      { key: 'tools', show: caps.supportsFunctionCalling, title: '支持工具调用', Icon: Workflow },
      { key: 'vision', show: caps.supportsVision, title: '支持视觉', Icon: Camera },
      { key: 'image', show: caps.supportsImageGeneration, title: '支持图片生成', Icon: ImageIcon },
      { key: 'audio-in', show: caps.supportsAudioIn, title: '支持音频输入', Icon: Mic },
      { key: 'audio-out', show: caps.supportsAudioOut, title: '支持音频输出/TTS', Icon: Volume2 },
      { key: 'video', show: caps.supportsVideoGeneration, title: '支持视频生成', Icon: Clapperboard },
      { key: 'search', show: caps.supportsWebSearch, title: '支持联网搜索', Icon: Globe },
      { key: 'json', show: caps.supportsJSONMode, title: '支持 JSON Mode', Icon: Braces },
      { key: 'embed', show: caps.supportsEmbedding, title: '支持 Embedding', Icon: Layers },
      { key: 'rerank', show: caps.supportsRerank, title: '支持 Rerank', Icon: ListOrdered },
      { key: 'reasoning-ctrl', show: caps.supportsReasoningControl, title: '支持思考强度控制', Icon: SlidersHorizontal },
    ];
    const negatives: Array<{ key: string; show: boolean; title: string; Icon: any }> = [
      { key: 'no-delta', show: caps.notSupportTextDelta, title: '不支持文本增量(流式)', Icon: Ban },
      { key: 'no-system', show: caps.notSupportSystemMessage, title: '不支持 System Message', Icon: MessageSquareOff },
    ];
    return (
      <div className="flex items-center flex-wrap gap-1 text-gray-500 dark:text-gray-400">
        {showDetailCaps && items.filter(i=>i.show).map(i => (
          <TooltipProvider key={i.key} delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 px-1.5 h-5 rounded-md bg-gray-100 dark:bg-gray-700/50">
                  <i.Icon className="w-3.5 h-3.5" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="center">
                <span className="text-xs">{i.title}</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
        {negatives.filter(n=>n.show).map(n => (
          <TooltipProvider key={n.key} delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 px-1.5 h-5 rounded-md bg-red-50 dark:bg-red-900/30">
                  <n.Icon className="w-3.5 h-3.5 text-red-500" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="center">
                <span className="text-xs text-red-500">{n.title}</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>
    );
  };

  const renderCapabilitySummaryButton = (modelId: string) => {
    const caps = getModelCapabilities(modelId);
    const lines: Array<{ label: string; ok: boolean }> = [
      { label: '思考/推理', ok: caps.supportsThinking },
      { label: '工具调用', ok: caps.supportsFunctionCalling },
      { label: '视觉', ok: caps.supportsVision },
      { label: '图片生成', ok: caps.supportsImageGeneration },
      { label: '音频输入', ok: caps.supportsAudioIn },
      { label: '音频输出', ok: caps.supportsAudioOut },
      { label: '视频生成', ok: caps.supportsVideoGeneration },
      { label: '联网搜索', ok: caps.supportsWebSearch },
      { label: 'JSON 模式', ok: caps.supportsJSONMode },
      { label: 'Embedding', ok: caps.supportsEmbedding },
      { label: 'Rerank', ok: caps.supportsRerank },
      { label: '思考强度控制', ok: caps.supportsReasoningControl },
    ];
    const negatives: Array<{ label: string; bad: boolean }> = [
      { label: '不支持流式增量', bad: caps.notSupportTextDelta },
      { label: '不支持 System Message', bad: caps.notSupportSystemMessage },
    ];
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="p-1 rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50"
              aria-label="查看能力清单" title="查看能力清单">
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="start" className="max-w-xs">
            <div className="text-xs space-y-1">
              {lines.map((l, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className={`inline-block w-2 h-2 rounded-full ${l.ok? 'bg-green-500':'bg-gray-400'}`} />
                  <span>{l.label}</span>
                </div>
              ))}
              {negatives.filter(n=>n.bad).length>0 && (
                <div className="pt-1">
                  {negatives.filter(n=>n.bad).map((n, i) => (
                    <div key={i} className="flex items-center gap-2 text-red-500">
                      <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                      <span>{n.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden bg-white/60 dark:bg-gray-800/30 hover:bg-gray-50/40 transition-colors">
      <div className="flex items-center justify-between w-full p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
        <div className="flex items-center gap-2 flex-grow min-w-0 mr-3">
            <div className={cn(
              "flex items-center justify-center w-8 h-8 rounded-md text-lg shadow-sm flex-shrink-0",
              "bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800"
            )}>
              {isImageSrc && !iconError && provider.icon ? (
                <Image
                  src={provider.icon}
                  alt={`${provider.name} 图标`}
                  width={20}
                  height={20}
                  className="w-5 h-5 text-gray-800 dark:text-white"
                  onError={() => setIconError(true)}
                />
              ) : provider.icon && !isImageSrc ? (
                <span className="text-base">{provider.icon}</span>
              ) : (
                <Database className="w-4 h-4" />
              )}
            </div>
            <div className="flex-grow min-w-0">
              <span className="font-semibold text-base text-gray-800 dark:text-gray-200 block truncate">
                {provider.name}
                {provider.isUserAdded && (
                  <span className="ml-2 align-middle text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">新增</span>
                )}
              </span>
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
                    const repoName = provider.aliases?.[0] || provider.name;
                    onUrlChange(repoName, localUrl);
                    onUrlBlur(repoName);
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
            <div className="flex items-end gap-2">
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
                    const repoName = provider.aliases?.[0] || provider.name;
                    onDefaultApiKeyChange(repoName, localDefaultApiKey);
                    onDefaultApiKeyBlur(repoName);
                    isUserTypingRef.current = false;
                  }}
                  placeholder="API Key"
                  className="h-8 text-sm w-full"
                  wrapperClassName="mb-0"
                  icon={<KeyRound className="w-4 h-4 text-gray-400" />}
                />
              </div>
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
                  className="h-8 w-8 flex items-center justify-center text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded focus:outline-none"
                  title="前往秘钥管理"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* 模型列表和配置 */}
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            {isMultiStrategyProvider && (
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">默认请求策略</label>
                <div className="flex items-center gap-2">
                  <Select
                    value={defaultStrategy}
                    onValueChange={async (val) => {
                      try {
                        setDefaultStrategy(val);
                        const { specializedStorage } = await import('@/lib/storage');
                        await specializedStorage.models.setProviderDefaultStrategy(provider.name, val as any);
                        toast.success('已更新默认策略');
                      } catch (e) {
                        console.error(e);
                        toast.error('更新默认策略失败');
                      }
                    }}
                  >
                    <SelectTrigger className="w-80 h-8 text-xs">
                      <SelectValue placeholder="选择默认请求策略" />
                    </SelectTrigger>
                    <SelectContent>
                      {STRATEGY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="mt-1 text-[10px] text-gray-400">对于 New API 等聚合服务，默认策略会应用到未单独指定策略的模型上。</p>
              </div>
            )}
            {/* 标题 + 搜索 + 能力筛选 */}
            <div className="flex items-center justify-between mb-2 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">可用模型配置</h4>
                {provider.models && (
                  <span className="text-[10px] text-gray-400 whitespace-nowrap">{provider.models.length} 个</span>
                )}
                {/* 能力筛选（轻量） */}
                <div className="hidden sm:flex items-center gap-1 ml-2">
                  <button
                    type="button"
                    onClick={()=>setFilterThinking(v=>!v)}
                    className={`px-1.5 h-5 rounded-md text-[10px] flex items-center gap-1 ${filterThinking? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300':'bg-gray-100 text-gray-500 dark:bg-gray-700/50 dark:text-gray-300'}`}
                    title="仅显示支持思考的模型"
                  >
                    <Brain className="w-3 h-3" />思考
                  </button>
                  <button
                    type="button"
                    onClick={()=>setFilterTools(v=>!v)}
                    className={`px-1.5 h-5 rounded-md text-[10px] flex items-center gap-1 ${filterTools? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300':'bg-gray-100 text-gray-500 dark:bg-gray-700/50 dark:text-gray-300'}`}
                    title="仅显示支持工具调用的模型"
                  >
                    <Workflow className="w-3 h-3" />工具
                  </button>
                  <button
                    type="button"
                    onClick={()=>setFilterVision(v=>!v)}
                    className={`px-1.5 h-5 rounded-md text-[10px] flex items-center gap-1 ${filterVision? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300':'bg-gray-100 text-gray-500 dark:bg-gray-700/50 dark:text-gray-300'}`}
                    title="仅显示支持视觉的模型"
                  >
                    <Camera className="w-3 h-3" />视觉
                  </button>
                  <span className="mx-1 text-gray-300 dark:text-gray-600">|</span>
                  <button
                    type="button"
                    onClick={()=>setShowDetailCaps(v=>!v)}
                    className={`px-1.5 h-5 rounded-md text-[10px] ${showDetailCaps? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300':'bg-gray-100 text-gray-500 dark:bg-gray-700/50 dark:text-gray-300'}`}
                    title="切换行内能力徽标的显示"
                  >
                    {showDetailCaps? '详细徽标' : '简洁模式'}
                  </button>
                </div>
              </div>
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
            {/* 新增模型（除 Ollama） */}
            {canAddModels && (
              <div className="flex items-center gap-2 mb-2">
                <Input
                  value={newModelId}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewModelId(e.target.value)}
                  placeholder="输入模型 ID，例如：gpt-4o 或 deepseek-r1"
                  className="h-7 text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={isAddingModel || isGloballyInitializing}
                  onClick={handleAddModel}
                >
                  {isAddingModel ? <Loader2 className="w-3 h-3 animate-spin" /> : '添加模型'}
                </Button>
              </div>
            )}
            {provider.models && provider.models.length > 0 ? (
              <div className="space-y-2">
                {(() => {
                  const filtered = provider.models.filter((m: ModelMetadata) => {
                    if (!m.name.toLowerCase().includes(modelSearch.toLowerCase())) return false;
                    if (!filterThinking && !filterTools && !filterVision) return true;
                    const caps = getModelCapabilities(m.name);
                    if (filterThinking && !caps.supportsThinking) return false;
                    if (filterTools && !caps.supportsFunctionCalling) return false;
                    if (filterVision && !caps.supportsVision) return false;
                    return true;
                  });
                  const toShow = modelsExpanded ? filtered : filtered.slice(0, 6);
                  return toShow.map((model: ModelMetadata) => (
                    <div key={model.name} className="flex items-center gap-2 pl-2 border-l-2 border-indigo-200 dark:border-indigo-700 py-1">
                      <div className="flex flex-row items-center justify-start flex-auto min-w-0 pr-2 gap-2">
                        <span
                          className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate"
                          title={model.label || model.name}
                        >
                          {model.label || model.name}
                        </span>
                        {isMultiStrategyProvider && (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-400">策略:</span>
                            <Select
                              value={modelStrategies[model.name] || defaultStrategy}
                              onValueChange={async (val) => {
                                try {
                                  const { specializedStorage } = await import('@/lib/storage');
                                  setModelStrategies(prev => ({ ...prev, [model.name]: val }));
                                  await specializedStorage.models.setModelStrategy(provider.name, model.name, val as any);
                                  toast.success('模型策略已保存');
                                } catch (e) {
                                  console.error(e);
                                  toast.error('保存模型策略失败');
                                }
                              }}
                            >
                              <SelectTrigger className="h-6 w-64 text-[11px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STRATEGY_OPTIONS.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <span className="text-gray-300 dark:text-gray-600">·</span>
                        {renderCapabilityIcons(model.name)}
                        {renderCapabilitySummaryButton(model.name)}
                      </div>

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
                            const repoName = provider.aliases?.[0] || provider.name;
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
                {provider.models && provider.models.length === 0
                  ? (provider.displayStatus === 'CONNECTING' ? '正在加载模型...' : '未找到可用模型。')
                  : (provider.displayStatus === 'NO_KEY' ? '已显示已知/静态模型。配置 API 密钥后可拉取最新模型。' : '')}
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