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
    return {
      temperature: parameters.temperature,
      maxTokens: parameters.maxTokens,
      topP: parameters.topP,
      frequencyPenalty: parameters.frequencyPenalty,
      presencePenalty: parameters.presencePenalty,
      stop: parameters.stopSequences.length > 0 ? parameters.stopSequences : undefined,
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