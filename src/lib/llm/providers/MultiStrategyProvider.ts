import { BaseProvider, CheckResult, LlmMessage, StreamCallbacks } from './BaseProvider';
import { OpenAIProvider } from './OpenAIProvider';
import { OpenAICompatibleProvider } from './OpenAICompatibleProvider';
import { AnthropicProvider } from './AnthropicProvider';
import { GoogleAIProvider } from './GoogleAIProvider';
import { DeepSeekProvider } from './DeepSeekProvider';
import { SSEClient } from '@/lib/sse-client';

/**
 * MultiStrategyProvider
 * - 作为“聚合/中继”的统一入口，根据“模型级策略覆盖”选择具体下游 Provider 行为
 * - 设计目标：支持 New API 这类每个模型对应不同协议的网关
 */
export class MultiStrategyProvider extends BaseProvider {
  private sseClient: SSEClient;

  constructor(displayName: string, baseUrl: string, apiKey?: string) {
    super(displayName, baseUrl, apiKey);
    this.sseClient = new SSEClient('MultiStrategyProvider');
  }

  async checkConnection(): Promise<CheckResult> {
    const key = await this.getApiKey();
    if (!key) return { ok: false, reason: 'NO_KEY', message: 'NO_KEY' };
    return { ok: true };
  }

  /**
   * chatStream：按模型的“策略覆盖”去委派到相应 Provider 的实现
   * 策略来源优先级：模型级策略覆盖 > Provider 默认策略(openai-compatible)
   */
  async chatStream(
    model: string,
    messages: LlmMessage[],
    callbacks: StreamCallbacks,
    options: Record<string, any> = {}
  ): Promise<void> {
    const apiKey = await this.getApiKey(model);
    if (!apiKey) {
      callbacks.onError?.(new Error('NO_KEY'));
      return;
    }

    // 读取模型级策略覆盖
    const strategy = await this.getModelStrategy(model);

    // 实例化对应 provider，并复用当前 baseUrl 与密钥
    const delegate = await this.createDelegate(strategy);
    // 把多策略 Provider 的 baseUrl 作为下游 provider 的 baseUrl
    (delegate as any).baseUrl = this.baseUrl;
    (delegate as any).aliasProviderName = this.name;

    return delegate.chatStream(model, messages, callbacks, options);
  }

  /**
   * 获取模型级策略覆盖；若不存在则回退到 openai-compatible
   */
  private async getModelStrategy(model: string): Promise<'openai' | 'openai-compatible' | 'anthropic' | 'gemini' | 'deepseek'> {
    try {
      const { specializedStorage } = await import('@/lib/storage');
      const override = await specializedStorage.models.getModelStrategy(this.name, model);
      if (override && (['openai','openai-compatible','anthropic','gemini','deepseek'] as string[]).includes(override)) return override as any;
      const def = await specializedStorage.models.getProviderDefaultStrategy(this.name);
      if (def && (['openai','openai-compatible','anthropic','gemini','deepseek'] as string[]).includes(def)) return def as any;
    } catch (_) {}
    return 'openai-compatible';
  }

  private async createDelegate(strategy: string) {
    const key = await this.getApiKey();
    switch (strategy) {
      case 'openai':
        return new OpenAIProvider(this.baseUrl, key || undefined, this.name);
      case 'anthropic':
        return new AnthropicProvider(this.baseUrl, key || undefined);
      case 'gemini':
        return new GoogleAIProvider(this.baseUrl, key || undefined);
      case 'deepseek':
        return new DeepSeekProvider(this.baseUrl, key || undefined);
      case 'openai-compatible':
      default:
        return new OpenAICompatibleProvider(this.baseUrl, key || undefined, this.name);
    }
  }

  async destroy(): Promise<void> {
    await this.sseClient.destroy();
  }

  cancelStream(): void {
    this.sseClient.stopConnection();
  }
}


