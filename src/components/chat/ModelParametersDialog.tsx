"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Plus, RotateCcw, Settings, Check, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { specializedStorage } from "@/lib/storage";
import { ModelParametersService } from "@/lib/model-parameters";
import { ParameterPolicyEngine } from "@/lib/llm/ParameterPolicy";
import type { ModelParameters } from "@/types/model-params";
import { DEFAULT_MODEL_PARAMETERS, MODEL_PARAMETER_LIMITS } from "@/types/model-params";

// 自定义参数接口
interface CustomParameter {
  key: string;
  value: string;
  asString: boolean; // 是否强制作为字符串处理
}

interface ModelParametersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerName: string;
  modelId: string;
  modelLabel?: string;
}

export function ModelParametersDialog({
  open,
  onOpenChange,
  providerName,
  modelId,
  modelLabel
}: ModelParametersDialogProps) {
  const [parameters, setParameters] = useState<ModelParameters>(DEFAULT_MODEL_PARAMETERS);
  const [stopSequences, setStopSequences] = useState<string[]>([]);
  const [newStopSequence, setNewStopSequence] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [customParameters, setCustomParameters] = useState<CustomParameter[]>([]);
  const [savedParameters, setSavedParameters] = useState<ModelParameters | null>(null);
  const [advancedEditorOpen, setAdvancedEditorOpen] = useState(true);
  const [advancedJsonText, setAdvancedJsonText] = useState<string>('{}');
  const [advancedJsonError, setAdvancedJsonError] = useState<string>('');
  const [appliedPreviewOpen, setAppliedPreviewOpen] = useState(false);
  const [appliedOptionsJson, setAppliedOptionsJson] = useState<string>('{}');
  const [allowEditApplied, setAllowEditApplied] = useState(false);

  // 加载保存的参数
  useEffect(() => {
    if (open && providerName && modelId) {
      loadModelParameters();
    }
  }, [open, providerName, modelId]);

  // 检测参数变化
  useEffect(() => {
    if (savedParameters) {
      const hasParameterChanges = 
        parameters.temperature !== savedParameters.temperature ||
        parameters.maxTokens !== savedParameters.maxTokens ||
        parameters.topP !== savedParameters.topP ||
        (parameters as any).topK !== (savedParameters as any).topK ||
        (parameters as any).minP !== (savedParameters as any).minP ||
        parameters.frequencyPenalty !== savedParameters.frequencyPenalty ||
        parameters.presencePenalty !== savedParameters.presencePenalty ||
        JSON.stringify(stopSequences) !== JSON.stringify(savedParameters.stopSequences || []) ||
        customParameters.length > 0; // 如果有自定义参数就视为有变更
      setHasChanges(hasParameterChanges);
    } else {
      // 如果没有保存的参数，与系统默认参数比较
      const hasParameterChanges = 
        parameters.temperature !== DEFAULT_MODEL_PARAMETERS.temperature ||
        parameters.maxTokens !== DEFAULT_MODEL_PARAMETERS.maxTokens ||
        parameters.topP !== DEFAULT_MODEL_PARAMETERS.topP ||
        (parameters as any).topK !== (DEFAULT_MODEL_PARAMETERS as any).topK ||
        (parameters as any).minP !== (DEFAULT_MODEL_PARAMETERS as any).minP ||
        parameters.frequencyPenalty !== DEFAULT_MODEL_PARAMETERS.frequencyPenalty ||
        parameters.presencePenalty !== DEFAULT_MODEL_PARAMETERS.presencePenalty ||
        stopSequences.length > 0 ||
        customParameters.length > 0; // 如果有自定义参数就视为有变更
      setHasChanges(hasParameterChanges);
    }
  }, [parameters, stopSequences, savedParameters, customParameters]);

  const loadModelParameters = async () => {
    if (!providerName || !modelId) {
      return;
    }
    
    try {
      const savedParams = await specializedStorage.models.getModelParameters(providerName, modelId);
      if (savedParams) {
        setParameters(savedParams as ModelParameters);
        setStopSequences((savedParams as ModelParameters).stopSequences || []);
        setSavedParameters(savedParams as ModelParameters);
        const adv = (savedParams as ModelParameters).advancedOptions || {};
        setAdvancedJsonText(JSON.stringify(adv, null, 2));
        
        // 加载自定义参数
        const customParams: CustomParameter[] = [];
        Object.entries(adv).forEach(([key, value]) => {
          // 排除标准参数
          if (!['temperature', 'maxTokens', 'topP', 'topK', 'minP', 'frequencyPenalty', 'presencePenalty', 'stopSequences'].includes(key)) {
            const asString = typeof value === 'string' && !['true', 'false'].includes(value.toLowerCase()) && isNaN(Number(value));
            customParams.push({
              key,
              value: String(value),
              asString
            });
          }
        });
        setCustomParameters(customParams);
      } else {
        setParameters(DEFAULT_MODEL_PARAMETERS);
        setStopSequences([]);
        setSavedParameters(null);
        setAdvancedJsonText('{}');
        setCustomParameters([]);
      }
    } catch (error) {
      console.error('加载模型参数失败:', error);
      setParameters(DEFAULT_MODEL_PARAMETERS);
      setStopSequences([]);
      setSavedParameters(null);
      setCustomParameters([]);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // 解析高级参数 JSON（严格校验）
      let advanced: Record<string, any> | undefined = undefined;
      try {
        const trimmed = advancedJsonText?.trim();
        const parsed = trimmed ? JSON.parse(trimmed) : {};
        if (parsed && typeof parsed === 'object') {
          advanced = parsed;
          setAdvancedJsonError('');
        }
      } catch (e: any) {
        setAdvancedJsonError(e?.message || 'JSON 格式错误');
        setIsLoading(false);
        return;
      }

      // 合并自定义参数到 advancedOptions
      const customParamsObj: Record<string, any> = {};
      customParameters.forEach(param => {
        if (param.key.trim()) {
          customParamsObj[param.key] = convertValue(param.value, param.asString);
        }
      });

      const configToSave = {
        ...parameters,
        stopSequences,
        advancedOptions: { ...advanced, ...customParamsObj }
      };
      await specializedStorage.models.setModelParameters(providerName, modelId, configToSave);
      onOpenChange(false);
    } catch (error) {
      console.error('保存模型参数失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setParameters(DEFAULT_MODEL_PARAMETERS);
    setStopSequences([]);
    setSavedParameters(null);
    setAdvancedJsonText('{}');
    setCustomParameters([]);
  };

  // 仅计算"应用预览"，不再自动回填界面
  useEffect(() => {
    try {
      let advanced: Record<string, any> = {};
      if (advancedJsonText.trim()) {
        advanced = JSON.parse(advancedJsonText);
        setAdvancedJsonError('');
      } else {
        setAdvancedJsonError('');
      }
      const tempParams: ModelParameters = {
        ...parameters,
        stopSequences: stopSequences,
        advancedOptions: advanced,
      };
      const chatOptions = ModelParametersService.convertToChatOptions(tempParams);
      const applied = ParameterPolicyEngine.apply(providerName, modelId, chatOptions);
      setAppliedOptionsJson(JSON.stringify(applied, null, 2));
    } catch (e: any) {
      setAdvancedJsonError(e?.message || 'JSON 格式错误');
    }
  }, [parameters, stopSequences, advancedJsonText, providerName, modelId]);

  // 将"应用预览"反写回表单（提高可编辑性）
  const applyPreviewIntoForm = () => {
    try {
      const applied = JSON.parse(appliedOptionsJson || '{}');
      const parsed = ModelParametersService.parseFromChatOptions(applied);
      // 覆盖基础参数与 stopSequences
      setParameters(prev => ({
        ...prev,
        temperature: parsed.temperature,
        maxTokens: parsed.maxTokens,
        topP: parsed.topP,
        topK: (parsed as any).topK,
        minP: (parsed as any).minP,
        frequencyPenalty: parsed.frequencyPenalty,
        presencePenalty: parsed.presencePenalty,
      }));
      setStopSequences(parsed.stopSequences || []);
      setAdvancedJsonText(JSON.stringify(parsed.advancedOptions || {}, null, 2));
      setAdvancedJsonError('');
    } catch (e: any) {
      setAdvancedJsonError('无法从预览反解析：' + (e?.message || '格式错误'));
    }
  };

  const handleClearSession = () => {
    setParameters(DEFAULT_MODEL_PARAMETERS);
    setStopSequences([]);
    setSavedParameters(null);
    setHasChanges(false);
    setCustomParameters([]);
  };

  const addStopSequence = () => {
    if (newStopSequence.trim() && !stopSequences.includes(newStopSequence.trim())) {
      setStopSequences([...stopSequences, newStopSequence.trim()]);
      setNewStopSequence("");
    }
  };

  const removeStopSequence = (index: number) => {
    setStopSequences(stopSequences.filter((_, i) => i !== index));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addStopSequence();
    }
  };

  // 计算滑动条百分比
  const calcPercent = (value: number, min: number, max: number) => {
    if (max === min) return 0;
    return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  };

  // 自定义参数相关函数
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
    
    // 默认返回字符串
    return value;
  };

  const addCustomParameter = () => {
    setCustomParameters(prev => [...prev, { key: '', value: '', asString: false }]);
  };

  const updateCustomParameter = (index: number, field: keyof CustomParameter, value: any) => {
    setCustomParameters(prev => prev.map((param, i) => 
      i === index ? { ...param, [field]: value } : param
    ));
  };

  const removeCustomParameter = (index: number) => {
    setCustomParameters(prev => prev.filter((_, i) => i !== index));
  };

  // 生成预览JSON
  const generatePreviewJson = () => {
    const result: any = {};
    
    // 标准参数
    if (parameters.enableTemperature && parameters.temperature !== undefined) {
      result.temperature = parameters.temperature;
    }
    if (parameters.enableMaxTokens && parameters.maxTokens !== undefined) {
      result.maxTokens = parameters.maxTokens;
    }
    if (parameters.enableTopP && parameters.topP !== undefined) {
      result.topP = parameters.topP;
    }
    if (parameters.enableTopK && parameters.topK !== undefined) {
      result.topK = parameters.topK;
    }
    if (parameters.enableMinP && parameters.minP !== undefined) {
      result.minP = parameters.minP;
    }
    if (parameters.enableFrequencyPenalty && parameters.frequencyPenalty !== undefined) {
      result.frequencyPenalty = parameters.frequencyPenalty;
    }
    if (parameters.enablePresencePenalty && parameters.presencePenalty !== undefined) {
      result.presencePenalty = parameters.presencePenalty;
    }
    if (stopSequences.length > 0) {
      result.stopSequences = stopSequences;
    }
    
    // 自定义参数
    customParameters.forEach(param => {
      if (param.key.trim()) {
        result[param.key] = convertValue(param.value, param.asString);
      }
    });
    
    return result;
  };

  const previewJson = generatePreviewJson();


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 max-h-[85vh] overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <Settings className="w-5 h-5 text-blue-500 dark:text-blue-400" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  模型参数设置
                </DialogTitle>
                <DialogDescription className="sr-only">
                  配置此模型的参数设置，这些设置将仅应用于此特定模型。
                </DialogDescription>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300">
                    {modelLabel || modelId}
                  </Badge>
                  {hasChanges && (
                    <Badge variant="outline" className="text-xs text-blue-600 border-blue-200 dark:text-blue-400 dark:border-blue-800">
                      已修改
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">此处设置为该模型的默认参数，影响所有会话。你仍可在"会话参数设置"中临时覆盖。</p>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="px-6 py-2.5 space-y-3 max-h-[60vh] overflow-y-auto">
          
          {/* Temperature */}
          <div className="flex items-center gap-3">
            <Checkbox 
              checked={parameters.enableTemperature !== false}
              onCheckedChange={(checked) => setParameters(prev => ({ ...prev, enableTemperature: Boolean(checked) }))}
            />
            <div className="flex items-center gap-3 min-w-32">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Temperature</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" align="start" className="max-w-xs">
                    <p>控制输出的随机性。数值越低越确定，越高越有创意。常用范围：0.5–1.0。</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex-1">
                <input
                  type="range"
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                  min={MODEL_PARAMETER_LIMITS.temperature.min}
                  max={MODEL_PARAMETER_LIMITS.temperature.max}
                  step={MODEL_PARAMETER_LIMITS.temperature.step}
                value={parameters.temperature || 0}
                onChange={(e) => setParameters(prev => ({ ...prev, temperature: parseFloat(e.target.value) || 0 }))}
                style={{
                  background: parameters.enableTemperature === false
                    ? '#e5e7eb'
                    : `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${calcPercent(parameters.temperature || 0, MODEL_PARAMETER_LIMITS.temperature.min, MODEL_PARAMETER_LIMITS.temperature.max)}%, #e5e7eb ${calcPercent(parameters.temperature || 0, MODEL_PARAMETER_LIMITS.temperature.min, MODEL_PARAMETER_LIMITS.temperature.max)}%, #e5e7eb 100%)`
                }}
                  disabled={parameters.enableTemperature === false}
                />
              </div>
                <Input
                  type="number"
              className="w-20 h-8 text-sm"
              min={MODEL_PARAMETER_LIMITS.temperature.inputMin}
              max={MODEL_PARAMETER_LIMITS.temperature.inputMax}
              value={parameters.temperature || 0}
                  step={MODEL_PARAMETER_LIMITS.temperature.step}
              onChange={(e) => setParameters(prev => ({ ...prev, temperature: parseFloat(e.target.value || '0') }))}
                  disabled={parameters.enableTemperature === false}
                />
              </div>

          {/* Max Tokens */}
          <div className="flex items-center gap-3">
            <Checkbox 
              checked={parameters.enableMaxTokens !== false}
              onCheckedChange={(checked) => setParameters(prev => ({ ...prev, enableMaxTokens: Boolean(checked) }))}
            />
            <div className="flex items-center gap-3 min-w-32">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Max Tokens</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" align="start" className="max-w-xs">
                    <p>限制单次回复能生成的最大 Token 数。控制输出长度的硬性限制。</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex-1">
                <input
                  type="range"
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                  min={MODEL_PARAMETER_LIMITS.maxTokens.min}
                  max={MODEL_PARAMETER_LIMITS.maxTokens.max}
                  step={MODEL_PARAMETER_LIMITS.maxTokens.step}
                value={parameters.maxTokens || 0}
                onChange={(e) => setParameters(prev => ({ ...prev, maxTokens: parseInt(e.target.value) || 0 }))}
                style={{
                  background: parameters.enableMaxTokens === false
                    ? '#e5e7eb'
                    : `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${calcPercent(parameters.maxTokens || 0, MODEL_PARAMETER_LIMITS.maxTokens.min, MODEL_PARAMETER_LIMITS.maxTokens.max)}%, #e5e7eb ${calcPercent(parameters.maxTokens || 0, MODEL_PARAMETER_LIMITS.maxTokens.min, MODEL_PARAMETER_LIMITS.maxTokens.max)}%, #e5e7eb 100%)`
                }}
                  disabled={parameters.enableMaxTokens === false}
                />
              </div>
                <Input
                  type="number"
              className="w-20 h-8 text-sm"
              min={MODEL_PARAMETER_LIMITS.maxTokens.inputMin}
              max={MODEL_PARAMETER_LIMITS.maxTokens.inputMax}
              value={parameters.maxTokens || 0}
                  step={MODEL_PARAMETER_LIMITS.maxTokens.step}
              onChange={(e) => setParameters(prev => ({ ...prev, maxTokens: parseInt(e.target.value || '0') }))}
                  disabled={parameters.enableMaxTokens === false}
                />
              </div>

          {/* Top P */}
          <div className="flex items-center gap-3">
            <Checkbox 
              checked={parameters.enableTopP !== false}
              onCheckedChange={(checked) => setParameters(prev => ({ ...prev, enableTopP: Boolean(checked) }))}
            />
            <div className="flex items-center gap-3 min-w-32">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Top P</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" align="start" className="max-w-xs">
                    <p>从累计概率最高的候选中采样。越低越保守。与 Temperature 一般二选一调节。</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex-1">
                <input
                  type="range"
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                  min={MODEL_PARAMETER_LIMITS.topP.min}
                  max={MODEL_PARAMETER_LIMITS.topP.max}
                  step={MODEL_PARAMETER_LIMITS.topP.step}
                value={parameters.topP || 0}
                onChange={(e) => setParameters(prev => ({ ...prev, topP: parseFloat(e.target.value) || 0 }))}
                style={{
                  background: parameters.enableTopP === false
                    ? '#e5e7eb'
                    : `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${calcPercent(parameters.topP || 0, MODEL_PARAMETER_LIMITS.topP.min, MODEL_PARAMETER_LIMITS.topP.max)}%, #e5e7eb ${calcPercent(parameters.topP || 0, MODEL_PARAMETER_LIMITS.topP.min, MODEL_PARAMETER_LIMITS.topP.max)}%, #e5e7eb 100%)`
                }}
                  disabled={parameters.enableTopP === false}
                />
              </div>
                <Input
                  type="number"
              className="w-20 h-8 text-sm"
              min={MODEL_PARAMETER_LIMITS.topP.inputMin}
              max={MODEL_PARAMETER_LIMITS.topP.inputMax}
              value={parameters.topP || 0}
                  step={MODEL_PARAMETER_LIMITS.topP.step}
              onChange={(e) => setParameters(prev => ({ ...prev, topP: parseFloat(e.target.value || '0') }))}
                  disabled={parameters.enableTopP === false}
                />
              </div>

          {/* Top K */}
          <div className="flex items-center gap-3">
            <Checkbox 
              checked={(parameters as any).enableTopK !== false}
              onCheckedChange={(checked) => setParameters(prev => ({ ...prev, enableTopK: Boolean(checked) } as any))}
            />
            <div className="flex items-center gap-3 min-w-32">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Top K</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" align="start" className="max-w-xs">
                    <p>只考虑概率最高的 K 个候选词。与 Temperature 一般二选一调节。</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex-1">
              <input
                type="range"
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                min={MODEL_PARAMETER_LIMITS.topK.min}
                max={MODEL_PARAMETER_LIMITS.topK.max}
                step={MODEL_PARAMETER_LIMITS.topK.step}
                value={(parameters as any).topK || 0}
                onChange={(e) => setParameters(prev => ({ ...prev, topK: parseInt(e.target.value) || 0 } as any))}
                style={{
                  background: (parameters as any).enableTopK === false
                    ? '#e5e7eb'
                    : `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${calcPercent((parameters as any).topK || 0, MODEL_PARAMETER_LIMITS.topK.min, MODEL_PARAMETER_LIMITS.topK.max)}%, #e5e7eb ${calcPercent((parameters as any).topK || 0, MODEL_PARAMETER_LIMITS.topK.min, MODEL_PARAMETER_LIMITS.topK.max)}%, #e5e7eb 100%)`
                }}
                disabled={(parameters as any).enableTopK === false}
              />
            </div>
            <Input
              type="number"
              className="w-20 h-8 text-sm"
              min={MODEL_PARAMETER_LIMITS.topK.inputMin}
              max={MODEL_PARAMETER_LIMITS.topK.inputMax}
              value={(parameters as any).topK || 0}
              step={MODEL_PARAMETER_LIMITS.topK.step}
              onChange={(e) => setParameters(prev => ({ ...prev, topK: parseInt(e.target.value || '0') } as any))}
              disabled={(parameters as any).enableTopK === false}
            />
          </div>

          {/* Min P */}
          <div className="flex items-center gap-3">
            <Checkbox 
              checked={(parameters as any).enableMinP !== false}
              onCheckedChange={(checked) => setParameters(prev => ({ ...prev, enableMinP: Boolean(checked) } as any))}
            />
            <div className="flex items-center gap-3 min-w-32">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Min P</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" align="start" className="max-w-xs">
                    <p>设置最低概率阈值，低于此值的候选词会被过滤。</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex-1">
              <input
                type="range"
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                min={MODEL_PARAMETER_LIMITS.minP.min}
                max={MODEL_PARAMETER_LIMITS.minP.max}
                step={MODEL_PARAMETER_LIMITS.minP.step}
                value={(parameters as any).minP || 0}
                onChange={(e) => setParameters(prev => ({ ...prev, minP: parseFloat(e.target.value) || 0 } as any))}
                style={{
                  background: (parameters as any).enableMinP === false
                    ? '#e5e7eb'
                    : `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${calcPercent((parameters as any).minP || 0, MODEL_PARAMETER_LIMITS.minP.min, MODEL_PARAMETER_LIMITS.minP.max)}%, #e5e7eb ${calcPercent((parameters as any).minP || 0, MODEL_PARAMETER_LIMITS.minP.min, MODEL_PARAMETER_LIMITS.minP.max)}%, #e5e7eb 100%)`
                }}
                disabled={(parameters as any).enableMinP === false}
              />
            </div>
            <Input
              type="number"
              className="w-20 h-8 text-sm"
              min={MODEL_PARAMETER_LIMITS.minP.inputMin}
              max={MODEL_PARAMETER_LIMITS.minP.inputMax}
              value={(parameters as any).minP || 0}
              step={MODEL_PARAMETER_LIMITS.minP.step}
              onChange={(e) => setParameters(prev => ({ ...prev, minP: parseFloat(e.target.value || '0') } as any))}
              disabled={(parameters as any).enableMinP === false}
            />
            </div>

          {/* Frequency Penalty */}
          <div className="flex items-center gap-3">
            <Checkbox 
              checked={parameters.enableFrequencyPenalty !== false}
              onCheckedChange={(checked) => setParameters(prev => ({ ...prev, enableFrequencyPenalty: Boolean(checked) }))}
            />
            <div className="flex items-center gap-3 min-w-32">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Frequency Penalty</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" align="start" className="max-w-xs">
                    <p>增大可降低重复词汇的概率。</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex-1">
                <input
                  type="range"
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                  min={MODEL_PARAMETER_LIMITS.frequencyPenalty.min}
                  max={MODEL_PARAMETER_LIMITS.frequencyPenalty.max}
                  step={MODEL_PARAMETER_LIMITS.frequencyPenalty.step}
                value={parameters.frequencyPenalty || 0}
                onChange={(e) => setParameters(prev => ({ ...prev, frequencyPenalty: parseFloat(e.target.value) || 0 }))}
                style={{
                  background: parameters.enableFrequencyPenalty === false
                    ? '#e5e7eb'
                    : `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${calcPercent(parameters.frequencyPenalty || 0, MODEL_PARAMETER_LIMITS.frequencyPenalty.min, MODEL_PARAMETER_LIMITS.frequencyPenalty.max)}%, #e5e7eb ${calcPercent(parameters.frequencyPenalty || 0, MODEL_PARAMETER_LIMITS.frequencyPenalty.min, MODEL_PARAMETER_LIMITS.frequencyPenalty.max)}%, #e5e7eb 100%)`
                }}
                  disabled={parameters.enableFrequencyPenalty === false}
                />
              </div>
                <Input
                  type="number"
              className="w-20 h-8 text-sm"
              min={MODEL_PARAMETER_LIMITS.frequencyPenalty.inputMin}
              max={MODEL_PARAMETER_LIMITS.frequencyPenalty.inputMax}
              value={parameters.frequencyPenalty || 0}
                  step={MODEL_PARAMETER_LIMITS.frequencyPenalty.step}
              onChange={(e) => setParameters(prev => ({ ...prev, frequencyPenalty: parseFloat(e.target.value || '0') }))}
                  disabled={parameters.enableFrequencyPenalty === false}
                />
              </div>

          {/* Presence Penalty */}
          <div className="flex items-center gap-3">
            <Checkbox 
              checked={parameters.enablePresencePenalty !== false}
              onCheckedChange={(checked) => setParameters(prev => ({ ...prev, enablePresencePenalty: Boolean(checked) }))}
            />
            <div className="flex items-center gap-3 min-w-32">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Presence Penalty</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" align="start" className="max-w-xs">
                    <p>增大可鼓励模型引入新话题。</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex-1">
                <input
                  type="range"
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                  min={MODEL_PARAMETER_LIMITS.presencePenalty.min}
                  max={MODEL_PARAMETER_LIMITS.presencePenalty.max}
                  step={MODEL_PARAMETER_LIMITS.presencePenalty.step}
                value={parameters.presencePenalty || 0}
                onChange={(e) => setParameters(prev => ({ ...prev, presencePenalty: parseFloat(e.target.value) || 0 }))}
                style={{
                  background: parameters.enablePresencePenalty === false
                    ? '#e5e7eb'
                    : `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${calcPercent(parameters.presencePenalty || 0, MODEL_PARAMETER_LIMITS.presencePenalty.min, MODEL_PARAMETER_LIMITS.presencePenalty.max)}%, #e5e7eb ${calcPercent(parameters.presencePenalty || 0, MODEL_PARAMETER_LIMITS.presencePenalty.min, MODEL_PARAMETER_LIMITS.presencePenalty.max)}%, #e5e7eb 100%)`
                }}
                  disabled={parameters.enablePresencePenalty === false}
                />
              </div>
                <Input
                  type="number"
              className="w-20 h-8 text-sm"
              min={MODEL_PARAMETER_LIMITS.presencePenalty.inputMin}
              max={MODEL_PARAMETER_LIMITS.presencePenalty.inputMax}
              value={parameters.presencePenalty || 0}
                  step={MODEL_PARAMETER_LIMITS.presencePenalty.step}
              onChange={(e) => setParameters(prev => ({ ...prev, presencePenalty: parseFloat(e.target.value || '0') }))}
                  disabled={parameters.enablePresencePenalty === false}
                />
              </div>

          {/* Stop Sequences */}
          <div className="flex items-center gap-3">
            <Checkbox 
              checked={parameters.enableStopSequences !== false}
              onCheckedChange={(checked) => setParameters(prev => ({ ...prev, enableStopSequences: Boolean(checked) }))}
            />
            <div className="flex items-center gap-3 min-w-32">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Stop Sequences</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" align="start" className="max-w-xs">
                    <p>当生成包含这些序列时停止生成。</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex-1 flex gap-2">
                <Input
                  value={newStopSequence}
                  onChange={(e) => setNewStopSequence(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="输入停止序列..."
                className="flex-1 text-sm"
                  disabled={parameters.enableStopSequences === false}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addStopSequence}
                  disabled={parameters.enableStopSequences === false || !newStopSequence.trim()}
                  className="px-3"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {stopSequences.length > 0 && (
            <div className="flex flex-wrap gap-2 ml-20">
                {stopSequences.map((sequence, index) => (
                  <Badge 
                    key={index} 
                    variant="secondary" 
                    className="flex items-center gap-1 bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  >
                    <span className="text-xs">{sequence}</span>
                    <button
                      onClick={() => removeStopSequence(index)}
                      className="ml-1 hover:text-red-500 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

          {/* 自定义参数 */}
          <div className="space-y-3">
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
                  placeholder="参数名称"
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
                  <Label className="text-xs text-gray-500 whitespace-nowrap">Treat as string</Label>
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
          </div>

          {/* 参数预览 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">参数预览</Label>
              <Badge variant="secondary" className="text-xs">JSON</Badge>
            </div>
            <pre className="text-xs bg-gray-50 dark:bg-gray-800 p-3 rounded-md border overflow-auto max-h-32">
{JSON.stringify(previewJson, null, 2)}
            </pre>
          </div>

          {/* 高级参数（JSON） */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">高级设置 (JSON)</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <p>高级参数会被直接合并到请求选项（遵循各 Provider 的字段定义）。请仅在清楚目标模型/Provider 支持字段时使用；配置不当可能导致请求失败或被策略引擎覆盖。</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex items-center gap-2">
                {/* <Button variant="outline" size="sm" onClick={() => setAppliedPreviewOpen(v => !v)}>
                  {appliedPreviewOpen ? '隐藏预览' : '显示应用预览'}
                </Button> */}
                <Button variant="ghost" size="sm" onClick={() => setAdvancedEditorOpen(v => !v)}>
                  {advancedEditorOpen ? '收起' : '展开'}
                </Button>
              </div>
            </div>
            <div className={cn("overflow-hidden transition-all duration-200", advancedEditorOpen ? "max-h-[320px] opacity-100" : "max-h-0 opacity-0")}> 
              <textarea
                value={advancedJsonText === '{}' ? '' : advancedJsonText}
                onChange={(e) => setAdvancedJsonText(e.target.value && e.target.value.trim().length > 0 ? e.target.value : '{}')}
                className="w-full h-40 text-xs font-mono p-3 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                placeholder={`{
  "generationConfig": { 
    "thinkingConfig": { "thinkingBudget": 1024 }
  }
}`}
              />
            </div>
            {advancedJsonError ? (
              <p className="text-xs text-red-500">JSON 格式错误：{advancedJsonError}</p>
            ) : (
              <p className="text-xs text-gray-500">将作为高级选项直接合并到请求选项中（遵循各 Provider 字段）。</p>
            )}
            {/* <div className={cn("mt-2 space-y-2 overflow-hidden transition-all duration-200", appliedPreviewOpen ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0")}> 
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-gray-500">实际应用参数预览（保存前计算）</Label>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500 flex items-center gap-1">
                      <input type="checkbox" className="scale-90" checked={allowEditApplied} onChange={(e)=>setAllowEditApplied(e.target.checked)} />
                      允许直接编辑
                    </label>
                    <Button size="sm" variant="outline" onClick={applyPreviewIntoForm} className="h-6 text-xs">将预览应用到表单</Button>
                  </div>
                </div>
                {allowEditApplied ? (
                  <textarea
                    className="w-full max-h-48 h-40 text-xs font-mono p-3 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                    value={appliedOptionsJson}
                    onChange={(e)=>setAppliedOptionsJson(e.target.value)}
                  />
                ) : (
                  <pre className="mt-1 max-h-48 overflow-auto text-xs bg-gray-50 dark:bg-gray-900/40 p-3 rounded border border-gray-100 dark:border-gray-800 whitespace-pre-wrap">{appliedOptionsJson}</pre>
                )}
            </div> */}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/20">
          <div className="flex items-center gap-2 w-full">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleReset}
              className="flex items-center gap-2 border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <RotateCcw className="w-4 h-4" />
              重置为系统默认
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleClearSession}
              className="flex items-center gap-2 ml-auto border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              清除模型参数
            </Button>
            <div className="ml-auto" />
            <Button 
              onClick={handleSave} 
              disabled={isLoading}
              className="ml-auto flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white shadow-sm"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  应用
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 