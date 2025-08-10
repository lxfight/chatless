export interface ModelParameters {
  // 启用/禁用控制（为每个基础参数提供可选开关）
  enableTemperature?: boolean;
  enableMaxTokens?: boolean;
  enableTopP?: boolean;
  enableFrequencyPenalty?: boolean;
  enablePresencePenalty?: boolean;
  enableStopSequences?: boolean;

  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  stopSequences: string[];
  /** 可选：高级参数（将直接合并到 Provider 选项中），例如 Gemini 的 generationConfig */
  advancedOptions?: Record<string, any>;
}

export interface ModelConfig {
  providerName: string;
  modelId: string;
  parameters: ModelParameters;
  lastUpdated: number;
}

export const DEFAULT_MODEL_PARAMETERS: ModelParameters = {
  // 模型参数默认均未启用：开箱即用“不下发”，仅在开启后才覆盖模型默认
  enableTemperature: false,
  enableMaxTokens: false,
  enableTopP: false,
  enableFrequencyPenalty: false,
  enablePresencePenalty: false,
  enableStopSequences: false,
  temperature: 0.7,
  maxTokens: 2048,
  topP: 1.0,
  frequencyPenalty: 0.0,
  presencePenalty: 0.0,
  stopSequences: [],
  advancedOptions: {}
};

export const MODEL_PARAMETER_LIMITS = {
  temperature: { min: 0.0, max: 2.0, step: 0.1 },
  maxTokens: { min: 1, max: 8192, step: 1 },
  topP: { min: 0.0, max: 1.0, step: 0.1 },
  frequencyPenalty: { min: -2.0, max: 2.0, step: 0.1 },
  presencePenalty: { min: -2.0, max: 2.0, step: 0.1 }
}; 