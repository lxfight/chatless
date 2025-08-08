import { BaseProvider, CheckResult, LlmMessage, StreamCallbacks } from './BaseProvider';
import { STATIC_PROVIDER_MODELS } from '../../provider/staticModels';
import { SSEClient } from '@/lib/sse-client';

/**
 * DeepSeek（深度寻求）模型服务 Provider
 * 目前仅实现健康检查与占位 chatStream，后续可根据官方 API 填充。
 */
export class DeepSeekProvider extends BaseProvider {
  private sseClient: SSEClient;

  constructor(baseUrl: string, apiKey?: string) {
    super('DeepSeek', baseUrl, apiKey);
    this.sseClient = new SSEClient('DeepSeekProvider');
  }

  async checkConnection(): Promise<CheckResult> {
    // DeepSeek 目前无公开健康端点；尝试获取模型列表或返回 NO_KEY 占位
    const key = await this.getApiKey();
    if (!key) return { ok: false, reason: 'NO_KEY', message: 'NO_KEY' };
    return { ok: true };
  }

  /**
   * DeepSeek ChatCompletion 流式接口实现
   * 文档: https://api-docs.deepseek.com/api/create-chat-completion
   */
  async chatStream(
    model: string,
    messages: LlmMessage[],
    cb: StreamCallbacks,
    opts: Record<string, any> = {}
  ): Promise<void> {
    // 组合请求参数
    const url = `${this.baseUrl.replace(/\/$/, '')}/chat/completions`;

    const body = {
      model,
      stream: true,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      ...opts,
    };

    // 准备请求头
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const apiKey = await this.getApiKey(model);
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    try {
      await this.sseClient.startConnection(
        {
          url,
          method: 'POST',
          headers,
          body,
          debugTag: 'DeepSeekProvider'
        },
        {
          onStart: cb.onStart,
          onError: cb.onError,
          onData: (rawData: string) => {
            // DeepSeek 特定的数据解析逻辑
            if (!rawData) return;

            // DeepSeek 与 OpenAI 一样, 以 "[DONE]" 结束
            if (rawData.trim() === '[DONE]') {
              cb.onComplete?.();
              this.sseClient.stopConnection();
              return;
            }

            try {
              const json = JSON.parse(rawData);
              const token = json?.choices?.[0]?.delta?.content;
              if (token) cb.onToken?.(token);
            } catch (err) {
              // 无法解析 JSON, 直接回传原始数据
              console.warn('[DeepSeekProvider] Failed to parse SSE chunk, fallback to raw:', err);
              cb.onToken?.(rawData);
            }
          }
        }
      );
    } catch (error: any) {
      console.error('[DeepSeekProvider] SSE connection failed:', error);
      cb.onError?.(error);
    }
  }

  async fetchModels(): Promise<Array<{name: string, label?: string, aliases?: string[]}> | null> {
    return STATIC_PROVIDER_MODELS['DeepSeek']?.map((m)=>({
      name: m.id,
      label: m.label,
      aliases: [m.id]
    })) ?? null;
  }

  /**
   * 清理资源
   */
  async destroy(): Promise<void> {
    await this.sseClient.destroy();
  }

  /**
   * 取消流式连接
   */
  cancelStream(): void {
    this.sseClient.stopConnection();
  }
}
