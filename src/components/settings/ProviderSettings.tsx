"use client";
import { useState, useRef, useEffect } from 'react';
import React from 'react';
import { InputField } from './InputField';
import { CheckCircle, XCircle, KeyRound, RefreshCcw, ChevronDown, ChevronUp, Database, Loader2, AlertTriangle, HelpCircle, Search, ExternalLink, Settings, RotateCcw, Wifi, Undo2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { MoreHorizontal } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"; // 使用 shadcn 折叠组件
import { Badge } from "@/components/ui/badge"; // 导入 Badge
import Image from "next/image"; // 导入Image组件
import { getResolvedUrlForBase, isUrlKnownMissing, ensureLogoCacheReady, markResolvedBase, markUrlMissing, getAvatarSync, ensureAvatarInMemory } from '@/lib/utils/logoService';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // 导入 Tooltip 相关组件
import { getModelCapabilities } from '@/lib/provider/staticModels';
import { Brain, Workflow, Camera, Image as ImageIcon, Mic, Volume2, Clapperboard, Globe, Braces, Layers, ListOrdered, SlidersHorizontal, Ban, MessageSquareOff } from 'lucide-react';
import type { ModelMetadata } from '@/lib/metadata/types';
import { ModelParametersDialog } from '@/components/chat/ModelParametersDialog';
import { linkOpener } from '@/lib/utils/linkOpener';
import { AVAILABLE_PROVIDERS_CATALOG } from '@/lib/provider/catalog';
import { specializedStorage } from '@/lib/storage';
import { toast } from 'sonner';
import { modelRepository } from '@/lib/provider/ModelRepository';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

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
  onOpenChange
}: ProviderSettingsProps) {
  // 记住每个 provider 的展开状态，避免新增/编辑时因父级更新导致折叠
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const v = window.localStorage.getItem(`provider_open_${provider.name}`);
      return v ? v === '1' : true; // 默认展开，减少“内容消失”的困惑
    }
    return true;
  });
  useEffect(() => {
    try { if (typeof window !== 'undefined') window.localStorage.setItem(`provider_open_${provider.name}`, isOpen ? '1' : '0'); } catch {}
  }, [isOpen, provider.name]);
  const [showModelSearch, setShowModelSearch] = useState(false); // 控制模型搜索输入框的显示
  const [modelSearch, setModelSearch] = useState(''); // 模型搜索输入框的值
  const [modelsExpanded, setModelsExpanded] = useState(false); // 模型列表展开
  const [newModelId, setNewModelId] = useState(''); // 新增模型 ID
  const newModelInputRef = useRef<HTMLInputElement | null>(null);
  const [isAddingModel, setIsAddingModel] = useState(false);
  const [filterThinking, setFilterThinking] = useState(false);
  const [filterTools, setFilterTools] = useState(false);
  const [filterVision, setFilterVision] = useState(false);
  const [showDetailCaps, setShowDetailCaps] = useState(true); // 默认直接展示能力图标，无需悬浮查看
  // 模型显示名内联重命名
  const [editingModel, setEditingModel] = useState<{ id: string | null; value: string }>({ id: null, value: '' });
  const [groupExpanded, setGroupExpanded] = useState<{ custom: boolean; builtin: boolean }>({ custom: false, builtin: false });
  const [lastUsedMap, setLastUsedMap] = useState<Record<string,string>>({});
  useEffect(() => {
    (async () => {
      try {
        const recents = await specializedStorage.models.getRecentModels();
        // 只显示在当前 provider 下最近使用且与模型名匹配的一个微摘要
        const now = Date.now();
        const format = (ts:number) => {
          const diff = now - ts;
          if (diff < 60_000) return '刚用过';
          if (diff < 3600_000) return `${Math.floor(diff/60_000)} 分钟前`;
          if (diff < 24*3600_000) return `${Math.floor(diff/3600_000)} 小时前`;
          return `${Math.floor(diff/(24*3600_000))} 天前`;
        };
        const map: Record<string,string> = {};
        // 可扩展：若未来记录时间戳，则读取；当前先用 lastSelectedModelPair 近似表示“最近使用”
        const pair = await specializedStorage.models.getLastSelectedModelPair();
        if (pair && pair.provider === provider.name) {
          map[pair.modelId] = '刚用过';
        }
        setLastUsedMap(map);
      } catch {}
    })();
  }, [provider.name]);
  
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

  // 规范化 icon 字符串与回退链：优先使用目录 Logo（依据名称推导）→ data:image → 绝对/相对 URL → 生成头像
  const iconStr = typeof provider.icon === 'string' ? provider.icon : '';
  const iconExts = ['png', 'svg', 'webp', 'jpeg', 'jpg'] as const; // 与 logoService 一致
  const iconIsData = !!(iconStr && iconStr.startsWith('data:image'));
  const iconIsCatalog = !!(iconStr && iconStr.startsWith('/llm-provider-icon/'));
  const [iconExtIdx, setIconExtIdx] = useState(0);
  const [iconError, setIconError] = useState(false);
  // 构造候选 base（与管理提供商弹窗一致的优先级）：
  // 1) 目录 id（来自 catalog） 2) provider.icon 指向的目录路径 3) 名称转 slug
  const nameSlugBase = `/llm-provider-icon/${provider.name.toLowerCase().replace(/\s+/g, '-')}`;
  const catalogDef = AVAILABLE_PROVIDERS_CATALOG.find((c) => c.name === provider.name);
  const catalogIdBase = catalogDef ? `/llm-provider-icon/${catalogDef.id}` : null;
  const iconBaseFromProp = iconIsCatalog ? iconStr.replace(/\.(svg|png|webp|jpeg|jpg)$/i, '') : null;
  const candidateBases = [catalogIdBase, iconBaseFromProp, nameSlugBase].filter(Boolean) as string[];
  React.useEffect(() => { ensureLogoCacheReady().catch(()=>{}); }, []);
  const resolvedIconSrc = iconIsData
    ? iconStr
    : (() => {
        // 命中映射优先
        for (const base of candidateBases) {
          const mapped = getResolvedUrlForBase(base);
          if (mapped) return mapped;
        }
        // 顺序尝试可用扩展名，跳过已知缺失
        for (const base of candidateBases) {
          for (const ext of iconExts) {
            const url = `${base}.${ext}`;
            if (!isUrlKnownMissing(url)) return url;
          }
        }
        // 全部失败：回退到名称 slug 的最后一种扩展
        return `${candidateBases[candidateBases.length - 1]}.${iconExts[iconExts.length - 1]}`;
      })();
  // 生成型头像 → 使用缓存，避免每次重算/字符串分配
  const [fallbackAvatarSrc, setFallbackAvatarSrc] = React.useState<string>(() => getAvatarSync(provider.name.toLowerCase(), provider.name, 20));
  React.useEffect(() => {
    ensureAvatarInMemory(provider.name.toLowerCase(), provider.name, 20)
      .then((v)=> setFallbackAvatarSrc(v))
      .catch(()=>{});
  }, [provider.name]);

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
    if (modelsForDisplay) {
      modelsForDisplay.forEach((model: ModelMetadata) => {
        obj[model.name] = model.api_key || '';
      });
    }
    setLocalModelApiKeys(obj);
  }, [provider.api_base_url, provider.default_api_key, modelsForDisplay]);

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
    // 去重：仓库 + 当前展示列表双重校验
    const lower = raw.toLowerCase();
    const existsInDisplay = (modelsForDisplay || []).some((m:any)=> (m.name||'').toLowerCase() === lower);
    if (existsInDisplay) {
      toast.error('模型已存在', { description: raw });
      return;
    }
    const { modelRepository } = await import('@/lib/provider/ModelRepository');
    const repoList = (await modelRepository.get(provider.name)) || [];
    const existsInRepo = repoList.some((m:any)=> (m.name||'').toLowerCase() === lower);
    if (existsInRepo) {
      toast.error('模型已存在', { description: raw });
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
      // 直接清空输入并提示，列表通过仓库订阅即时更新
      setNewModelId('');
      // 保持焦点，便于连续添加
      try { newModelInputRef.current?.focus(); } catch {}
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
      { key: 'no-delta', show: !!caps.notSupportTextDelta, title: '不支持文本增量(流式)', Icon: Ban },
      { key: 'no-system', show: !!caps.notSupportSystemMessage, title: '不支持 System Message', Icon: MessageSquareOff },
    ];
    return (
      <div className="flex items-center flex-wrap gap-1 text-gray-500 dark:text-gray-400">
        {showDetailCaps && items.filter(i=>i.show).map(i => (
          <TooltipProvider key={i.key} delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center justify-center h-5 w-5 rounded-md bg-gray-100 dark:bg-gray-700/50">
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
                <span className="inline-flex items-center justify-center h-5 w-5 rounded-md bg-red-50 dark:bg-red-900/30">
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

  // 搜索关键字高亮
  const highlightText = (text: string, keyword: string) => {
    if (!keyword) return text;
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const reg = new RegExp(escaped, 'ig');
    return text.replace(reg, (m) => `<mark class="bg-yellow-200 dark:bg-yellow-800 text-current">${m}</mark>`);
  };

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

  // 添加模型弹窗组件（名称 + ID）
  function AddModelDialog({ providerName, onAdded }: { providerName: string; onAdded?: () => void }) {
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ id: '', label: '' });
    const [saving, setSaving] = useState(false);

    const submit = async () => {
      const id = (form.id || '').trim();
      const label = (form.label || '').trim();
      if (!id) { toast.error('请输入模型 ID'); return; }
      setSaving(true);
      try {
        const list = (await modelRepository.get(providerName)) || [];
        const exists = list.some((m: any)=> m.name.toLowerCase() === id.toLowerCase());
        if (exists) { toast.error('模型已存在'); setSaving(false); return; }
        const next = [...list, { provider: providerName, name: id, label: label || undefined, aliases: [id] } as any];
        await modelRepository.save(providerName, next);
        toast.success('已添加模型', { description: label || id });
        setOpen(false); setForm({ id: '', label: '' }); onAdded?.();
      } catch (e:any) {
        console.error(e); toast.error('添加模型失败', { description: e?.message || String(e) });
      }
      setSaving(false);
    };

    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button type="button" size="sm" variant="soft" className="h-8 text-xs">添加模型</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>添加模型</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">模型名称（显示名，可选）</label>
              <input className="w-full h-9 px-3 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm" value={form.label} onChange={e=>setForm(s=>({...s, label: e.target.value}))} placeholder="如：Gemini 2.5 Pro" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">模型 ID</label>
              <input className="w-full h-9 px-3 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm" value={form.id} onChange={e=>setForm(s=>({...s, id: e.target.value}))} placeholder="如：gemini-2.5-pro" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={()=>setOpen(false)} disabled={saving}>取消</Button>
            <Button onClick={submit} disabled={saving}>{saving? '保存中…' : '确定添加'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  function RenameModelDialog({ providerName, modelName, currentLabel }: { providerName: string; modelName: string; currentLabel?: string }) {
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState(currentLabel || '');
    useEffect(()=>{ if(open) setValue(currentLabel || ''); }, [open, currentLabel]);
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <DropdownMenuItem onSelect={(e:any)=>e?.preventDefault?.()}>重命名</DropdownMenuItem>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>重命名模型</DialogTitle>
          </DialogHeader>
          <div>
            <label className="block text-xs text-gray-500 mb-1">新名称</label>
            <input className="w-full h-9 px-3 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm" value={value} onChange={e=>setValue(e.target.value)} placeholder="输入新的显示名" />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={()=>setOpen(false)}>取消</Button>
            <Button onClick={async()=>{ await commitRename(modelName, value); setOpen(false); }}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

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
      { label: '不支持流式增量', bad: !!caps.notSupportTextDelta },
      { label: '不支持 System Message', bad: !!caps.notSupportSystemMessage },
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
      <Collapsible open={isOpen} onOpenChange={(open)=>{ setIsOpen(open); onOpenChange?.(open); }} className="border border-gray-200/60 dark:border-gray-700/50 rounded-xl overflow-hidden bg-white/80 dark:bg-gray-800/30 shadow-sm hover:shadow-md transition-colors">
      <div className="flex items-center justify-between w-full px-4 py-3 bg-white/80 dark:bg-gray-800/40 backdrop-blur-[2px] hover:bg-white/90 dark:hover:bg-gray-800/50 transition-colors cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
        <div className="flex items-center gap-2 flex-grow min-w-0 mr-3">
            <div className={cn(
              "flex items-center justify-center w-8 h-8 rounded-lg text-lg flex-shrink-0 ring-1 ring-gray-200/70 dark:ring-gray-700/60 bg-gray-50"
            )}>
              {/* 优先显示 provider.icon（支持 data:image 或 /llm-provider-icon 路径），失败回退到生成头像 */}
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
                        markUrlMissing(resolvedIconSrc);
                        if (iconExtIdx < iconExts.length - 1) {
                          setIconExtIdx((i) => i + 1);
                        } else {
                          setIconError(true);
                        }
                      } else { setIconError(true); }
                    }}
                  />
                );
                }
                // 回退：生成头像，确保自定义 provider 总是有图标
                return (
                  <Image
                    src={fallbackAvatarSrc}
                    alt={`${provider.name} 图标`}
                    width={20}
                    height={20}
                    className="w-5 h-5 text-gray-800 dark:text-gray-200 rounded-sm"
                  />
                );
              })()}
            </div>
            <div className="flex-grow min-w-0">
              <span className="font-semibold text-base text-gray-800 dark:text-gray-200 block truncate">
                {provider.name}
                {/* 删除“新增”标志，保持干净 */}
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
          {/* 服务地址输入框和重置按钮（行内标签） */}
          <div className="group mb-2 flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 w-28 mb-0">
              服务地址
            </label>
            <div className="flex-1 flex items-center gap-2">
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
            <div className="flex items-center gap-2">
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
                wrapperClassName="mb-0 flex-1"
                icon={<KeyRound className="w-4 h-4 text-gray-400" />}
                inline
                labelWidthClassName="w-28"
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
                    className={`p-1 h-6 w-6 rounded-md flex items-center justify-center ${filterThinking? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300':'bg-gray-100 text-gray-500 dark:bg-gray-700/50 dark:text-gray-300'}`}
                    title="仅显示支持思考的模型"
                  >
                    <Brain className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={()=>setFilterTools(v=>!v)}
                    className={`p-1 h-6 w-6 rounded-md flex items-center justify-center ${filterTools? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300':'bg-gray-100 text-gray-500 dark:bg-gray-700/50 dark:text-gray-300'}`}
                    title="仅显示支持工具调用的模型"
                  >
                    <Workflow className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={()=>setFilterVision(v=>!v)}
                    className={`p-1 h-6 w-6 rounded-md flex items-center justify-center ${filterVision? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300':'bg-gray-100 text-gray-500 dark:bg-gray-700/50 dark:text-gray-300'}`}
                    title="仅显示支持视觉的模型"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {/* 取消单独筛选入口：输入框即筛选 */}
            </div>
            {/* 添加模型 → 弹窗：名称 + ID；输入框保留为筛选 */}
            {canAddModels && (
              <div className="flex items-center gap-2 my-2">
                <Input
                  ref={newModelInputRef as any}
                  value={modelSearch}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setModelSearch(e.target.value); }}
                  placeholder="输入以筛选模型…"
                  className="h-8 text-sm"
                />
                <AddModelDialog providerName={provider.name} onAdded={()=> setModelSearch('')} />
              </div>
            )}
            {/* 始终显示全部自定义模型，避免“展开更多”造成困惑 */}
            {modelsForDisplay && modelsForDisplay.length > 0 ? (
              <div className="space-y-3">
                {(() => {
                  const filtered = modelsForDisplay.filter((m: ModelMetadata) => {
                    const displayText = (m.label || m.name || '').toLowerCase();
                    if (!displayText.includes(modelSearch.toLowerCase())) return false;
                    if (!filterThinking && !filterTools && !filterVision) return true;
                    const caps = getModelCapabilities(m.name);
                    if (filterThinking && !caps.supportsThinking) return false;
                    if (filterTools && !caps.supportsFunctionCalling) return false;
                    if (filterVision && !caps.supportsVision) return false;
                    return true;
                  });
                  const toShow = filtered; // 展示全部，取消“展开更多”

                  // 分组：静态模型 vs 自定义模型
                  const { getStaticModels } = require('@/lib/provider/staticModels');
                  const staticList = getStaticModels(provider.name) || getStaticModels((provider as any).aliases?.[0] || provider.name) || [];
                  const staticIds = new Set(staticList.map((m: any) => m.id));
                  const staticModels = toShow.filter((m: ModelMetadata) => staticIds.has(m.name));
                  const customModels = toShow.filter((m: ModelMetadata) => !staticIds.has(m.name));

                  const commitRename = async (modelName: string, nextLabelRaw: string) => {
                    const nextLabel = (nextLabelRaw || '').trim();
                    setEditingModel({ id: null, value: '' });
                    if (!nextLabel) return; // 空值则忽略
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

                  const renderItem = (model: ModelMetadata) => (
                    <div key={model.name} className="flex items-center gap-1.5 pl-2 border-l-2 border-indigo-200 dark:border-indigo-700 py-0.5" style={{ paddingLeft: 6 }}>
                      <div className="flex flex-row items-center justify-start flex-auto min-w-0 pr-2 gap-1.5 text-[12px]">
                        <button
                          type="button"
                          className="text-left text-[12px] font-medium text-gray-700 dark:text-gray-300 truncate hover:underline"
                          title={(model.label || model.name) + '（点击复制ID）'}
                          onClick={async()=>{ try { await navigator.clipboard.writeText(model.name); toast.success('已复制模型 ID'); } catch { toast.error('复制失败'); } }}
                          dangerouslySetInnerHTML={{ __html: highlightText(model.label || model.name, modelSearch) }}
                        />
                        {isMultiStrategyProvider && (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-400">策:</span>
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
                              <SelectTrigger className="h-6 w-56 text-[11px]">
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
                        {lastUsedMap[model.name] && (
                          <span className="text-[10px] text-gray-400 whitespace-nowrap">{lastUsedMap[model.name]}</span>
                        )}
                      </div>

                      {/* 三点菜单：参数设置 / 重命名 / 删除 */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="h-5 w-5 flex items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="bottom" align="end" className="min-w-[180px]">
                          <DropdownMenuItem onSelect={(e:any)=>{ e?.preventDefault?.(); handleOpenParameters(model.name, model.label); }}>
                            <span className="inline-flex items-center gap-2 text-[12px]"><SlidersHorizontal className="w-3.5 h-3.5" /> 参数</span>
                          </DropdownMenuItem>
                          <RenameModelDialog providerName={provider.name} modelName={model.name} currentLabel={model.label} />
                          {/* 仅允许删除“用户新增模型”，静态模型不显示删除 */}
                          {(() => {
                            const { getStaticModels } = require('@/lib/provider/staticModels');
                            const staticList = getStaticModels(provider.name) || getStaticModels((provider as any).aliases?.[0] || provider.name) || [];
                            const isStatic = staticList.some((m: any) => m.id === model.name);
                            if (isStatic) return null;
                            return (
                              <>
                                <DropdownMenuSeparator />
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <DropdownMenuItem variant="destructive" onSelect={(e:any)=>e?.preventDefault?.()}>删除模型</DropdownMenuItem>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>确认删除该模型？</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        该操作仅删除本地配置中的“用户新增模型”条目，不会影响远端服务。删除后可再次手动添加。
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>取消</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={async () => {
                                          try {
                                            const { modelRepository } = await import('@/lib/provider/ModelRepository');
                                            const list = (await modelRepository.get(provider.name)) || [];
                                            const next = list.filter((m: any) => m.name !== model.name);
                                            await modelRepository.save(provider.name, next);
                                            toast.success('已删除模型', { description: model.name });
                                          } catch (e) {
                                            console.error(e);
                                            toast.error('删除模型失败');
                                          }
                                        }}
                                      >
                                        确认删除
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            );
                          })()}
                        </DropdownMenuContent>
                      </DropdownMenu>

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
                  );

                  return (
                    <>
                      {customModels.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 pl-2">
                            <span className="font-medium">自定义模型</span>
                            <span className="opacity-60">· {customModels.length} 个</span>
                          </div>
                          {customModels.slice(0, 5).map(renderItem)}
                          {customModels.length > 5 && (
                            <button type="button" onClick={()=>setGroupExpanded(prev=>({ ...prev, custom: !prev.custom }))} className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline pl-2">
                              {groupExpanded.custom ? '收起' : `展开更多`}
                            </button>
                          )}
                          {groupExpanded.custom && customModels.length > 5 && customModels.slice(5).map(renderItem)}
                          {staticModels.length > 0 && <div className="h-px bg-gray-200 dark:bg-gray-700 my-2" />}
                        </div>
                      )}
                      {staticModels.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 pl-2">
                            <span className="font-medium">默认模型</span>
                            <span className="opacity-60">· {staticModels.length} 个</span>
                          </div>
                          {staticModels.slice(0, 5).map(renderItem)}
                          {staticModels.length > 5 && (
                            <button type="button" onClick={()=>setGroupExpanded(prev=>({ ...prev, builtin: !prev.builtin }))} className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline pl-2">
                              {groupExpanded.builtin ? '收起' : `展开更多`}
                            </button>
                          )}
                          {groupExpanded.builtin && staticModels.length > 5 && staticModels.slice(5).map(renderItem)}
                        </div>
                      )}
                    </>
                  );
                })()}
                {/* 展开/收起 已移除：始终展示全部模型，避免误解 */}
              </div>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400 py-2 pl-2">
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