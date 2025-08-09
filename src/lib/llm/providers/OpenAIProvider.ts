import { BaseProvider, CheckResult, LlmMessage, StreamCallbacks } from './BaseProvider';
import { getStaticModels } from '../../provider/staticModels';
import { SSEClient } from '@/lib/sse-client';

export class OpenAIProvider extends BaseProvider {
  private sseClient: SSEClient;

  constructor(baseUrl: string, apiKey?: string, displayName: string = 'OpenAI') {
    super(displayName, baseUrl, apiKey);
    this.sseClient = new SSEClient('OpenAIProvider');
  }

  async fetchModels(): Promise<Array<{name: string, label?: string, aliases?: string[]}> | null> {
    // 暂不进行在线拉取，统一使用静态模型清单；按 provider 名称读取对应静态清单
    const key = this.name || 'OpenAI';
    const list = getStaticModels(key);
    return list?.map((m)=>({ name: m.id, label: m.label, aliases: [m.id] })) ?? null;
  }

  async checkConnection(): Promise<CheckResult> {
    // 暂不在线检查，仅判断是否配置密钥
    const apiKey = await this.getApiKey();
    if (!apiKey) return { ok: false, reason: 'NO_KEY', message: 'NO_KEY' };
    return { ok: true };
  }

  async chatStream(
    model: string, 
    messages: LlmMessage[], 
    cb: StreamCallbacks,
    opts: Record<string, any> = {}
  ): Promise<void> {
    const apiKey = await this.getApiKey(model);
    if (!apiKey) {
      cb.onError?.(new Error('NO_KEY'));
      return;
    }

    const url = `${this.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const body = {
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: true,
      ...opts
    };

    try {
      await this.sseClient.startConnection(
        {
          url,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body,
          debugTag: 'OpenAIProvider'
        },
        {
          onStart: cb.onStart,
          onError: cb.onError,
          onData: (rawData: string) => {
            // OpenAI 特定的数据解析逻辑
            if (!rawData.startsWith('data:')) return;
            const jsonStr = rawData.substring(5).trim();
            if (!jsonStr) return;
            if (jsonStr === '[DONE]') {
              cb.onComplete?.();
              this.sseClient.stopConnection();
              return;
            }
            try {
              const json = JSON.parse(jsonStr);
              const token = json?.choices?.[0]?.delta?.content;
              if (token) cb.onToken?.(token);
            } catch (err) {
              console.warn('[OpenAIProvider] JSON parse error', err);
            }
          }
        }
      );
    } catch (error: any) {
      console.error('[OpenAIProvider] SSE connection failed:', error);
      cb.onError?.(error);
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
