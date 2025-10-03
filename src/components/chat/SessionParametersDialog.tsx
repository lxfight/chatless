"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, Settings, Check, HelpCircle, Plus, X, Search, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { ModelParametersService } from "@/lib/model-parameters";
import type { ModelParameters } from "@/types/model-params";
import { DEFAULT_MODEL_PARAMETERS, MODEL_PARAMETER_LIMITS } from "@/types/model-params";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { usePromptStore } from "@/store/promptStore";
import { useChatStore } from "@/store/chatStore";
import { toast } from "@/components/ui/sonner";

interface SessionParametersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerName: string;
  modelId: string;
  modelLabel?: string;
  conversationId: string; // 会话ID
  onParametersChange: (parameters: ModelParameters) => void;
  currentParameters?: ModelParameters;
}

export function SessionParametersDialog({
  open,
  onOpenChange,
  providerName,
  modelId,
  modelLabel,
  conversationId,
  onParametersChange,
  currentParameters
}: SessionParametersDialogProps) {
  // 自定义参数类型
  interface CustomParameter {
    key: string;
    value: string;
    asString: boolean; // 是否强制作为字符串处理
  }

  const [parameters, setParameters] = useState<ModelParameters>(DEFAULT_MODEL_PARAMETERS);
  const [stopSequences, setStopSequences] = useState<string[]>([]);
  const [customParameters, setCustomParameters] = useState<CustomParameter[]>([]);
  const [modelInheritedParameters, setModelInheritedParameters] = useState<CustomParameter[]>([]); // 仅展示用途
  const [modelParamsState, setModelParamsState] = useState<ModelParameters | null>(null);
  const [parameterSource, setParameterSource] = useState<'default' | 'model' | 'session'>('default');
  const [hasChanges, setHasChanges] = useState(false);
  const [previewJson, setPreviewJson] = useState<string>('{}');

  // —— 提示词 Tab 相关 ——
  const [activeTab, setActiveTab] = useState<'prompt' | 'params'>('prompt');
  const NONE_VALUE = '__none__';
  const CUSTOM_VALUE = '__custom__';
  const prompts = usePromptStore((s)=>s.prompts);
  const createPrompt = usePromptStore((s)=>s.createPrompt as any);
  const updatePrompt = usePromptStore((s)=>s.updatePrompt as any);
  const updateConversation = useChatStore((s)=>s.updateConversation);
  const [systemPromptText, setSystemPromptText] = useState<string>('');
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(CUSTOM_VALUE);
  const [promptName, setPromptName] = useState<string>('');
  const [nameInvalid, setNameInvalid] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState<boolean>(false);

  const sortedPrompts = (prompts || []).slice().sort((a: any, b: any) => (b?.stats?.uses || 0) - (a?.stats?.uses || 0));
  
  const filteredPrompts = sortedPrompts.filter((p: any) => {
    const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.content || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFavorite = !showFavoritesOnly || p.isFavorite;
    return matchesSearch && matchesFavorite;
  });

  // 打开时尝试回填当前会话已应用的系统提示词
  useEffect(() => {
    if (!open || !conversationId) return;
    try {
      const conv = useChatStore.getState().conversations.find(c=>c.id===conversationId);
      const applied = conv?.system_prompt_applied;
      if (applied?.promptId) {
        const p = (usePromptStore.getState().prompts || []).find(pp=>pp.id===applied.promptId);
        if (p) {
          setSelectedPromptId(p.id);
          setSystemPromptText(p.content || '');
          setPromptName(p.name || '');
        } else {
          setSelectedPromptId(CUSTOM_VALUE);
          setSystemPromptText('');
          setPromptName('');
        }
      } else {
        setSelectedPromptId(CUSTOM_VALUE);
        setSystemPromptText('');
        setPromptName('');
      }
    } catch { setSystemPromptText(''); }
  }, [open, conversationId]);

  // 备用：自动命名保存（当前未直接使用，保留供其他入口复用）
  const _savePromptFromText = () => {
    const text = (systemPromptText || '').trim();
    if (!text) { toast.error('请输入要保存的系统提示词'); return; }
    const firstLine = text.split('\n')[0] || '';
    const name = (firstLine.slice(0, 24) || '系统提示词') + ' · ' + new Date().toLocaleTimeString();
    try {
      const id = createPrompt({ name, description: '会话参数设置中保存', content: text, tags: ['system'] });
      toast.success('已保存到提示词列表');
      return id as string;
    } catch {
      toast.error('保存提示词失败');
      return undefined;
    }
  };

  const savePromptFromTextWithName = (name: string) => {
    const text = (systemPromptText || '').trim();
    if (!text) { toast.error('请输入要保存的系统提示词'); return; }
    try {
      const id = createPrompt({ name, description: '会话参数设置中保存', content: text, tags: ['system'] });
      toast.success('已保存到提示词列表');
      return id as string;
    } catch { toast.error('保存提示词失败'); return undefined; }
  };

  const applyPromptIdToConversation = (pid: string) => {
    if (!conversationId || !pid) return;
    try {
      updateConversation(conversationId, { system_prompt_applied: { promptId: pid, mode: 'permanent' } as any });
      toast.success('已应用到当前会话');
    } catch { toast.error('应用提示词失败'); }
  };

  // 仅当点击按钮时才应用（不在列表点击时自动应用）
  const handleSaveAndApply = () => {
    if (selectedPromptId === NONE_VALUE) {
      try { updateConversation(conversationId, { system_prompt_applied: null } as any); toast.success('已清除会话提示词'); } catch { /* noop */ }
      return;
    }

    if (!promptName.trim()) { setNameInvalid(true); toast.error('请填写提示词名称'); return; }

    const current = (prompts || []).find((p: any) => p.id === selectedPromptId || false);
    if (current && (current.content !== systemPromptText || current.name !== promptName)) {
      const overwrite = confirm('内容或名称有更改。确定覆盖原提示词，取消则新建提示词。');
      if (overwrite) {
        try { updatePrompt(current.id, { name: promptName.trim(), content: systemPromptText }); setSelectedPromptId(current.id); toast.success('已覆盖原提示词'); applyPromptIdToConversation(current.id); } catch { toast.error('覆盖失败'); }
      } else {
        const id = savePromptFromTextWithName(promptName.trim());
        if (id) { setSelectedPromptId(id); applyPromptIdToConversation(id); }
      }
      return;
    }

    if (!current) {
      const id = savePromptFromTextWithName(promptName.trim());
      if (id) { setSelectedPromptId(id); applyPromptIdToConversation(id); }
      return;
    }

    applyPromptIdToConversation(current.id);
  };

  // 保存按钮的“覆盖或新建”逻辑
  // 旧的合并逻辑已被 handleSaveAndApply 收敛；保留空函数以兼容引用
  const _saveWithMergeStrategy = () => { /* deprecated */ };

  // 检查参数是否有变更
  const checkForChanges = (currentParams: ModelParameters) => {
    let baseParams: ModelParameters;
    
    // 根据参数来源确定基准参数
    switch (parameterSource) {
      case 'session':
        // 会话参数：与当前会话参数比较（即没有变化）
        baseParams = currentParams;
        break;
      case 'model':
        // 模型参数：与模型默认参数比较
        ModelParametersService.getModelParameters(providerName, modelId).then(modelParams => {
          if (modelParams) {
            const hasParameterChanges = 
              currentParams.temperature !== modelParams.temperature ||
              currentParams.maxTokens !== modelParams.maxTokens ||
              currentParams.topP !== modelParams.topP ||
              currentParams.frequencyPenalty !== modelParams.frequencyPenalty ||
              currentParams.presencePenalty !== modelParams.presencePenalty ||
              JSON.stringify(currentParams.stopSequences || []) !== JSON.stringify(modelParams.stopSequences || []);
            setHasChanges(hasParameterChanges);
          } else {
            setHasChanges(false);
          }
        }).catch(() => setHasChanges(false));
        return; // 异步处理，直接返回
      case 'default':
      default:
        // 系统默认参数：与系统默认参数比较
        baseParams = DEFAULT_MODEL_PARAMETERS;
        break;
    }
    
    // 同步比较
    const hasParameterChanges = 
      currentParams.temperature !== baseParams.temperature ||
      currentParams.maxTokens !== baseParams.maxTokens ||
      currentParams.topP !== baseParams.topP ||
      currentParams.frequencyPenalty !== baseParams.frequencyPenalty ||
      currentParams.presencePenalty !== baseParams.presencePenalty ||
      JSON.stringify(currentParams.stopSequences || []) !== JSON.stringify(baseParams.stopSequences || []);
    
    setHasChanges(hasParameterChanges);
  };

  // 监听参数变更
  useEffect(() => {
    checkForChanges(parameters);
  }, [parameters, stopSequences]);

  // 加载参数
  useEffect(() => {
    if (open && conversationId) {
      loadParameters();
    }
  }, [open, providerName, modelId, conversationId, currentParameters]);

  // 计算百分比工具
  const calcPercent = (value: number, min: number, max: number) => {
    if (max === min) return 0;
    return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  };

  // 智能类型转换
  const convertValue = (value: string, asString: boolean = false): any => {
    if (asString) return value;
    
    // 尝试转换为数字
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && isFinite(numValue) && value.trim() !== '') {
      return numValue;
    }
    
    // 尝试转换为布尔值
    const lowerValue = value.toLowerCase().trim();
    if (lowerValue === 'true') return true;
    if (lowerValue === 'false') return false;
    
    // 默认为字符串
    return value;
  };

  // 生成预览JSON
  const generatePreviewJson = () => {
    // 会话级选项
    const sessionOpt: any = {};
    if (parameters.enableTemperature !== false) sessionOpt.temperature = parameters.temperature;
    if (parameters.enableMaxTokens !== false) sessionOpt.maxTokens = parameters.maxTokens;
    if (parameters.enableTopP !== false) sessionOpt.topP = parameters.topP;
    if (parameters.enableTopK !== false) sessionOpt.topK = parameters.topK;
    if (parameters.enableMinP !== false) sessionOpt.minP = parameters.minP;
    if (parameters.enableFrequencyPenalty !== false) sessionOpt.frequencyPenalty = parameters.frequencyPenalty;
    if (parameters.enablePresencePenalty !== false) sessionOpt.presencePenalty = parameters.presencePenalty;
    if (parameters.enableStopSequences !== false && stopSequences.length > 0) sessionOpt.stop = stopSequences;

    customParameters.forEach(param => {
      if (param.key && param.value !== '') {
        sessionOpt[param.key] = convertValue(param.value, param.asString);
      }
    });

    // 模型级选项（若已加载）
    let modelOpt: any = {};
    if (modelParamsState) {
      // 使用与发送路径一致的规则
      const { ModelParametersService } = require('@/lib/model-parameters');
      modelOpt = ModelParametersService.convertToChatOptions(modelParamsState);

      // 如果会话层显式禁用某项，则从模型继承集中移除
      const maybeDelete = (flag: boolean | undefined, key: string) => {
        if (flag === false && key in modelOpt) delete modelOpt[key];
      };
      const sp: any = parameters as any;
      maybeDelete(sp.enableTemperature, 'temperature');
      maybeDelete(sp.enableMaxTokens, 'maxTokens');
      maybeDelete(sp.enableTopP, 'topP');
      maybeDelete(sp.enableTopK, 'topK');
      maybeDelete(sp.enableMinP, 'minP');
      maybeDelete(sp.enableFrequencyPenalty, 'frequencyPenalty');
      maybeDelete(sp.enablePresencePenalty, 'presencePenalty');
      maybeDelete(sp.enableStopSequences, 'stop');
    }

    const merged = { ...modelOpt, ...sessionOpt };
    return JSON.stringify(merged, null, 2);
  };

  // 更新预览JSON
  useEffect(() => {
    setPreviewJson(generatePreviewJson());
  }, [parameters, stopSequences, customParameters]);

  const loadParameters = async () => {
    try {
      // 优先级：当前会话参数 > 已保存的会话参数 > 模型默认参数 > 系统默认参数
      if (currentParameters) {
        setParameters(currentParameters);
        setStopSequences(currentParameters.stopSequences || []);
        setParameterSource('session');
        // 加载模型参数用于继承展示与预览合成
        const mp = await ModelParametersService.getModelParameters(providerName, modelId);
        setModelParamsState(mp);
        // 计算未被会话覆盖的模型自定义参数
        const sessionAdv = currentParameters.advancedOptions || {};
        const inherited: CustomParameter[] = [];
        if (mp.advancedOptions && typeof mp.advancedOptions === 'object') {
          Object.entries(mp.advancedOptions).forEach(([key, value]) => {
            if (!(key in (sessionAdv as any))) {
              inherited.push({ key, value: String(value), asString: typeof value === 'string' });
            }
          });
        }
        setModelInheritedParameters(inherited);
      } else {
        // 尝试加载已保存的会话参数
        const sessionParams = await ModelParametersService.getSessionParameters(conversationId);
        if (sessionParams) {
          setParameters(sessionParams);
          setStopSequences(sessionParams.stopSequences || []);
          setParameterSource('session');
          // 恢复自定义参数
          if (sessionParams.advancedOptions && typeof sessionParams.advancedOptions === 'object') {
            const customParams: CustomParameter[] = [];
            Object.entries(sessionParams.advancedOptions).forEach(([key, value]) => {
              // 检查是否应该强制作为字符串处理（如果是字符串且看起来像数字或布尔值）
              const stringValue = String(value);
              let asString = false;
              if (typeof value === 'string') {
                const numValue = parseFloat(stringValue);
                const isNumeric = !isNaN(numValue) && isFinite(numValue) && stringValue.trim() !== '';
                const isBoolean = stringValue.toLowerCase() === 'true' || stringValue.toLowerCase() === 'false';
                // 如果字符串看起来像数字或布尔值但被保存为字符串，标记为asString
                asString = isNumeric || isBoolean;
              }
              customParams.push({ key, value: stringValue, asString });
            });
            setCustomParameters(customParams);
          }
          const mp = await ModelParametersService.getModelParameters(providerName, modelId);
          setModelParamsState(mp);
          // 仅作为未覆盖提示
          const inherited: CustomParameter[] = [];
          const sessionKeys = new Set(Object.keys(sessionParams.advancedOptions || {}));
          if (mp.advancedOptions && typeof mp.advancedOptions === 'object') {
            Object.entries(mp.advancedOptions).forEach(([key, value]) => {
              if (!sessionKeys.has(key)) inherited.push({ key, value: String(value), asString: typeof value === 'string' });
            });
          }
          setModelInheritedParameters(inherited);
        } else {
          // 尝试加载模型默认参数
          const modelParams = await ModelParametersService.getModelParameters(providerName, modelId);
          if (modelParams && modelParams !== DEFAULT_MODEL_PARAMETERS) {
            setParameters(modelParams);
            setStopSequences(modelParams.stopSequences || []);
            setParameterSource('model');
            setModelParamsState(modelParams);
            // 自定义参数不直接写入，以避免无意中“覆盖”继承；展示为“继承自模型”的候选
            const inherited: CustomParameter[] = [];
            if (modelParams.advancedOptions && typeof modelParams.advancedOptions === 'object') {
              Object.entries(modelParams.advancedOptions).forEach(([key, value]) => {
                inherited.push({ key, value: String(value), asString: typeof value === 'string' });
              });
            }
            setModelInheritedParameters(inherited);
          } else {
            setParameters(DEFAULT_MODEL_PARAMETERS);
            setStopSequences([]);
            setParameterSource('default');
            setModelParamsState(null);
            setModelInheritedParameters([]);
          }
        }
      }
    } catch (error) {
      console.error('加载参数失败:', error);
      setParameters(DEFAULT_MODEL_PARAMETERS);
      setStopSequences([]);
      setParameterSource('default');
      setModelParamsState(null);
      setModelInheritedParameters([]);
    }
  };

  // 即时应用参数（不关闭对话框）
  const handleApplyImmediate = async (params: ModelParameters) => {
    try {
      // 处理自定义参数
      const customOptions: Record<string, any> = {};
      customParameters.forEach(param => {
        if (param.key && param.value !== '') {
          customOptions[param.key] = convertValue(param.value, param.asString);
        }
      });

      const sessionParams = {
        ...params,
        stopSequences,
        advancedOptions: customOptions,
      };
      
      // 保存会话参数到存储
      await ModelParametersService.setSessionParameters(conversationId, sessionParams);
      
      // 通知父组件参数变更
      onParametersChange(sessionParams);
    } catch (error) {
      console.error('应用会话参数失败:', error);
    }
  };

  // 辅助函数：更新参数并即时应用
  const updateParameter = (key: string, value: any) => {
    const newParams = { ...parameters, [key]: value };
    setParameters(newParams);
    handleApplyImmediate(newParams);
  };


  const handleResetToModelDefault = async () => {
    try {
      const modelParams = await ModelParametersService.getModelParameters(providerName, modelId);
      if (modelParams) {
        setParameters(modelParams);
        setStopSequences(modelParams.stopSequences || []);
        setParameterSource('model');
      } else {
        setParameters(DEFAULT_MODEL_PARAMETERS);
        setStopSequences([]);
        setParameterSource('default');
      }
    } catch (error) {
      console.error('重置到模型默认参数失败:', error);
      setParameters(DEFAULT_MODEL_PARAMETERS);
      setStopSequences([]);
      setParameterSource('default');
    }
  };

  const handleResetToSystemDefault = () => {
    setParameters(DEFAULT_MODEL_PARAMETERS);
    setStopSequences([]);
    setParameterSource('default');
  };

  const handleClearSessionParameters = async () => {
    try {
      // 清除会话参数
      await ModelParametersService.removeSessionParameters(conversationId);
      
      // 清理为“完全不下发”的视觉状态：关闭所有开关，值显示为系统默认，仅作参考
      setParameters({
        ...DEFAULT_MODEL_PARAMETERS,
        enableTemperature: false,
        enableMaxTokens: false,
        enableTopP: false,
        enableFrequencyPenalty: false,
        enablePresencePenalty: false,
        enableStopSequences: false,
      } as any);
      setStopSequences([]);
      setParameterSource('default');
    } catch (error) {
      console.error('清除会话参数失败:', error);
      setParameters(DEFAULT_MODEL_PARAMETERS);
      setStopSequences([]);
      setParameterSource('default');
    }
  };

  // 自定义参数处理
  const addCustomParameter = () => {
    setCustomParameters(prev => [...prev, { key: '', value: '', asString: false }]);
  };

  // 将“继承自模型”的某项添加为会话覆盖
  const adoptInheritedParameter = (p: CustomParameter) => {
    setCustomParameters(prev => {
      if (prev.some(x => x.key === p.key)) return prev;
      return [...prev, { ...p }];
    });
    // 添加后从“继承提示”中移除该项
    setModelInheritedParameters(prev => prev.filter(x => x.key !== p.key));
  };

  const removeCustomParameter = (index: number) => {
    setCustomParameters(prev => prev.filter((_, i) => i !== index));
  };

  const updateCustomParameter = (index: number, field: keyof CustomParameter, value: string | boolean) => {
    setCustomParameters(prev => prev.map((param, i) => 
      i === index ? { ...param, [field]: value } : param
    ));
  };

  const getParameterSourceText = () => {
    switch (parameterSource) {
      case 'session':
        return '会话参数';
      case 'model':
        return '模型默认';
      case 'default':
        return '系统默认';
    }
  };

  const getParameterSourceColor = () => {
    switch (parameterSource) {
      case 'session':
        return 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300';
      case 'model':
        return 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-300';
      case 'default':
        return 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  // 旧的参数滑条已不再使用

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[90vw] p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <Settings className="w-5 h-5 text-blue-500 dark:text-blue-400" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  会话参数设置
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300">
                    {modelLabel || modelId}
                  </Badge>
                  <Badge className={cn("text-xs", getParameterSourceColor())}>
                    {getParameterSourceText()}
                  </Badge>
                  {hasChanges && (
                    <Badge variant="outline" className="text-xs text-blue-600 border-blue-200 dark:text-blue-400 dark:border-blue-800">
                      已修改
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  仅对当前会话生效；<span className="font-medium">未开启或未改动</span>的参数<strong>不会下发</strong>，由模型默认值接管。
                </p>
              </div>
            </div>
          
          </div>
        </DialogHeader>

        {/* Content with Tabs */}
        <Tabs value={activeTab} onValueChange={(v)=>setActiveTab(v as any)}>
          <div className="px-6 pt-3">
            <TabsList className="h-10">
              <TabsTrigger value="prompt" className="px-6 py-2 text-base">提示词</TabsTrigger>
              <TabsTrigger value="params" className="px-6 py-2 text-base">参数</TabsTrigger>
            </TabsList>
          </div>

          {/* 固定高度容器，避免切换抖动 */}
          {/* 提示词页：左侧侧边栏 + 右侧编辑区 */}
          <TabsContent value="prompt" className="mt-0">
            <div className="px-6 pb-4 h-[65vh] flex gap-5">
              {/* Sidebar */}
              <div className="w-72 shrink-0 h-full border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex flex-col bg-gray-50/50 dark:bg-gray-900/20">
                {/* 搜索和筛选 */}
                <div className="p-3 border-b border-gray-200 dark:border-gray-700 space-y-2 bg-white dark:bg-gray-900">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="搜索提示词..."
                      className="pl-9 h-9 text-sm bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:bg-white dark:focus:bg-gray-900"
                    />
                  </div>
                  <button
                    onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs rounded-md transition-colors",
                      showFavoritesOnly
                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                    )}
                  >
                    <Star className={cn("w-3.5 h-3.5", showFavoritesOnly && "fill-yellow-500")} />
                    {showFavoritesOnly ? "仅显示收藏" : "显示全部"}
                  </button>
                </div>

                {/* 提示词列表 */}
                <div className="flex-1 overflow-y-auto">
                  {filteredPrompts.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-400">
                      {searchQuery ? "未找到匹配的提示词" : "暂无提示词"}
                    </div>
                  ) : (
                    filteredPrompts.map((p: any) => (
                      <button
                        key={p.id}
                        className={cn(
                          "w-full text-left px-3 py-2.5 text-sm transition-all border-l-2",
                          selectedPromptId === p.id
                            ? "bg-blue-50 dark:bg-blue-900/20 border-l-blue-500 font-medium"
                            : "border-l-transparent hover:bg-gray-100 dark:hover:bg-gray-800"
                        )}
                        onClick={() => {
                          setSelectedPromptId(p.id);
                          setSystemPromptText(p.content || '');
                          setPromptName(p.name || '');
                          setNameInvalid(false);
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              {p.isFavorite && <Star className="w-3 h-3 fill-yellow-500 text-yellow-500 shrink-0" />}
                              <span className="truncate">{p.name}</span>
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              使用 {p?.stats?.uses || 0} 次
                            </div>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Editor */}
              <div className="flex-1 h-full flex flex-col overflow-hidden">
                {/* 操作按钮组 */}
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <Button
                    variant={selectedPromptId === CUSTOM_VALUE ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSelectedPromptId(CUSTOM_VALUE);
                      setSystemPromptText('');
                      setPromptName('');
                      setNameInvalid(false);
                    }}
                    className="gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    新建提示词
                  </Button>
                  <Button
                    variant={selectedPromptId === NONE_VALUE ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSelectedPromptId(NONE_VALUE);
                      setSystemPromptText('');
                      setPromptName('');
                      try {
                        updateConversation(conversationId, { system_prompt_applied: null } as any);
                      } catch { /* noop */ }
                    }}
                    className="gap-1.5"
                  >
                    <X className="w-4 h-4" />
                    不使用提示词
                  </Button>
                  {selectedPromptId && selectedPromptId !== CUSTOM_VALUE && selectedPromptId !== NONE_VALUE && (
                    <Badge variant="outline" className="ml-auto text-xs shrink-0">
                      当前：{(prompts || []).find((p: any) => p.id === selectedPromptId)?.name || '未知'}
                    </Badge>
                  )}
                </div>

                {/* 名称输入 */}
                <div className="mb-3">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                    提示词名称
                    {nameInvalid && <span className="text-red-500 ml-1">*必填</span>}
                  </Label>
                  <Input
                    value={promptName}
                    onChange={(e) => {
                      setPromptName(e.target.value);
                      if (nameInvalid && e.target.value.trim()) setNameInvalid(false);
                    }}
                    placeholder="请输入提示词名称"
                    className={cn(
                      "h-9 transition-all",
                      nameInvalid
                        ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                        : "border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-blue-500"
                    )}
                  />
                </div>

                {/* 内容输入 */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">系统提示词</Label>
                  <textarea
                    value={systemPromptText}
                    onChange={(e) => setSystemPromptText(e.target.value)}
                    className="w-full flex-1 resize-none rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    placeholder="为本会话设置系统提示词，可保存到提示词列表"
                  />
                </div>

                {/* 标签展示 */}
                {(() => {
                  const p = (prompts || []).find((x: any) => x.id === selectedPromptId);
                  const tags = p?.tags || [];
                  return tags.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {tags.map((t: string) => (
                        <Badge key={t} variant="secondary" className="text-xs">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  ) : null;
                })()}

                {/* 底部按钮 */}
                <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" onClick={handleSaveAndApply} className="gap-1.5">
                          <Check className="w-4 h-4" />
                          保存并应用
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">保存到提示词库并应用到当前会话</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <span className="text-xs text-gray-500">
                    提示词将应用于当前会话的所有消息
                  </span>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* 参数页：原有内容 */}
          <TabsContent value="params" className="mt-0">
        <TooltipProvider>
        <div className="px-6 py-2.5 space-y-3 h-[65vh] overflow-y-auto">
            {/* Temperature */}
            <div className="flex items-center gap-3">
              <Checkbox 
                checked={parameters.enableTemperature !== false}
                onCheckedChange={(checked) => updateParameter('enableTemperature', Boolean(checked))}
              />
              
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Label className={cn("text-sm font-medium", parameters.enableTemperature === false ? "text-gray-400" : "text-gray-700 dark:text-gray-300")}>
                  Temperature
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">控制输出的随机性。值越高越有创意，越低越确定。</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <input
                type="range"
                className={cn(
                  "flex-1 max-w-48 appearance-none h-1.5 rounded-full cursor-pointer",
                  "focus:outline-none focus:ring-0",
                  "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4",
                  "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white",
                  "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-500",
                  "[&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:transition-all",
                  "disabled:[&::-webkit-slider-thumb]:bg-gray-300 disabled:[&::-webkit-slider-thumb]:border-gray-400"
                )}
                min={MODEL_PARAMETER_LIMITS.temperature.min}
                max={MODEL_PARAMETER_LIMITS.temperature.max}
                step={MODEL_PARAMETER_LIMITS.temperature.step}
                value={parameters.temperature || 0}
                onChange={(e) => {
                  const newParams = { ...parameters, temperature: parseFloat(e.target.value) };
                  setParameters(newParams);
                }}
                onMouseUp={(e) => {
                  const newParams = { ...parameters, temperature: parseFloat((e.target as HTMLInputElement).value) };
                  handleApplyImmediate(newParams);
                }}
                style={{ 
                  background: parameters.enableTemperature === false
                    ? '#d1d5db'
                    : `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${calcPercent(parameters.temperature || 0, MODEL_PARAMETER_LIMITS.temperature.min, MODEL_PARAMETER_LIMITS.temperature.max)}%, #e5e7eb ${calcPercent(parameters.temperature || 0, MODEL_PARAMETER_LIMITS.temperature.min, MODEL_PARAMETER_LIMITS.temperature.max)}%, #e5e7eb 100%)`
                }}
                disabled={parameters.enableTemperature === false}
              />

              <Input
                type="number"
                className="w-20 h-8 text-sm"
                min={MODEL_PARAMETER_LIMITS.temperature.inputMin}
                max={MODEL_PARAMETER_LIMITS.temperature.inputMax}
                step={MODEL_PARAMETER_LIMITS.temperature.step}
                value={parameters.temperature || 0}
                onChange={(e) => {
                  const newParams = { ...parameters, temperature: parseFloat(e.target.value) || 0 };
                  setParameters(newParams);
                }}
                onBlur={(e) => {
                  const newParams = { ...parameters, temperature: parseFloat(e.target.value) || 0 };
                  handleApplyImmediate(newParams);
                }}
                disabled={parameters.enableTemperature === false}
              />
            </div>

            {/* Max Tokens */}
            <div className="flex items-center gap-3">
              <Checkbox 
                checked={parameters.enableMaxTokens !== false}
                onCheckedChange={(checked) => updateParameter('enableMaxTokens', Boolean(checked))}
              />
              
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Label className={cn("text-sm font-medium", parameters.enableMaxTokens === false ? "text-gray-400" : "text-gray-700 dark:text-gray-300")}>
                  Max Tokens
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">限制单次回复能生成的最大 Token 数。</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <input
                type="range"
                className={cn(
                  "flex-1 max-w-48 appearance-none h-1.5 rounded-full cursor-pointer",
                  "focus:outline-none focus:ring-0",
                  "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4",
                  "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white",
                  "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-500",
                  "[&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:transition-all",
                  "disabled:[&::-webkit-slider-thumb]:bg-gray-300 disabled:[&::-webkit-slider-thumb]:border-gray-400"
                )}
                min={MODEL_PARAMETER_LIMITS.maxTokens.min}
                max={MODEL_PARAMETER_LIMITS.maxTokens.max}
                step={MODEL_PARAMETER_LIMITS.maxTokens.step}
                value={parameters.maxTokens || 0}
                onChange={(e) => setParameters(prev => ({ ...prev, maxTokens: parseFloat(e.target.value) }))}
                style={{ 
                  background: parameters.enableMaxTokens === false
                    ? '#d1d5db'
                    : `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${calcPercent(parameters.maxTokens || 0, MODEL_PARAMETER_LIMITS.maxTokens.min, MODEL_PARAMETER_LIMITS.maxTokens.max)}%, #e5e7eb ${calcPercent(parameters.maxTokens || 0, MODEL_PARAMETER_LIMITS.maxTokens.min, MODEL_PARAMETER_LIMITS.maxTokens.max)}%, #e5e7eb 100%)`
                }}
                disabled={parameters.enableMaxTokens === false}
              />

              <Input
                type="number"
                className="w-20 h-8 text-sm"
                min={MODEL_PARAMETER_LIMITS.maxTokens.inputMin}
                max={MODEL_PARAMETER_LIMITS.maxTokens.inputMax}
                step={MODEL_PARAMETER_LIMITS.maxTokens.step}
                value={parameters.maxTokens || 0}
                onChange={(e) => setParameters(prev => ({ ...prev, maxTokens: parseInt(e.target.value) || 0 }))}
                disabled={parameters.enableMaxTokens === false}
              />
            </div>

            {/* Top P */}
            <div className="flex items-center gap-3">
              <Checkbox 
                checked={parameters.enableTopP !== false}
                onCheckedChange={(checked) => updateParameter('enableTopP', Boolean(checked))}
              />
              
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Label className={cn("text-sm font-medium", parameters.enableTopP === false ? "text-gray-400" : "text-gray-700 dark:text-gray-300")}>
                  Top P
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">从累计概率最高的候选中采样。越低越保守。与 Temperature 一般二选一调节。</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <input
                type="range"
                className={cn(
                  "flex-1 max-w-48 appearance-none h-1.5 rounded-full cursor-pointer",
                  "focus:outline-none focus:ring-0",
                  "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4",
                  "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white",
                  "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-500",
                  "[&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:transition-all",
                  "disabled:[&::-webkit-slider-thumb]:bg-gray-300 disabled:[&::-webkit-slider-thumb]:border-gray-400"
                )}
                min={MODEL_PARAMETER_LIMITS.topP.min}
                max={MODEL_PARAMETER_LIMITS.topP.max}
                step={MODEL_PARAMETER_LIMITS.topP.step}
                value={parameters.topP || 0}
                onChange={(e) => setParameters(prev => ({ ...prev, topP: parseFloat(e.target.value) }))}
                style={{ 
                  background: parameters.enableTopP === false
                    ? '#d1d5db'
                    : `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${calcPercent(parameters.topP || 0, MODEL_PARAMETER_LIMITS.topP.min, MODEL_PARAMETER_LIMITS.topP.max)}%, #e5e7eb ${calcPercent(parameters.topP || 0, MODEL_PARAMETER_LIMITS.topP.min, MODEL_PARAMETER_LIMITS.topP.max)}%, #e5e7eb 100%)`
                }}
                disabled={parameters.enableTopP === false}
              />

              <Input
                type="number"
                className="w-20 h-8 text-sm"
                min={MODEL_PARAMETER_LIMITS.topP.inputMin}
                max={MODEL_PARAMETER_LIMITS.topP.inputMax}
                step={MODEL_PARAMETER_LIMITS.topP.step}
                value={parameters.topP || 0}
                onChange={(e) => setParameters(prev => ({ ...prev, topP: parseFloat(e.target.value) || 0 }))}
                disabled={parameters.enableTopP === false}
              />
            </div>

            {/* Frequency Penalty */}
            <div className="flex items-center gap-3">
              <Checkbox 
                checked={parameters.enableFrequencyPenalty !== false}
                onCheckedChange={(checked) => updateParameter('enableFrequencyPenalty', Boolean(checked))}
              />
              
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Label className={cn("text-sm font-medium", parameters.enableFrequencyPenalty === false ? "text-gray-400" : "text-gray-700 dark:text-gray-300")}>
                  Frequency Penalty
              </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">增大可降低重复词汇的概率。</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <input
                type="range"
                className={cn(
                  "flex-1 max-w-48 appearance-none h-1.5 rounded-full cursor-pointer",
                  "focus:outline-none focus:ring-0",
                  "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4",
                  "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white",
                  "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-500",
                  "[&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:transition-all",
                  "disabled:[&::-webkit-slider-thumb]:bg-gray-300 disabled:[&::-webkit-slider-thumb]:border-gray-400"
                )}
                min={MODEL_PARAMETER_LIMITS.frequencyPenalty.min}
                max={MODEL_PARAMETER_LIMITS.frequencyPenalty.max}
                step={MODEL_PARAMETER_LIMITS.frequencyPenalty.step}
                value={parameters.frequencyPenalty || 0}
                onChange={(e) => setParameters(prev => ({ ...prev, frequencyPenalty: parseFloat(e.target.value) }))}
                style={{ 
                  background: parameters.enableFrequencyPenalty === false
                    ? '#d1d5db'
                    : `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${calcPercent(parameters.frequencyPenalty || 0, MODEL_PARAMETER_LIMITS.frequencyPenalty.min, MODEL_PARAMETER_LIMITS.frequencyPenalty.max)}%, #e5e7eb ${calcPercent(parameters.frequencyPenalty || 0, MODEL_PARAMETER_LIMITS.frequencyPenalty.min, MODEL_PARAMETER_LIMITS.frequencyPenalty.max)}%, #e5e7eb 100%)`
                }}
                disabled={parameters.enableFrequencyPenalty === false}
              />

              <Input
                type="number"
                className="w-20 h-8 text-sm"
                min={MODEL_PARAMETER_LIMITS.frequencyPenalty.inputMin}
                max={MODEL_PARAMETER_LIMITS.frequencyPenalty.inputMax}
                step={MODEL_PARAMETER_LIMITS.frequencyPenalty.step}
                value={parameters.frequencyPenalty || 0}
                onChange={(e) => setParameters(prev => ({ ...prev, frequencyPenalty: parseFloat(e.target.value) || 0 }))}
                disabled={parameters.enableFrequencyPenalty === false}
              />
            </div>

            {/* Presence Penalty */}
            <div className="flex items-center gap-3">
              <Checkbox 
                checked={parameters.enablePresencePenalty !== false}
                onCheckedChange={(checked) => updateParameter('enablePresencePenalty', Boolean(checked))}
              />
              
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Label className={cn("text-sm font-medium", parameters.enablePresencePenalty === false ? "text-gray-400" : "text-gray-700 dark:text-gray-300")}>
                  Presence Penalty
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">增大可鼓励模型引入新话题。</p>
                  </TooltipContent>
                </Tooltip>
          </div>

              <input
                type="range"
                className={cn(
                  "flex-1 max-w-48 appearance-none h-1.5 rounded-full cursor-pointer",
                  "focus:outline-none focus:ring-0",
                  "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4",
                  "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white",
                  "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-500",
                  "[&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:transition-all",
                  "disabled:[&::-webkit-slider-thumb]:bg-gray-300 disabled:[&::-webkit-slider-thumb]:border-gray-400"
                )}
                min={MODEL_PARAMETER_LIMITS.presencePenalty.min}
                max={MODEL_PARAMETER_LIMITS.presencePenalty.max}
                step={MODEL_PARAMETER_LIMITS.presencePenalty.step}
                value={parameters.presencePenalty || 0}
                onChange={(e) => setParameters(prev => ({ ...prev, presencePenalty: parseFloat(e.target.value) }))}
                style={{ 
                  background: parameters.enablePresencePenalty === false
                    ? '#d1d5db'
                    : `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${calcPercent(parameters.presencePenalty || 0, MODEL_PARAMETER_LIMITS.presencePenalty.min, MODEL_PARAMETER_LIMITS.presencePenalty.max)}%, #e5e7eb ${calcPercent(parameters.presencePenalty || 0, MODEL_PARAMETER_LIMITS.presencePenalty.min, MODEL_PARAMETER_LIMITS.presencePenalty.max)}%, #e5e7eb 100%)`
                }}
                disabled={parameters.enablePresencePenalty === false}
              />

              <Input
                type="number"
                className="w-20 h-8 text-sm"
                min={MODEL_PARAMETER_LIMITS.presencePenalty.inputMin}
                max={MODEL_PARAMETER_LIMITS.presencePenalty.inputMax}
                step={MODEL_PARAMETER_LIMITS.presencePenalty.step}
                value={parameters.presencePenalty || 0}
                onChange={(e) => setParameters(prev => ({ ...prev, presencePenalty: parseFloat(e.target.value) || 0 }))}
                disabled={parameters.enablePresencePenalty === false}
              />
            </div>

            {/* Top K */}
            <div className="flex items-center gap-3">
              <Checkbox 
                checked={parameters.enableTopK !== false}
                onCheckedChange={(checked) => updateParameter('enableTopK', Boolean(checked))}
              />
              
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Label className={cn("text-sm font-medium", parameters.enableTopK === false ? "text-gray-400" : "text-gray-700 dark:text-gray-300")}>
                  Top K
              </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">从概率最高的 K 个候选词中选择。值越小越保守。</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <input
                type="range"
                className={cn(
                  "flex-1 max-w-48 appearance-none h-1.5 rounded-full cursor-pointer",
                  "focus:outline-none focus:ring-0",
                  "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4",
                  "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white",
                  "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-500",
                  "[&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:transition-all",
                  "disabled:[&::-webkit-slider-thumb]:bg-gray-300 disabled:[&::-webkit-slider-thumb]:border-gray-400"
                )}
                min={MODEL_PARAMETER_LIMITS.topK.min}
                max={MODEL_PARAMETER_LIMITS.topK.max}
                step={MODEL_PARAMETER_LIMITS.topK.step}
                value={parameters.topK || 0}
                onChange={(e) => setParameters(prev => ({ ...prev, topK: parseInt(e.target.value) }))}
                style={{ 
                  background: parameters.enableTopK === false
                    ? '#d1d5db'
                    : `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${calcPercent(parameters.topK || 0, MODEL_PARAMETER_LIMITS.topK.min, MODEL_PARAMETER_LIMITS.topK.max)}%, #e5e7eb ${calcPercent(parameters.topK || 0, MODEL_PARAMETER_LIMITS.topK.min, MODEL_PARAMETER_LIMITS.topK.max)}%, #e5e7eb 100%)`
                }}
                disabled={parameters.enableTopK === false}
              />

              <Input
                type="number"
                className="w-20 h-8 text-sm"
                min={MODEL_PARAMETER_LIMITS.topK.inputMin}
                max={MODEL_PARAMETER_LIMITS.topK.inputMax}
                step={MODEL_PARAMETER_LIMITS.topK.step}
                value={parameters.topK || 0}
                onChange={(e) => setParameters(prev => ({ ...prev, topK: parseInt(e.target.value) || 0 }))}
                disabled={parameters.enableTopK === false}
              />
            </div>

            {/* Min P */}
            <div className="flex items-center gap-3">
              <Checkbox 
                checked={parameters.enableMinP !== false}
                onCheckedChange={(checked) => updateParameter('enableMinP', Boolean(checked))}
              />
              
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Label className={cn("text-sm font-medium", parameters.enableMinP === false ? "text-gray-400" : "text-gray-700 dark:text-gray-300")}>
                  Min P
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">最小概率阈值，过滤掉概率过低的候选词。</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <input
                type="range"
                className={cn(
                  "flex-1 max-w-48 appearance-none h-1.5 rounded-full cursor-pointer",
                  "focus:outline-none focus:ring-0",
                  "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4",
                  "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white",
                  "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-500",
                  "[&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:transition-all",
                  "disabled:[&::-webkit-slider-thumb]:bg-gray-300 disabled:[&::-webkit-slider-thumb]:border-gray-400"
                )}
                min={MODEL_PARAMETER_LIMITS.minP.min}
                max={MODEL_PARAMETER_LIMITS.minP.max}
                step={MODEL_PARAMETER_LIMITS.minP.step}
                value={parameters.minP || 0}
                onChange={(e) => setParameters(prev => ({ ...prev, minP: parseFloat(e.target.value) }))}
                style={{ 
                  background: parameters.enableMinP === false
                    ? '#d1d5db'
                    : `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${calcPercent(parameters.minP || 0, MODEL_PARAMETER_LIMITS.minP.min, MODEL_PARAMETER_LIMITS.minP.max)}%, #e5e7eb ${calcPercent(parameters.minP || 0, MODEL_PARAMETER_LIMITS.minP.min, MODEL_PARAMETER_LIMITS.minP.max)}%, #e5e7eb 100%)`
                }}
                disabled={parameters.enableMinP === false}
              />

              <Input
                type="number"
                className="w-20 h-8 text-sm"
                min={MODEL_PARAMETER_LIMITS.minP.inputMin}
                max={MODEL_PARAMETER_LIMITS.minP.inputMax}
                step={MODEL_PARAMETER_LIMITS.minP.step}
                value={parameters.minP || 0}
                onChange={(e) => setParameters(prev => ({ ...prev, minP: parseFloat(e.target.value) || 0 }))}
                disabled={parameters.enableMinP === false}
              />
          </div>

            {/* 自定义参数 */}
            <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">自定义参数</Label>
                <Button type="button" variant="outline" size="sm" onClick={addCustomParameter}>
                  <Plus className="w-4 h-4 mr-1" />
                  添加参数
                </Button>
              </div>
              
              {customParameters.map((param, index) => (
                <div key={index} className="flex items-center gap-2 p-3 border border-gray-200 dark:border-gray-700 rounded-md">
                  <Input
                    placeholder="参数名"
                    value={param.key}
                    onChange={(e) => updateCustomParameter(index, 'key', e.target.value)}
                    className="w-32 h-8 text-sm"
                  />
                  <Input
                    placeholder="参数值"
                    value={param.value}
                    onChange={(e) => updateCustomParameter(index, 'value', e.target.value)}
                    className="flex-1 h-8 text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={param.asString}
                      onCheckedChange={(checked) => updateCustomParameter(index, 'asString', Boolean(checked))}
                    />
                    <Label className="text-xs text-gray-500 whitespace-nowrap">使用字符串对待</Label>
                  </div>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm"
                    onClick={() => removeCustomParameter(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="w-4 h-4" />
              </Button>
            </div>
              ))}

            {modelInheritedParameters.length > 0 && (
              <div className="mt-2">
                <Label className="text-xs font-medium text-gray-500">继承自模型（未覆盖）</Label>
                <div className="mt-2 space-y-2">
                  {modelInheritedParameters.map((p) => (
                    <div key={p.key} className="flex items-center justify-between text-xs px-3 py-2 bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded">
                      <div className="truncate">
                        <span className="font-medium text-gray-700 dark:text-gray-200 mr-2">{p.key}</span>
                        <span className="text-gray-600 dark:text-gray-400">{p.value}</span>
                        <Badge variant="outline" className="ml-2 text-[10px]">模型</Badge>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => adoptInheritedParameter(p)} className="text-blue-600 hover:text-blue-700">覆盖此参数</Button>
                    </div>
                  ))}
                </div>
                </div>
              )}
            </div>

            {/* 预览JSON */}
            <div className="mt-6 space-y-2">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">参数预览</Label>
              <div className="p-3 bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-md">
                <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap overflow-auto max-h-40">
                  {previewJson}
                </pre>
              </div>
              <p className="text-xs text-gray-500">
                以上是发送给 LLM 时的完整参数配置（仅包含已启用的参数）
              </p>
            </div>

          </div>
        </TooltipProvider>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <DialogFooter className="px-6 py-3 border-t border-gray-100/80 dark:border-gray-800/80 bg-gradient-to-b from-gray-50/30 to-gray-50/60 dark:from-gray-900/10 dark:to-gray-900/30">
          <div className="flex items-center gap-2 w-full">
            {activeTab === 'params' ? (
              <>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleResetToModelDefault}
                  className="gap-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  重置为模型默认
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleResetToSystemDefault}
                  className="gap-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800"
                >
                  重置为系统默认
                </Button>
                {parameterSource === 'session' && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={handleClearSessionParameters}
                    className="gap-1.5 ml-auto text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800"
                  >
                    清除会话参数
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={()=>setSystemPromptText('')}
                  className="gap-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  重置提示词
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={()=>{ window.open('/prompts','_blank'); }}
                  className="gap-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800"
                >
                  <Settings className="w-3.5 h-3.5" />
                  管理已保存提示词
                </Button>
              </>
            )}
            <div className="flex-1" />
            <span className="text-xs text-gray-500">
              {activeTab === 'params' ? '参数调整实时生效' : '提示词仅在保存时应用'}
            </span>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 