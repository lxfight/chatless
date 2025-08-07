import { BaseProvider, CheckResult, StreamCallbacks, LlmMessage } from './BaseProvider';
import { STATIC_PROVIDER_MODELS } from '../../provider/staticModels';
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
    return STATIC_PROVIDER_MODELS['Anthropic']?.map((m)=>({
      name: m.id,
      label: m.label,
      aliases: [m.id]
    })) ?? null;
  }

  async checkConnection(): Promise<CheckResult> {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      return { success: false, message: 'NO_KEY' };
    }
    
    try {
      const url = `${this.baseUrl.replace(/\/$/, '')}/models`;
      
      // 添加超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8秒超时
      
      try {
        const response = await this.fetchJson(url, {
          method: 'GET',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          rawResponse: true,
          timeout: 8000 // 同时设置fetchJson的超时
        } as any);
        
        clearTimeout(timeoutId);
        return (response as Response).ok
          ? { success: true }
          : { success: false, message: `HTTP ${(response as Response).status} ${(response as Response).statusText}` };
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error: any) {
      console.error('[AnthropicProvider] checkConnection error:', error);
      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.includes('timeout')) {
          return { success: false, message: '连接超时' };
        }
        if (error.message.includes('fetch') || error.message.includes('network')) {
          return { success: false, message: '网络连接失败' };
        }
        return { success: false, message: error.message };
      }
      return { success: false, message: '未知错误' };
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
