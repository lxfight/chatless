import { StorageUtil } from '@/lib/storage';

// 默认的 Ollama URL
const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

// 存储配置
const OLLAMA_CONFIG_STORE = 'user-settings.json';
const OLLAMA_CONFIG_KEY = 'ollamaConfig';

// 缓存机制
let urlCache: string | null = null;
let cacheExpiry: number = 0;
const CACHE_DURATION = 5000; // 5秒缓存

interface OllamaConfig {
  api_base_url?: string;
  default_api_key?: string | null;
}

/**
 * 统一的 Ollama 配置服务
 * 使用 StorageUtil 系统，简化架构
 */
export class OllamaConfigService {
  /**
   * 设置 Ollama URL 配置
   * @param url 新的 Ollama URL
   */
  static async setOllamaUrl(url: string): Promise<void> {
    try {
      // 获取现有配置
      const config = await this.getConfig();
      
      // 更新URL配置
      config.api_base_url = url;
      
      // 保存配置
      await StorageUtil.setItem(OLLAMA_CONFIG_KEY, config, OLLAMA_CONFIG_STORE);
      
      // 清除缓存，强制下次读取时重新加载
      this.clearCache();

      console.log('[OllamaConfigService] Ollama URL 配置已保存:', url);
    } catch (error) {
      console.error('[OllamaConfigService] 保存 Ollama URL 配置失败:', error);
      throw error;
    }
  }

  /**
   * 获取配置的 Ollama URL
   * 优先级：用户配置 > 默认值
   * 支持缓存以提高性能
   */
  static async getOllamaUrl(): Promise<string> {
    // 检查缓存
    const now = Date.now();
    if (urlCache && now < cacheExpiry) {
      return urlCache;
    }

    try {
      const config = await this.getConfig();
      let configuredUrl = DEFAULT_OLLAMA_URL;

      if (config.api_base_url && config.api_base_url.trim()) {
        configuredUrl = config.api_base_url;
        console.log('[OllamaConfigService] 使用用户配置的 Ollama URL:', configuredUrl);
      } else {
        console.log('[OllamaConfigService] 未找到用户配置或配置为空，使用默认 URL:', configuredUrl);
      }

      // 清理 URL - 移除末尾的斜杠
      configuredUrl = configuredUrl.replace(/\/+$/, '');

      // 更新缓存
      urlCache = configuredUrl;
      cacheExpiry = now + CACHE_DURATION;

      return configuredUrl;
    } catch (error) {
      console.error('[OllamaConfigService] 获取 Ollama URL 失败，使用默认值:', error);
      return DEFAULT_OLLAMA_URL;
    }
  }

  /**
   * 获取完整的 Ollama 配置
   */
  static async getConfig(): Promise<OllamaConfig> {
    try {
      const config = await StorageUtil.getItem<OllamaConfig>(OLLAMA_CONFIG_KEY, {}, OLLAMA_CONFIG_STORE);
      return config || {};
    } catch (error) {
      console.error('[OllamaConfigService] 获取配置失败:', error);
      return {};
    }
  }

  /**
   * 保存完整的 Ollama 配置
   */
  static async setConfig(config: OllamaConfig): Promise<void> {
    try {
      await StorageUtil.setItem(OLLAMA_CONFIG_KEY, config, OLLAMA_CONFIG_STORE);
      this.clearCache();
      console.log('[OllamaConfigService] 配置已保存');
    } catch (error) {
      console.error('[OllamaConfigService] 保存配置失败:', error);
      throw error;
    }
  }

  /**
   * 清除缓存，强制下次获取时重新读取配置
   */
  static clearCache(): void {
    urlCache = null;
    cacheExpiry = 0;
    console.log('[OllamaConfigService] 缓存已清除');
  }

  /**
   * 检查是否使用默认 URL
   */
  static async isUsingDefaultUrl(): Promise<boolean> {
    const currentUrl = await this.getOllamaUrl();
    return currentUrl === DEFAULT_OLLAMA_URL;
  }

  /**
   * 获取默认 URL
   */
  static getDefaultUrl(): string {
    return DEFAULT_OLLAMA_URL;
  }

  /**
   * 创建完整的 API 端点 URL
   * @param endpoint API 端点路径，如 '/api/tags'
   * @returns 完整的 URL
   */
  static async createEndpointUrl(endpoint: string): Promise<string> {
    const baseUrl = await this.getOllamaUrl();
    // 确保端点以 / 开头
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${baseUrl}${cleanEndpoint}`;
  }

  /**
   * 监听配置变更
   * 当配置发生变化时自动清除缓存
   */
  static onConfigChange(): void {
    this.clearCache();
  }
}

// 便捷的导出函数，保持向后兼容性
export const getOllamaUrl = () => OllamaConfigService.getOllamaUrl();
export const setOllamaUrl = (url: string) => OllamaConfigService.setOllamaUrl(url);
export const clearOllamaUrlCache = () => OllamaConfigService.clearCache();
export const createOllamaEndpoint = (endpoint: string) => OllamaConfigService.createEndpointUrl(endpoint); 