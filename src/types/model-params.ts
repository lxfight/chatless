export interface ModelParameters {
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  stopSequences: string[];
}

export interface ModelConfig {
  providerName: string;
  modelId: string;
  parameters: ModelParameters;
  lastUpdated: number;
}

export const DEFAULT_MODEL_PARAMETERS: ModelParameters = {
  temperature: 0.7,
  maxTokens: 2048,
  topP: 1.0,
  frequencyPenalty: 0.0,
  presencePenalty: 0.0,
  stopSequences: []
};

export const MODEL_PARAMETER_LIMITS = {
  temperature: { min: 0.0, max: 2.0, step: 0.1 },
  maxTokens: { min: 1, max: 8192, step: 1 },
  topP: { min: 0.0, max: 1.0, step: 0.1 },
  frequencyPenalty: { min: -2.0, max: 2.0, step: 0.1 },
  presencePenalty: { min: -2.0, max: 2.0, step: 0.1 }
}; 