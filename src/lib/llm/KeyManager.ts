import { specializedStorage } from '@/lib/storage';

/**
 * 简易密钥管理器：统一管理各 Provider 的 API Key
 * 后端存储使用 specializedStorage.llm (Tauri Store)
 */
export class KeyManager {
  /** 获取 Provider 级别 API Key */
  static async getProviderKey(provider: string): Promise<string | null> {
    return await specializedStorage.llm.getApiKey(provider);
  }

  /** 设置 Provider 级别 API Key */
  static async setProviderKey(provider: string, apiKey: string): Promise<void> {
    await specializedStorage.llm.setApiKey(provider, apiKey);
  }

  /** 模型级别 API Key */
  static async getModelKey(provider: string, model: string): Promise<string | null> {
    return await specializedStorage.llm.getApiKey(`${provider.toLowerCase()}_${model}`);
  }
  static async setModelKey(provider: string, model: string, apiKey: string): Promise<void> {
    await specializedStorage.llm.setApiKey(`${provider.toLowerCase()}_${model}`, apiKey);
  }
  static async removeModelKey(provider: string, model: string): Promise<void> {
    await specializedStorage.llm.removeApiKey(`${provider.toLowerCase()}_${model}`);
  }

  /** 移除 Provider Key */
  static async removeProviderKey(provider: string): Promise<void> {
    await specializedStorage.llm.removeApiKey(provider);
  }
}
