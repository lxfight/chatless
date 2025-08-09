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
    // 暂不在线检查，仅判断是否配置密钥
    const apiKey = await this.getApiKey();
    if (!apiKey) return { ok: false, reason: 'NO_KEY', message: 'NO_KEY' };
    return { ok: true };
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
      callbacks.onError?.(new Error('NO_KEY'));
      return;
    }

    // Claude expects messages as array of {role, content}
    const endpoint = `${this.baseUrl.replace(/\/$/, '')}/messages`;
    const body = {
      model,
      messages,
      max_tokens: options?.maxOutputTokens ?? 1024,
      stream: true,
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
