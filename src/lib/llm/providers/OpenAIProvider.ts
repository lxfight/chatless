import { BaseProvider, CheckResult, LlmMessage, StreamCallbacks } from './BaseProvider';
import { STATIC_PROVIDER_MODELS } from '../../provider/staticModels';
import { tauriFetch } from '@/lib/request';
import { SSEClient } from '@/lib/sse-client';

export class OpenAIProvider extends BaseProvider {
  private sseClient: SSEClient;

  constructor(baseUrl: string, apiKey?: string) {
    super('OpenAI', baseUrl, apiKey);
    this.sseClient = new SSEClient('OpenAIProvider');
  }

  async fetchModels(): Promise<Array<{name: string, label?: string, aliases?: string[]}> | null> {
    return STATIC_PROVIDER_MODELS['OpenAI']?.map((m)=>({
      name: m.id,
      label: m.label,
      aliases: [m.id]
    })) ?? null;
  }

  async checkConnection(): Promise<CheckResult> {
    const apiKey = await this.getApiKey();
    if (!apiKey) return { success: false, message: 'NO_KEY' };
    
    const url = `${this.baseUrl.replace(/\/$/, '')}/models`;
    
    try {
      // 添加超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8秒超时
      
      try {
        const resp = await tauriFetch(url, {
          method: 'GET',
          headers: { Authorization: `Bearer ${apiKey}` },
          rawResponse: true,
          timeout: 8000 // 同时设置tauriFetch的超时
        }) as Response;
        
        clearTimeout(timeoutId);
        return resp.ok ? { success: true } : { success: false, message: `HTTP ${resp.status}` };
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error: any) {
      console.error('[OpenAIProvider] checkConnection error:', error);
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
