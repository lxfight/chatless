"use client";
import { useState, useRef, useEffect } from 'react';
import React from 'react';
import { CheckCircle, XCircle, KeyRound, Loader2, AlertTriangle, HelpCircle } from 'lucide-react';
import { ProviderStrategySelector } from './ProviderStrategySelector';
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"; // 使用 shadcn 折叠组件
import { ProviderHeader } from "./ProviderHeader";
import { isDevelopmentEnvironment } from '@/lib/utils/environment';
import ModelFetchDebugger from './ModelFetchDebugger';
import { markResolvedBase, markUrlMissing } from '@/lib/utils/logoService';
import type { ModelMetadata } from '@/lib/metadata/types';
import { ModelParametersDialog } from '@/components/chat/ModelParametersDialog';
import { ProviderConnectionSection } from './ProviderConnectionSection';
import { ProviderModelList } from './ProviderModelList';
import { AVAILABLE_PROVIDERS_CATALOG } from '@/lib/provider/catalog';
import { specializedStorage } from '@/lib/storage';
import { toast } from '@/components/ui/sonner';
import { modelRepository } from '@/lib/provider/ModelRepository';
import { useProviderIcon } from './useProviderIcon';
import { useRecentModelsHint } from './useRecentModelsHint';

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
  onOpenChange?: (open: boolean) => void;
  open?: boolean; // 受控展开状态（存在时启用受控模式）
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
  onRefresh,
  onOpenChange,
  open
}: ProviderSettingsProps) {
  // 受控/非受控展开状态：存在 open 则受控，否则本地管理
  const isControlled = open !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState<boolean>(false);
  const isOpen = isControlled ? (open as boolean) : uncontrolledOpen;
  const setIsOpen = (next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  // 保留最小状态集
  const [modelSearch, setModelSearch] = useState(''); // 模型搜索输入框的值
  const lastUsedMap = useRecentModelsHint(provider.name);
  
  // 模型参数设置弹窗状态
  const [parametersDialogOpen, setParametersDialogOpen] = useState(false);
  const [selectedModelForParams, setSelectedModelForParams] = useState<{
    providerName: string;
    modelId: string;
    modelLabel?: string;
  } | null>(null);

  // —— 模型获取调试器状态 ——
  const [fetchDebuggerOpen, setFetchDebuggerOpen] = useState(false);
  const [hasFetchRule, setHasFetchRule] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const { specializedStorage } = await import('@/lib/storage');
        const rule = await specializedStorage.models.getProviderFetchDebugRule(provider.name);
        setHasFetchRule(!!rule);
      } catch {}
    })();
  }, [provider.name]);

  useEffect(() => {
    if (!fetchDebuggerOpen) {
      (async () => {
        try {
          const { specializedStorage } = await import('@/lib/storage');
          const rule = await specializedStorage.models.getProviderFetchDebugRule(provider.name);
          setHasFetchRule(!!rule);
        } catch {}
      })();
    }
  }, [fetchDebuggerOpen, provider.name]);

  const openFetchDebugger = () => setFetchDebuggerOpen(true);

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

  // 规范化 icon 字符串与回退链：优先使用目录 Logo（依据名称推导）→ data:image → 绝对/相对 URL → 生成头像
  const { resolvedIconSrc, fallbackAvatarSrc, iconError, setIconError, iconIsCatalog, iconExtIdx, setIconExtIdx, iconExts } = useProviderIcon(provider);

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

  // 本地 state 用于输入框内容（以本地为单一真实来源，失焦时提交保存）
  const [localUrl, setLocalUrl] = useState(provider.api_base_url);
  const [localDefaultApiKey, setLocalDefaultApiKey] = useState(provider.default_api_key || '');
  const [localModelApiKeys, setLocalModelApiKeys] = useState<{ [modelName: string]: string }>(() => {
      const obj: { [modelName: string]: string } = {};
      if (provider.models) {
        provider.models.forEach((model: ModelMetadata) => {
          obj[model.name] = model.api_key || '';
        });
      }
      return obj;
  });

  // 订阅模型仓库，确保新增/删除/重命名后即时更新列表而不触发整卡刷新
  const [localRepoModels, setLocalRepoModels] = useState<ModelMetadata[] | null>(null);
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    (async () => {
      try {
        const { modelRepository } = await import('@/lib/provider/ModelRepository');
        const list = await modelRepository.get(provider.name);
        if (list) {
          setLocalRepoModels(list.map((m: any) => ({ name: m.name, label: m.label || m.name, aliases: m.aliases || [], api_key: (m as any).apiKey })) as any);
        }
        unsubscribe = modelRepository.subscribe(provider.name, async () => {
          const latest = await modelRepository.get(provider.name);
          setLocalRepoModels((latest || []).map((m: any) => ({ name: m.name, label: m.label || m.name, aliases: m.aliases || [], api_key: (m as any).apiKey })) as any);
        });
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      try { unsubscribe?.(); } catch {}
    };
  }, [provider.name]);

  const modelsForDisplay: ModelMetadata[] = (localRepoModels ?? provider.models ?? []) as any;

  // 使用 ref 来跟踪是否是用户正在输入
  // 当切换到不同 provider 或其数据变更时，刷新本地初始值
  useEffect(() => {
      setLocalUrl(provider.api_base_url);
    setLocalDefaultApiKey(provider.default_api_key || '');
    const obj: { [modelName: string]: string } = {};
    const list = (localRepoModels ?? provider.models ?? []) as any;
    list.forEach((m: ModelMetadata) => {
      obj[m.name] = m.api_key || '';
    });
    setLocalModelApiKeys(obj);
  }, [provider.name, provider.api_base_url, provider.default_api_key, localRepoModels]);

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
  // 计算实际请求地址预览
  const endpointPreview = React.useMemo(() => {
    const base = (localUrl || '').replace(/\/$/, '');
    const strategy = (isMultiStrategyProvider ? defaultStrategy : undefined) ||
      (provider.name.toLowerCase()==='google ai' ? 'gemini' :
       provider.name.toLowerCase()==='anthropic' ? 'anthropic' :
       provider.name.toLowerCase()==='deepseek' ? 'deepseek' :
       'openai-compatible');
    if (!base) return '';
    switch (strategy) {
      case 'gemini':
        return `${base}/models/{model}:streamGenerateContent?alt=sse`;
      case 'anthropic':
        return `${base}/messages`;
      case 'deepseek':
        return `${base}/chat/completions`;
      case 'openai':
      case 'openai-compatible':
      default:
        return `${base}/chat/completions`;
    }
  }, [localUrl, provider.name, isMultiStrategyProvider, defaultStrategy]);

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

  // 旧的“添加模型”逻辑已移至独立对话框组件

  // 能力图标渲染已迁移至子组件，保留入口占位（如需再次集成可在 ModelItem 侧实现）

  // 搜索关键字高亮（已不再在此文件中使用，保留到模型列表组件内部）

  // 重命名（组件级，供弹窗和菜单共用）
  const commitRename = async (modelName: string, nextLabelRaw: string) => {
    const nextLabel = (nextLabelRaw || '').trim();
    if (!nextLabel) { toast.error('名称不可为空'); return; }
    try {
      const { modelRepository } = await import('@/lib/provider/ModelRepository');
      const { specializedStorage } = await import('@/lib/storage');
      const list = (await modelRepository.get(provider.name)) || [];
      const updated = list.map((m: any) => (m.name === modelName ? { ...m, label: nextLabel } : m));
      await modelRepository.save(provider.name, updated);
      await specializedStorage.models.setModelLabel(provider.name, modelName, nextLabel);
      toast.success('已重命名', { description: nextLabel });
    } catch (err) {
      console.error(err);
      toast.error('重命名失败');
    }
  };

  // Add/Rename 模型弹窗已拆分为独立文件


  // 能力摘要按钮已移除（如需显示可在 ModelItem 中实现）

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={(open)=>{ setIsOpen(open); onOpenChange?.(open); }} className="border border-gray-200/60 dark:border-gray-700/50 rounded-xl overflow-hidden bg-white/80 dark:bg-gray-800/30 shadow-sm hover:shadow-md transition-all">
        <ProviderHeader
          provider={provider}
          isOpen={isOpen}
          isConnecting={isConnecting}
          isGloballyInitializing={isGloballyInitializing}
          statusText={statusText}
          StatusIcon={StatusIcon}
          badgeVariant={badgeVariant}
          badgeClasses={badgeClasses}
          resolvedIconSrc={resolvedIconSrc}
          iconError={iconError}
          iconIsCatalog={iconIsCatalog}
          iconExtIdx={iconExtIdx}
          iconExts={iconExts}
          setIconExtIdx={setIconExtIdx}
          setIconError={setIconError}
          fallbackAvatarSrc={fallbackAvatarSrc}
          onOpenToggle={() => setIsOpen(!isOpen)}
          onRefresh={onRefresh}
          onOpenFetchDebugger={isDevelopmentEnvironment() ? (() => setFetchDebuggerOpen(true)) : undefined}
          hasFetchRule={hasFetchRule}
        />

      <CollapsibleContent className="px-4 pb-4 pt-3 bg-gray-50/50 dark:bg-gray-800/30 border-t border-gray-200 dark:border-gray-700">
        
        <div className="space-y-3">
          <ProviderConnectionSection
            provider={provider}
            localUrl={localUrl}
            setLocalUrl={setLocalUrl}
            onUrlChange={onUrlChange}
            onUrlBlur={onUrlBlur}
            onResetUrl={handleResetUrl}
            showApiKeyFields={showApiKeyFields}
            localDefaultApiKey={localDefaultApiKey}
            setLocalDefaultApiKey={setLocalDefaultApiKey}
            docUrl={docUrl}
            onDefaultApiKeyChange={onDefaultApiKeyChange}
            onDefaultApiKeyBlur={onDefaultApiKeyBlur}
            endpointPreview={endpointPreview}
          />

          {/* 模型列表和配置 */}
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            {isMultiStrategyProvider && (
              <ProviderStrategySelector providerName={provider.name} value={defaultStrategy as any} onChange={(v)=>setDefaultStrategy(v)} />
            )}
            <div className="mt-2">
              <ProviderModelList
                provider={provider}
                modelsForDisplay={modelsForDisplay}
                modelSearch={modelSearch}
                setModelSearch={setModelSearch}
                showApiKeyFields={showApiKeyFields}
                localModelApiKeys={localModelApiKeys}
                setLocalModelApiKeys={setLocalModelApiKeys as any}
                onModelApiKeyChange={onModelApiKeyChange}
                onModelApiKeyBlur={onModelApiKeyBlur}
                onOpenParameters={handleOpenParameters}
              />
              </div>
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

    {/* 模型获取调试器弹窗（独立组件） */}
    <ModelFetchDebugger open={fetchDebuggerOpen} onOpenChange={setFetchDebuggerOpen} provider={provider} baseUrl={localUrl || provider.api_base_url || ''} />
  </>
  );
}