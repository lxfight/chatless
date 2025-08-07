"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { X, Plus, RotateCcw, Settings, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ModelParametersService } from "@/lib/model-parameters";
import type { ModelParameters } from "@/types/model-params";
import { DEFAULT_MODEL_PARAMETERS, MODEL_PARAMETER_LIMITS } from "@/types/model-params";

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
  const [parameters, setParameters] = useState<ModelParameters>(DEFAULT_MODEL_PARAMETERS);
  const [stopSequences, setStopSequences] = useState<string[]>([]);
  const [newStopSequence, setNewStopSequence] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [parameterSource, setParameterSource] = useState<'default' | 'model' | 'session'>('default');
  const [hasChanges, setHasChanges] = useState(false);

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

  const loadParameters = async () => {
    try {
      // 优先级：当前会话参数 > 已保存的会话参数 > 模型默认参数 > 系统默认参数
      if (currentParameters) {
        setParameters(currentParameters);
        setStopSequences(currentParameters.stopSequences || []);
        setParameterSource('session');
      } else {
        // 尝试加载已保存的会话参数
        const sessionParams = await ModelParametersService.getSessionParameters(conversationId);
        if (sessionParams) {
          setParameters(sessionParams);
          setStopSequences(sessionParams.stopSequences || []);
          setParameterSource('session');
        } else {
          // 尝试加载模型默认参数
          const modelParams = await ModelParametersService.getModelParameters(providerName, modelId);
          if (modelParams && modelParams !== DEFAULT_MODEL_PARAMETERS) {
            setParameters(modelParams);
            setStopSequences(modelParams.stopSequences || []);
            setParameterSource('model');
          } else {
            setParameters(DEFAULT_MODEL_PARAMETERS);
            setStopSequences([]);
            setParameterSource('default');
          }
        }
      }
    } catch (error) {
      console.error('加载参数失败:', error);
      setParameters(DEFAULT_MODEL_PARAMETERS);
      setStopSequences([]);
      setParameterSource('default');
    }
  };

  const handleApply = async () => {
    setIsLoading(true);
    try {
      const sessionParams = {
        ...parameters,
        stopSequences
      };
      
      // 保存会话参数到存储
      await ModelParametersService.setSessionParameters(conversationId, sessionParams);
      
      // 通知父组件参数变更
      onParametersChange(sessionParams);
      onOpenChange(false);
    } catch (error) {
      console.error('应用会话参数失败:', error);
    } finally {
      setIsLoading(false);
    }
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
      
      // 重置为模型默认参数
      await handleResetToModelDefault();
    } catch (error) {
      console.error('清除会话参数失败:', error);
      setParameters(DEFAULT_MODEL_PARAMETERS);
      setStopSequences([]);
      setParameterSource('default');
    }
  };

  const addStopSequence = () => {
    if (newStopSequence.trim() && !stopSequences.includes(newStopSequence.trim())) {
      setStopSequences([...stopSequences, newStopSequence.trim()]);
      setNewStopSequence("");
      setParameterSource('session');
    }
  };

  const removeStopSequence = (index: number) => {
    setStopSequences(stopSequences.filter((_, i) => i !== index));
    setParameterSource('session');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addStopSequence();
    }
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

  const ParameterSlider = ({ 
    id, 
    label, 
    value, 
    onChange, 
    min, 
    max, 
    step, 
    description 
  }: {
    id: string;
    label: string;
    value: number;
    onChange: (value: number) => void;
    min: number;
    max: number;
    step: number;
    description: string;
  }) => (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <Label htmlFor={id} className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-20">
          {label}
        </Label>
        <div className="flex-1">
          <Slider
            id={id}
            value={[value]}
            onValueChange={(values: number[]) => {
              onChange(values[0]);
              setParameterSource('session');
            }}
            min={min}
            max={max}
            step={step}
            className="w-full"
          />
        </div>
        <span className="text-sm font-mono text-gray-600 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded min-w-12 text-center">
          {value}
        </span>
      </div>
      <p className="text-xs text-gray-500 leading-relaxed ml-24">
        {description}
      </p>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <Settings className="w-5 h-5 text-blue-500 dark:text-blue-400" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
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
              </div>
            </div>
          
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          <ParameterSlider
            id="temperature"
            label="Temperature"
            value={parameters.temperature}
            onChange={(value) => setParameters(prev => ({ ...prev, temperature: value }))}
            min={MODEL_PARAMETER_LIMITS.temperature.min}
            max={MODEL_PARAMETER_LIMITS.temperature.max}
            step={MODEL_PARAMETER_LIMITS.temperature.step}
            description="控制输出的随机性。较低的值使输出更确定，较高的值使输出更随机。"
          />

          <ParameterSlider
            id="maxTokens"
            label="最大Token数"
            value={parameters.maxTokens}
            onChange={(value) => setParameters(prev => ({ ...prev, maxTokens: value }))}
            min={MODEL_PARAMETER_LIMITS.maxTokens.min}
            max={MODEL_PARAMETER_LIMITS.maxTokens.max}
            step={MODEL_PARAMETER_LIMITS.maxTokens.step}
            description="限制生成回复的最大token数量。"
          />

          <ParameterSlider
            id="topP"
            label="Top P"
            value={parameters.topP}
            onChange={(value) => setParameters(prev => ({ ...prev, topP: value }))}
            min={MODEL_PARAMETER_LIMITS.topP.min}
            max={MODEL_PARAMETER_LIMITS.topP.max}
            step={MODEL_PARAMETER_LIMITS.topP.step}
            description="控制词汇选择的多样性。较低的值使选择更保守。"
          />

          <ParameterSlider
            id="frequencyPenalty"
            label="频率惩罚"
            value={parameters.frequencyPenalty}
            onChange={(value) => setParameters(prev => ({ ...prev, frequencyPenalty: value }))}
            min={MODEL_PARAMETER_LIMITS.frequencyPenalty.min}
            max={MODEL_PARAMETER_LIMITS.frequencyPenalty.max}
            step={MODEL_PARAMETER_LIMITS.frequencyPenalty.step}
            description="减少重复使用相同词汇的倾向。"
          />

          <ParameterSlider
            id="presencePenalty"
            label="存在惩罚"
            value={parameters.presencePenalty}
            onChange={(value) => setParameters(prev => ({ ...prev, presencePenalty: value }))}
            min={MODEL_PARAMETER_LIMITS.presencePenalty.min}
            max={MODEL_PARAMETER_LIMITS.presencePenalty.max}
            step={MODEL_PARAMETER_LIMITS.presencePenalty.step}
            description="鼓励模型谈论新话题。"
          />

          {/* Stop Sequences */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-20">
                停止序列
              </Label>
              <div className="flex gap-2 flex-1">
                <Input
                  value={newStopSequence}
                  onChange={(e) => setNewStopSequence(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="输入停止序列..."
                  className="flex-1 text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addStopSequence}
                  disabled={!newStopSequence.trim()}
                  className="px-3"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
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
            <p className="text-xs text-gray-500 leading-relaxed ml-24">
              当生成包含这些序列时停止生成。
            </p>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/20">
          <div className="flex items-center gap-2 w-full">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleResetToModelDefault}
              className="flex items-center gap-2 border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <RotateCcw className="w-4 h-4" />
              重置为模型默认
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleResetToSystemDefault}
              className="flex items-center gap-2 border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              重置为系统默认
            </Button>
            {parameterSource === 'session' && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleClearSessionParameters}
                className="flex items-center gap-2 ml-auto border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                清除会话参数
              </Button>
            )}
            <Button 
              onClick={handleApply} 
              disabled={isLoading}
              className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white shadow-sm"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  应用中...
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