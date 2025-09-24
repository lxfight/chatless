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
    // Claude v1：用错误密钥走 /messages 判定是否可达
    const base = this.baseUrl.replace(/\/$/, '');
    const url = `${base}/messages`;
    const fakeKey = 'invalid_test_key_for_healthcheck';
    const body = { model: 'claude-3-opus-20240229', messages: [{ role: 'user', content: 'ping' }], stream: false } as any;
    try {
      const { tauriFetch } = await import('@/lib/request');
      const { judgeApiReachable } = await import('./healthcheck');
      const resp: any = await tauriFetch(url, {
        method: 'POST', rawResponse: true, browserHeaders: true,
        headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01', 'x-api-key': fakeKey },
        body, timeout: 5000, fallbackToBrowserOnError: true, debugTag: 'Anthropic-HealthCheck', verboseDebug: true, includeBodyInLogs: true
      });
      const status = (resp?.status ?? 0) as number;
      const text = (await resp.text?.()) || '';
      const judged = judgeApiReachable(status, text);
      if (judged.ok) return { ok: true, message: judged.message, meta: { status } };
      return { ok: false, reason: 'UNKNOWN', message: `HTTP ${status}`, meta: { status } };
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (/timeout|abort/i.test(msg)) return { ok: false, reason: 'TIMEOUT', message: '连接超时' };
      if (/network|fetch|ENOTFOUND|ECONN/i.test(msg)) return { ok: false, reason: 'NETWORK', message: '网络错误' };
      return { ok: false, reason: 'UNKNOWN', message: msg };
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
    if (options.topK !== undefined && mapped.top_k === undefined) mapped.top_k = options.topK;
    if (options.minP !== undefined && mapped.min_p === undefined) mapped.min_p = options.minP;

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
