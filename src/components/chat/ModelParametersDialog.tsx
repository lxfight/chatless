"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Plus, RotateCcw, Settings, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { specializedStorage } from "@/lib/storage";
import { ModelParametersService } from "@/lib/model-parameters";
import { ParameterPolicyEngine } from "@/lib/llm/ParameterPolicy";
import type { ModelParameters, ModelConfig } from "@/types/model-params";
import { DEFAULT_MODEL_PARAMETERS, MODEL_PARAMETER_LIMITS } from "@/types/model-params";

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
  const [savedParameters, setSavedParameters] = useState<ModelParameters | null>(null);
  const [advancedEditorOpen, setAdvancedEditorOpen] = useState(false);
  const [advancedJsonText, setAdvancedJsonText] = useState<string>('{}');
  const [advancedJsonError, setAdvancedJsonError] = useState<string>('');
  const [appliedPreviewOpen, setAppliedPreviewOpen] = useState(false);
  const [appliedOptionsJson, setAppliedOptionsJson] = useState<string>('{}');
  const [allowEditApplied, setAllowEditApplied] = useState(false);

  // 加载保存的参数
  useEffect(() => {
    if (open) {
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
        parameters.frequencyPenalty !== savedParameters.frequencyPenalty ||
        parameters.presencePenalty !== savedParameters.presencePenalty ||
        JSON.stringify(stopSequences) !== JSON.stringify(savedParameters.stopSequences || []);
      setHasChanges(hasParameterChanges);
    } else {
      // 如果没有保存的参数，与系统默认参数比较
      const hasParameterChanges = 
        parameters.temperature !== DEFAULT_MODEL_PARAMETERS.temperature ||
        parameters.maxTokens !== DEFAULT_MODEL_PARAMETERS.maxTokens ||
        parameters.topP !== DEFAULT_MODEL_PARAMETERS.topP ||
        parameters.frequencyPenalty !== DEFAULT_MODEL_PARAMETERS.frequencyPenalty ||
        parameters.presencePenalty !== DEFAULT_MODEL_PARAMETERS.presencePenalty ||
        stopSequences.length > 0;
      setHasChanges(hasParameterChanges);
    }
  }, [parameters, stopSequences, savedParameters]);

  const loadModelParameters = async () => {
    try {
      const savedParams = await specializedStorage.models.getModelParameters(providerName, modelId);
      if (savedParams) {
        setParameters(savedParams as ModelParameters);
        setStopSequences((savedParams as ModelParameters).stopSequences || []);
        setSavedParameters(savedParams as ModelParameters);
        const adv = (savedParams as ModelParameters).advancedOptions || {};
        setAdvancedJsonText(JSON.stringify(adv, null, 2));
      } else {
        setParameters(DEFAULT_MODEL_PARAMETERS);
        setStopSequences([]);
        setSavedParameters(null);
        setAdvancedJsonText('{}');
      }
    } catch (error) {
      console.error('加载模型参数失败:', error);
      setParameters(DEFAULT_MODEL_PARAMETERS);
      setStopSequences([]);
      setSavedParameters(null);
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

      const configToSave = {
        ...parameters,
        stopSequences,
        advancedOptions: advanced
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
  };

  // 仅计算“应用预览”，不再自动回填界面
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

  // 将“应用预览”反写回表单（提高可编辑性）
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

  // ========== Slider helpers ==========
  const calcPercent = (value: number, min: number, max: number) => {
    if (max === min) return 0;
    return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  };

  const trackBg = (
    value: number,
    min: number,
    max: number,
    disabled?: boolean
  ) => {
    if (disabled) {
      return `linear-gradient(to right, rgb(209 213 219) 0%, rgb(209 213 219) 100%)`;
    }
    const p = calcPercent(value, min, max);
    return `linear-gradient(to right, rgb(59 130 246) 0%, rgb(59 130 246) ${p}%, rgb(229 231 235) ${p}%, rgb(229 231 235) 100%)`;
  };

  // 刻度暂时移除（原生 datalist 在部分环境不可见 + 自绘刻度先行下线）

  const ParameterSlider = ({
    id,
    label,
    value,
    onChange,
    min,
    max,
    step,
    description,
  }: {
    id: string;
    label: string;
    value: number;
    onChange: (value: number) => void;
    min: number;
    max: number;
    step: number;
    description: string;
  }) => {
    const clamp = (v: number) => (v < min ? min : v > max ? max : v);
    const toNumber = (s: string) => {
      const n = Number(s);
      return Number.isFinite(n) ? n : value;
    };
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Label htmlFor={id} className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-20">
            {label}
          </Label>
          <div className="flex-1" />
          <Input
            type="number"
            inputMode="decimal"
            step={step}
            min={min}
            max={max}
            value={value}
            onChange={(e) => onChange(clamp(toNumber(e.target.value)))}
            onBlur={(e) => onChange(clamp(toNumber(e.target.value)))}
            className="h-7 w-20 text-right font-mono"
          />
        </div>
        <p className="text-xs text-gray-500 leading-relaxed ml-24">{description}</p>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden">
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
                <p className="mt-1 text-xs text-gray-500">此处设置为该模型的默认参数，影响所有会话。你仍可在“会话参数设置”中临时覆盖。</p>
              </div>
            </div>
            <div className="flex items-center gap-2" />
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* 调试布局已移除 */}
          {/* 原生滑条单项测试已移除 */}
            {(
              <div className="space-y-2">
              <div className="flex items-center gap-4">
                <Label className={cn("text-sm font-medium w-32 shrink-0", parameters.enableTemperature === false ? "text-gray-400" : "text-gray-700 dark:text-gray-300")}>多样性</Label>
                <input
                  type="range"
                  className="flex-1 appearance-none w-full h-1.5 rounded-full cursor-pointer bg-gray-200 dark:bg-gray-700 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-150 [&::-webkit-slider-thumb]:hover:scale-105 disabled:[&::-webkit-slider-thumb]:shadow-none disabled:[&::-webkit-slider-thumb]:bg-gray-200 disabled:[&::-webkit-slider-thumb]:border-gray-300 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-blue-500 [&::-moz-range-thumb]:shadow-md [&::-webkit-slider-track]:rounded-full [&::-webkit-slider-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:h-1.5"
                  min={MODEL_PARAMETER_LIMITS.temperature.min}
                  max={MODEL_PARAMETER_LIMITS.temperature.max}
                  step={MODEL_PARAMETER_LIMITS.temperature.step}
                  value={parameters.temperature}
                  onChange={(e)=>setParameters(prev=>({...prev, temperature: parseFloat(e.target.value)}))}
                  style={{ background: trackBg(parameters.temperature, MODEL_PARAMETER_LIMITS.temperature.min, MODEL_PARAMETER_LIMITS.temperature.max, parameters.enableTemperature === false) }}
                  disabled={parameters.enableTemperature === false}
                  list="ticks-temperature"
                />
                {/* datalist 刻度移除 */}
                <Checkbox aria-label="enable temperature" checked={parameters.enableTemperature !== false} onCheckedChange={(v)=>setParameters(prev=>({...prev, enableTemperature: Boolean(v)}))} />
              </div>
              <div className="flex items-center ml-32 gap-2">
                <p className="text-xs text-gray-400 font-mono">temperature</p>
                <div className="flex-1" />
                <Input
                  type="number"
                  className="h-7 w-24 text-right font-mono rounded-md border-gray-200 dark:border-gray-700 focus-visible:ring-2 focus-visible:ring-blue-500"
                  value={parameters.temperature}
                  step={MODEL_PARAMETER_LIMITS.temperature.step}
                  onChange={(e)=>setParameters(prev=>({...prev, temperature: parseFloat(e.target.value || '0')}))}
                  disabled={parameters.enableTemperature === false}
                />
              </div>
              <p className="text-xs text-gray-500 leading-relaxed ml-32">数值越低越“确定”，越高越“有创意”。常用：0.5–1.0。</p>
            </div>
          )}

          {(
              <div className="space-y-2">
              <div className="flex items-center gap-4">
                <Label className={cn("text-sm font-medium w-32 shrink-0", parameters.enableMaxTokens === false ? "text-gray-400" : "text-gray-700 dark:text-gray-300")}>回复长度上限</Label>
                <input
                  type="range"
                  className="flex-1 appearance-none w-full h-1.5 rounded-full cursor-pointer bg-gray-200 dark:bg-gray-700 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-150 [&::-webkit-slider-thumb]:hover:scale-105 disabled:[&::-webkit-slider-thumb]:shadow-none disabled:[&::-webkit-slider-thumb]:bg-gray-200 disabled:[&::-webkit-slider-thumb]:border-gray-300 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-blue-500 [&::-moz-range-thumb]:shadow-md [&::-webkit-slider-track]:rounded-full [&::-webkit-slider-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:h-1.5"
                  min={MODEL_PARAMETER_LIMITS.maxTokens.min}
                  max={MODEL_PARAMETER_LIMITS.maxTokens.max}
                  step={MODEL_PARAMETER_LIMITS.maxTokens.step}
                  value={parameters.maxTokens}
                  onChange={(e)=>setParameters(prev=>({...prev, maxTokens: parseFloat(e.target.value)}))}
                  style={{ background: trackBg(parameters.maxTokens, MODEL_PARAMETER_LIMITS.maxTokens.min, MODEL_PARAMETER_LIMITS.maxTokens.max, parameters.enableMaxTokens === false) }}
                  disabled={parameters.enableMaxTokens === false}
                  list="ticks-maxTokens"
                />
                {/* datalist 刻度移除 */}
                <Checkbox aria-label="enable maxTokens" checked={parameters.enableMaxTokens !== false} onCheckedChange={(v)=>setParameters(prev=>({...prev, enableMaxTokens: Boolean(v)}))} />
              </div>
              <div className="flex items-center ml-32 gap-2">
                <p className="text-xs text-gray-400 font-mono">maxTokens</p>
                <div className="flex-1" />
                <Input
                  type="number"
                  className="h-7 w-28 text-right font-mono rounded-md border-gray-200 dark:border-gray-700 focus-visible:ring-2 focus-visible:ring-blue-500"
                  value={parameters.maxTokens}
                  step={MODEL_PARAMETER_LIMITS.maxTokens.step}
                  onChange={(e)=>{
                    const raw = e.target.value;
                    setParameters(prev=>({...prev, maxTokens: parseFloat(raw || '0')}));
                  }}
                  disabled={parameters.enableMaxTokens === false}
                />
              </div>
              <p className="text-xs text-gray-500 leading-relaxed ml-32">限制单次回复能生成的最大 Token 数。</p>
            </div>
          )}

          {(
              <div className="space-y-2">
              <div className="flex items-center gap-4">
                <Label className={cn("text-sm font-medium w-32 shrink-0", parameters.enableTopP === false ? "text-gray-400" : "text-gray-700 dark:text-gray-300")}>采样阈值</Label>
                <input
                  type="range"
                  className="flex-1 appearance-none w-full h-1.5 rounded-full cursor-pointer bg-gray-200 dark:bg-gray-700 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-150 [&::-webkit-slider-thumb]:hover:scale-105 disabled:[&::-webkit-slider-thumb]:shadow-none disabled:[&::-webkit-slider-thumb]:bg-gray-200 disabled:[&::-webkit-slider-thumb]:border-gray-300 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-blue-500 [&::-moz-range-thumb]:shadow-md [&::-webkit-slider-track]:rounded-full [&::-webkit-slider-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:h-1.5"
                  min={MODEL_PARAMETER_LIMITS.topP.min}
                  max={MODEL_PARAMETER_LIMITS.topP.max}
                  step={MODEL_PARAMETER_LIMITS.topP.step}
                  value={parameters.topP}
                  onChange={(e)=>setParameters(prev=>({...prev, topP: parseFloat(e.target.value)}))}
                  style={{ background: trackBg(parameters.topP, MODEL_PARAMETER_LIMITS.topP.min, MODEL_PARAMETER_LIMITS.topP.max, parameters.enableTopP === false) }}
                  disabled={parameters.enableTopP === false}
                  list="ticks-topP"
                />
                {/* datalist 刻度移除 */}
                <Checkbox aria-label="enable topP" checked={parameters.enableTopP !== false} onCheckedChange={(v)=>setParameters(prev=>({...prev, enableTopP: Boolean(v)}))} />
              </div>
              <div className="flex items-center ml-32 gap-2">
                <p className="text-xs text-gray-400 font-mono">topP</p>
                <div className="flex-1" />
                <Input
                  type="number"
                  className="h-7 w-24 text-right font-mono rounded-md border-gray-200 dark:border-gray-700 focus-visible:ring-2 focus-visible:ring-blue-500"
                  value={parameters.topP}
                  step={MODEL_PARAMETER_LIMITS.topP.step}
                  onChange={(e)=>setParameters(prev=>({...prev, topP: parseFloat(e.target.value || '0')}))}
                  disabled={parameters.enableTopP === false}
                />
              </div>
              <p className="text-xs text-gray-500 leading-relaxed ml-32">从累计概率最高的候选中采样。越低越保守。与 Temperature 一般二选一调节。</p>
            </div>
          )}

          {(
              <div className="space-y-2">
              <div className="flex items-center gap-4">
                <Label className={cn("text-sm font-medium w-32 shrink-0", parameters.enableFrequencyPenalty === false ? "text-gray-400" : "text-gray-700 dark:text-gray-300")}>频率惩罚</Label>
                <input
                  type="range"
                  className="flex-1 appearance-none w-full h-1.5 rounded-full cursor-pointer bg-gray-200 dark:bg-gray-700 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-150 [&::-webkit-slider-thumb]:hover:scale-105 disabled:[&::-webkit-slider-thumb]:shadow-none disabled:[&::-webkit-slider-thumb]:bg-gray-200 disabled:[&::-webkit-slider-thumb]:border-gray-300 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-blue-500 [&::-moz-range-thumb]:shadow-md [&::-webkit-slider-track]:rounded-full [&::-webkit-slider-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:h-1.5"
                  min={MODEL_PARAMETER_LIMITS.frequencyPenalty.min}
                  max={MODEL_PARAMETER_LIMITS.frequencyPenalty.max}
                  step={MODEL_PARAMETER_LIMITS.frequencyPenalty.step}
                  value={parameters.frequencyPenalty}
                  onChange={(e)=>setParameters(prev=>({...prev, frequencyPenalty: parseFloat(e.target.value)}))}
                  style={{ background: trackBg(parameters.frequencyPenalty, MODEL_PARAMETER_LIMITS.frequencyPenalty.min, MODEL_PARAMETER_LIMITS.frequencyPenalty.max, parameters.enableFrequencyPenalty === false) }}
                  disabled={parameters.enableFrequencyPenalty === false}
                  list="ticks-frequencyPenalty"
                />
                {/* datalist 刻度移除 */}
                <Checkbox aria-label="enable frequencyPenalty" checked={parameters.enableFrequencyPenalty !== false} onCheckedChange={(v)=>setParameters(prev=>({...prev, enableFrequencyPenalty: Boolean(v)}))} />
              </div>
              <div className="flex items-center ml-32 gap-2">
                <p className="text-xs text-gray-400 font-mono">frequencyPenalty</p>
                <div className="flex-1" />
                <Input
                  type="number"
                  className="h-7 w-24 text-right font-mono rounded-md border-gray-200 dark:border-gray-700 focus-visible:ring-2 focus-visible:ring-blue-500"
                  value={parameters.frequencyPenalty}
                  step={MODEL_PARAMETER_LIMITS.frequencyPenalty.step}
                  onChange={(e)=>setParameters(prev=>({...prev, frequencyPenalty: parseFloat(e.target.value || '0')}))}
                  disabled={parameters.enableFrequencyPenalty === false}
                />
              </div>
              <p className="text-xs text-gray-500 leading-relaxed ml-32">增大可降低重复词汇的概率。</p>
            </div>
          )}

          {(
              <div className="space-y-2">
              <div className="flex items-center gap-4">
                <Label className={cn("text-sm font-medium w-32 shrink-0", parameters.enablePresencePenalty === false ? "text-gray-400" : "text-gray-700 dark:text-gray-300")}>新主题倾向</Label>
                <input
                  type="range"
                  className="flex-1 appearance-none w-full h-1.5 rounded-full cursor-pointer bg-gray-200 dark:bg-gray-700 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-150 [&::-webkit-slider-thumb]:hover:scale-105 disabled:[&::-webkit-slider-thumb]:shadow-none disabled:[&::-webkit-slider-thumb]:bg-gray-200 disabled:[&::-webkit-slider-thumb]:border-gray-300 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-blue-500 [&::-moz-range-thumb]:shadow-md [&::-webkit-slider-track]:rounded-full [&::-webkit-slider-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:h-1.5"
                  min={MODEL_PARAMETER_LIMITS.presencePenalty.min}
                  max={MODEL_PARAMETER_LIMITS.presencePenalty.max}
                  step={MODEL_PARAMETER_LIMITS.presencePenalty.step}
                  value={parameters.presencePenalty}
                  onChange={(e)=>setParameters(prev=>({...prev, presencePenalty: parseFloat(e.target.value)}))}
                  style={{ background: trackBg(parameters.presencePenalty, MODEL_PARAMETER_LIMITS.presencePenalty.min, MODEL_PARAMETER_LIMITS.presencePenalty.max, parameters.enablePresencePenalty === false) }}
                  disabled={parameters.enablePresencePenalty === false}
                  list="ticks-presencePenalty"
                />
                {/* datalist 刻度移除 */}
                <Checkbox aria-label="enable presencePenalty" checked={parameters.enablePresencePenalty !== false} onCheckedChange={(v)=>setParameters(prev=>({...prev, enablePresencePenalty: Boolean(v)}))} />
              </div>
              <div className="flex items-center ml-32 gap-2">
                <p className="text-xs text-gray-400 font-mono">presencePenalty</p>
                <div className="flex-1" />
                <Input
                  type="number"
                  className="h-7 w-24 text-right font-mono rounded-md border-gray-200 dark:border-gray-700 focus-visible:ring-2 focus-visible:ring-blue-500"
                  value={parameters.presencePenalty}
                  step={MODEL_PARAMETER_LIMITS.presencePenalty.step}
                  onChange={(e)=>setParameters(prev=>({...prev, presencePenalty: parseFloat(e.target.value || '0')}))}
                  disabled={parameters.enablePresencePenalty === false}
                />
              </div>
              <p className="text-xs text-gray-500 leading-relaxed ml-32">增大可鼓励模型引入新话题。</p>
            </div>
          )}

          {/* Stop Sequences */}
            <div className="space-y-2">
            <div className="flex items-center gap-4">
              <Label className={cn("text-sm font-medium min-w-20", parameters.enableStopSequences === false ? "text-gray-400" : "text-gray-700 dark:text-gray-300") }>
                停止序列
              </Label>
              <div className="flex gap-2 flex-1">
                <Input
                  value={newStopSequence}
                  onChange={(e) => setNewStopSequence(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="输入停止序列..."
                  className="flex-1 text-sm rounded-md border-gray-200 dark:border-gray-700 focus-visible:ring-2 focus-visible:ring-blue-500"
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
              <Checkbox aria-label="enable stop sequences" checked={parameters.enableStopSequences !== false} onCheckedChange={(v)=>setParameters(prev=>({...prev, enableStopSequences: Boolean(v)}))} />
            </div>
            {stopSequences.length > 0 && (
              <div className="flex flex-wrap gap-2 ml-24">
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
            <p className="text-xs text-gray-400 ml-24 font-mono">stop</p>
            <p className="text-xs text-gray-500 leading-relaxed ml-24">
              当生成包含这些序列时停止生成。
            </p>
          </div>

          {/* 高级参数（JSON） */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">高级参数 (JSON)</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 text-[10px] cursor-default">!</span>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs leading-relaxed text-xs">
                      高级参数会被直接合并到请求选项（遵循各 Provider 的字段定义）。请仅在清楚目标模型/Provider 支持字段时使用；配置不当可能导致请求失败或被策略引擎覆盖。
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setAppliedPreviewOpen(v => !v)}>
                  {appliedPreviewOpen ? '隐藏预览' : '显示应用预览'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setAdvancedEditorOpen(v => !v)}>
                  {advancedEditorOpen ? '收起' : '展开'}
                </Button>
              </div>
            </div>
            {advancedEditorOpen && (
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
            )}
            {advancedJsonError ? (
              <p className="text-xs text-red-500">JSON 格式错误：{advancedJsonError}</p>
            ) : (
              <p className="text-xs text-gray-500">将作为高级选项直接合并到请求选项中（遵循各 Provider 字段）。</p>
            )}
            {appliedPreviewOpen && (
              <div className="mt-2 space-y-2">
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
              </div>
            )}
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
              重置为模型默认
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleReset}
              className="flex items-center gap-2 border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              重置为系统默认
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleClearSession}
              className="flex items-center gap-2 ml-auto border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              清除会话参数
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