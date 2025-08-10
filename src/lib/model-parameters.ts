import { specializedStorage } from './storage';
import { DEFAULT_MODEL_PARAMETERS } from '@/types/model-params';
import type { ModelParameters } from '@/types/model-params';

export class ModelParametersService {
  /**
   * 获取指定模型的参数配置
   */
  static async getModelParameters(providerName: string, modelId: string): Promise<ModelParameters> {
    try {
      const savedParams = await specializedStorage.models.getModelParameters(providerName, modelId);
      if (savedParams) {
        return savedParams as ModelParameters;
      }
      return DEFAULT_MODEL_PARAMETERS;
    } catch (error) {
      console.error('获取模型参数失败:', error);
      return DEFAULT_MODEL_PARAMETERS;
    }
  }

  /**
   * 保存模型参数配置
   */
  static async setModelParameters(
    providerName: string, 
    modelId: string, 
    parameters: ModelParameters
  ): Promise<void> {
    try {
      await specializedStorage.models.setModelParameters(providerName, modelId, parameters);
    } catch (error) {
      console.error('保存模型参数失败:', error);
      throw error;
    }
  }

  /**
   * 删除模型参数配置
   */
  static async removeModelParameters(providerName: string, modelId: string): Promise<void> {
    try {
      await specializedStorage.models.removeModelParameters(providerName, modelId);
    } catch (error) {
      console.error('删除模型参数失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有模型参数配置的键
   */
  static async getAllModelParameterKeys(): Promise<string[]> {
    try {
      return await specializedStorage.models.getAllModelParameters();
    } catch (error) {
      console.error('获取所有模型参数键失败:', error);
      return [];
    }
  }

  /**
   * 将模型参数转换为聊天选项格式
   */
  static convertToChatOptions(parameters: ModelParameters): Record<string, any> {
    const opts: Record<string, any> = { ...(parameters.advancedOptions || {}) };
    if (parameters.enableTemperature !== false) {
      opts.temperature = parameters.temperature;
    }
    if (parameters.enableMaxTokens !== false) {
      opts.maxTokens = parameters.maxTokens;
    }
    if (parameters.enableTopP !== false) {
      opts.topP = parameters.topP;
    }
    if (parameters.enableFrequencyPenalty !== false) {
      opts.frequencyPenalty = parameters.frequencyPenalty;
    }
    if (parameters.enablePresencePenalty !== false) {
      opts.presencePenalty = parameters.presencePenalty;
    }
    if (parameters.enableStopSequences !== false) {
      if (parameters.stopSequences.length > 0) {
        opts.stop = parameters.stopSequences;
      }
    }
    return opts;
  }

  /**
   * 反向解析：将通用 ChatOptions 拆解回 ModelParameters 结构（基础参数 + 高级参数）
   * - 会尽量从顶层或 generationConfig 中提取基础参数
   * - 其余参数保留在 advancedOptions 中，且会移除与基础参数重复的字段
   */
  static parseFromChatOptions(options: Record<string, any> | null | undefined): ModelParameters {
    const src: any = options || {};
    const gen: any = (src.generationConfig && typeof src.generationConfig === 'object') ? src.generationConfig : {};

    const temperature: number =
      (typeof src.temperature === 'number' ? src.temperature :
        (typeof gen.temperature === 'number' ? gen.temperature : DEFAULT_MODEL_PARAMETERS.temperature));

    const maxTokens: number =
      (typeof src.maxTokens === 'number' ? src.maxTokens :
        (typeof src.maxOutputTokens === 'number' ? src.maxOutputTokens :
          (typeof gen.maxOutputTokens === 'number' ? gen.maxOutputTokens : DEFAULT_MODEL_PARAMETERS.maxTokens)));

    const topP: number =
      (typeof src.topP === 'number' ? src.topP :
        (typeof gen.topP === 'number' ? gen.topP : DEFAULT_MODEL_PARAMETERS.topP));

    const frequencyPenalty: number =
      (typeof src.frequencyPenalty === 'number' ? src.frequencyPenalty : DEFAULT_MODEL_PARAMETERS.frequencyPenalty);

    const presencePenalty: number =
      (typeof src.presencePenalty === 'number' ? src.presencePenalty : DEFAULT_MODEL_PARAMETERS.presencePenalty);

    const stopSeq: string[] = Array.isArray(src.stop)
      ? src.stop as string[]
      : (Array.isArray(gen.stopSequences) ? gen.stopSequences as string[] : []);

    // 构造 advancedOptions：从深拷贝的对象中移除基础字段
    const advanced = JSON.parse(JSON.stringify(src || {}));
    // 移除顶层基础字段
    delete advanced.temperature;
    delete advanced.maxTokens;
    delete advanced.maxOutputTokens;
    delete advanced.topP;
    delete advanced.frequencyPenalty;
    delete advanced.presencePenalty;
    delete advanced.stop;
    // 移除 generationConfig 中与基础字段重复的项
    if (advanced.generationConfig && typeof advanced.generationConfig === 'object') {
      if (advanced.generationConfig.temperature !== undefined) delete advanced.generationConfig.temperature;
      if (advanced.generationConfig.maxOutputTokens !== undefined) delete advanced.generationConfig.maxOutputTokens;
      if (advanced.generationConfig.topP !== undefined) delete advanced.generationConfig.topP;
      if (advanced.generationConfig.stopSequences !== undefined) delete advanced.generationConfig.stopSequences;
      // 如果 generationConfig 变空对象，保留（兼容后续可能新增字段），不特殊处理
    }

    return {
      temperature,
      maxTokens,
      topP,
      frequencyPenalty,
      presencePenalty,
      stopSequences: stopSeq,
      advancedOptions: advanced,
    };
  }

  // ========== 会话参数相关方法 ==========

  /**
   * 获取指定会话的参数配置
   */
  static async getSessionParameters(conversationId: string): Promise<ModelParameters | null> {
    try {
      const savedParams = await specializedStorage.models.getSessionParameters(conversationId);
      if (savedParams) {
        return savedParams as ModelParameters;
      }
      return null;
    } catch (error) {
      console.error('获取会话参数失败:', error);
      return null;
    }
  }

  /**
   * 保存会话参数配置
   */
  static async setSessionParameters(
    conversationId: string, 
    parameters: ModelParameters
  ): Promise<void> {
    try {
      await specializedStorage.models.setSessionParameters(conversationId, parameters);
    } catch (error) {
      console.error('保存会话参数失败:', error);
      throw error;
    }
  }

  /**
   * 删除会话参数配置
   */
  static async removeSessionParameters(conversationId: string): Promise<void> {
    try {
      await specializedStorage.models.removeSessionParameters(conversationId);
    } catch (error) {
      console.error('删除会话参数失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有会话参数配置的键
   */
  static async getAllSessionParameterKeys(): Promise<string[]> {
    try {
      return await specializedStorage.models.getAllSessionParameters();
    } catch (error) {
      console.error('获取所有会话参数键失败:', error);
      return [];
    }
  }
} 