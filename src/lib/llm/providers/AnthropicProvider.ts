import { BaseProvider, CheckResult, StreamCallbacks, LlmMessage } from './BaseProvider';
import { getStaticModels } from '../../provider/staticModels';
import { SSEClient } from '@/lib/sse-client';

/**
 * Anthropic Claude Provider (v1 REST API)
 * Docs: https://docs.anthropic.com/claude/reference/messages_post
 */
export class AnthropicProvider extends BaseProvider {
  private sseClient: SSEClient;

  constructor(baseUrl: string, apiKey?: string) {
    super('Anthropic', baseUrl, apiKey);
    this.sseClient = new SSEClient('AnthropicProvider');
  }

  async fetchModels(): Promise<Array<{name: string, label?: string, aliases?: string[]}> | null> {
    const list = getStaticModels('Anthropic');
    return list?.map((m)=>({ name: m.id, label: m.label, aliases: [m.id] })) ?? null;
  }

  async checkConnection(): Promise<CheckResult> {
    const apiKey = await this.getApiKey();
    if (!apiKey) return { ok: false, reason: 'NO_KEY', message: 'NO_KEY' };
    
    // 使用专门的连通性检查函数
    const baseUrl = this.baseUrl.replace(/\/$/, '');
    console.log(`[AnthropicProvider] 开始检查网络连通性: ${baseUrl}`);
    
    const { checkConnectivity } = await import('@/lib/request');
    const result = await checkConnectivity(baseUrl, {
      timeout: 5000,
      debugTag: 'AnthropicProvider-Connectivity'
    });
    
    if (result.ok) {
      console.log(`[AnthropicProvider] 网络连通性检查成功，状态码: ${result.status}`);
      return { ok: true, message: '网络连接正常' };
    } else {
      console.error(`[AnthropicProvider] 网络连通性检查失败: ${result.reason}`, result.error);
      
      switch (result.reason) {
        case 'TIMEOUT':
          return { ok: false, reason: 'TIMEOUT', message: '连接超时' };
        case 'NETWORK':
          return { ok: false, reason: 'NETWORK', message: '网络连接失败' };
        default:
          return { ok: false, reason: 'UNKNOWN', message: result.error || '未知错误' };
      }
    }
  }

  /**
   * Streaming chat. NOTE: current implementation is basic and may need refinement for delta events.
   */
  async chatStream(
    model: string,
    messages: LlmMessage[],
    callbacks: StreamCallbacks,
    options: any = {}
  ): Promise<void> {
    const apiKey = await this.getApiKey(model);
    if (!apiKey) {
      const err = new Error('NO_KEY');
      (err as any).code = 'NO_KEY';
      (err as any).userMessage = '未配置 API 密钥（Anthropic）。请在设置中配置密钥后重试';
      callbacks.onError?.(err);
      return;
    }

    // Claude expects messages as array of {role, content}
    const endpoint = `${this.baseUrl.replace(/\/$/, '')}/messages`;
    const mapped: any = { ...options };
    if (options.maxTokens !== undefined && mapped.max_tokens === undefined) mapped.max_tokens = options.maxTokens;
    if (options.maxOutputTokens !== undefined && mapped.max_tokens === undefined) mapped.max_tokens = options.maxOutputTokens;
    if (options.stop !== undefined && mapped.stop_sequences === undefined) mapped.stop_sequences = options.stop;
    if (options.topP !== undefined && mapped.top_p === undefined) mapped.top_p = options.topP;

    const body = {
      model,
      messages,
      stream: true,
      ...mapped,
    };

    try {
      await this.sseClient.startConnection(
        {
          url: endpoint,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(body),
          debugTag: 'AnthropicProvider'
        },
        {
          onStart: callbacks.onStart,
          onError: callbacks.onError,
          onData: (rawData: string) => {
            // Anthropic 特定的数据解析逻辑
            try {
              // Anthropic streams JSON lines separated by newlines.
              if (!rawData) return;
              const parts = rawData.trim().split('\n');
              for (const part of parts) {
                if (part.startsWith('{')) {
                  const json = JSON.parse(part);
                  if (json.type === 'content_block_delta') {
                    const token = json.delta?.text;
                    if (token) callbacks.onToken?.(token);
                  } else if (json.type === 'message_stop') {
                    callbacks.onComplete?.();
                    this.sseClient.stopConnection();
                  }
                }
              }
            } catch (err) {
              console.error('[Anthropic SSE] parse error', err);
            }
          }
        }
      );
    } catch (error: any) {
      console.error('[AnthropicProvider] SSE connection failed:', error);
      callbacks.onError?.(error);
    }
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
