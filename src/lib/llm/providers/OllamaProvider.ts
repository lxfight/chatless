import { BaseProvider, CheckResult, LlmMessage, StreamCallbacks } from './BaseProvider';
import { SSEClient } from '@/lib/sse-client';

export class OllamaProvider extends BaseProvider {
  private sseClient: SSEClient;

  constructor(baseUrl: string) {
    super('Ollama', baseUrl);
    this.sseClient = new SSEClient();
  }

  async checkConnection(): Promise<CheckResult> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/api/tags`;
    let resp: Response;
    
    console.log(`[OllamaProvider] 开始检查连接: ${url}`);
    
    try {
      // 添加超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8秒超时
      
      try {
        console.log(`[OllamaProvider] 尝试使用 tauriFetch 连接...`);
        const { tauriFetch } = await import('@/lib/request');
        resp = (await tauriFetch(url, { 
          method: 'GET', 
          rawResponse: true,
          browserHeaders: true,
          danger: { acceptInvalidCerts: true, acceptInvalidHostnames: true },
          timeout: 8000 // 同时设置tauriFetch的超时
        }));
        console.log(`[OllamaProvider] tauriFetch 成功，状态码: ${resp.status}`);
        
        // 添加头部调试
        try {
          const { extractHeadersFromResponse, debugHeaders } = await import('@/lib/utils/debug-headers');
          const headerInfo = extractHeadersFromResponse(resp, url, 'GET');
          debugHeaders(headerInfo);
        } catch (debugError) {
          console.warn('头部调试工具加载失败:', debugError);
        }
        
      } catch (fetchError) {
        console.warn(`[OllamaProvider] tauriFetch 失败，尝试原生 fetch:`, fetchError);
        // 如果tauriFetch失败，尝试使用原生fetch
        try {
          console.log(`[OllamaProvider] 尝试使用原生 fetch 连接...`);
          resp = await fetch(url, { 
            method: 'GET',
            signal: controller.signal
          });
          console.log(`[OllamaProvider] 原生 fetch 成功，状态码: ${resp.status}`);
          
          // 添加头部调试
          try {
            const { extractHeadersFromResponse, debugHeaders } = await import('@/lib/utils/debug-headers');
            const headerInfo = extractHeadersFromResponse(resp, url, 'GET');
            debugHeaders(headerInfo);
          } catch (debugError) {
            console.warn('头部调试工具加载失败:', debugError);
          }
          
        } catch (nativeFetchError) {
          clearTimeout(timeoutId);
          console.error(`[OllamaProvider] 原生 fetch 也失败:`, nativeFetchError);
          if (nativeFetchError instanceof Error && nativeFetchError.name === 'AbortError') {
            return { ok: false, reason: 'TIMEOUT', message: '连接超时（8秒内无响应）' };
          }
          throw nativeFetchError;
        }
      }
      
      clearTimeout(timeoutId);
      
      if (resp.ok) {
        console.log(`[OllamaProvider] 连接检查成功`);
        return { ok: true };
      }
      
      console.warn(`[OllamaProvider] 服务器响应错误，状态码: ${resp.status}`);
      return { ok: false, reason: 'UNKNOWN', message: `HTTP ${resp.status} - 服务器响应错误` };
    } catch (error) {
      console.error('[OllamaProvider] checkConnection error:', error);
      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.includes('timeout')) {
          return { ok: false, reason: 'TIMEOUT', message: '连接超时（8秒内无响应）' };
        }
        if (error.message.includes('fetch') || error.message.includes('network')) {
          return { ok: false, reason: 'NETWORK', message: '网络连接失败 - 请检查网络和服务器地址' };
        }
        if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
          return { ok: false, reason: 'NETWORK', message: '无法解析服务器地址 - 请检查URL是否正确' };
        }
        if (error.message.includes('ECONNREFUSED')) {
          return { ok: false, reason: 'NETWORK', message: '连接被拒绝 - 请检查服务器是否运行在端口6434' };
        }
        return { ok: false, reason: 'UNKNOWN', message: `连接错误: ${error.message}` };
      }
      return { ok: false, reason: 'UNKNOWN', message: '未知连接错误' };
    }
  }

  async chatStream(
    model: string,
    messages: LlmMessage[],
    cb: StreamCallbacks,
    opts: Record<string, any> = {}
  ): Promise<void> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/api/chat`;
    
    // 处理消息，支持图片
    const processedMessages = messages.map(m => {
      const message: any = { role: m.role, content: m.content };
      
      // 如果有图片，添加到消息中
      if (m.images && m.images.length > 0) {
        message.images = m.images;
      }
      
      return message;
    });
    
    const body = {
      model,
      stream: true,
      messages: processedMessages,
      options: opts.options ?? {},
    };

    try {
      await this.sseClient.startConnection(
        {
          url,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          debugTag: 'OllamaProvider'
        },
        {
          onStart: cb.onStart,
          onError: cb.onError,
          onData: (rawData: string) => {
            // Ollama SSE 通常以多行 \n 分隔，并带有 'data: ' 前缀，这里进行稳健解析
            const processJson = (json: any) => {
              if (!json) return;
              if (json.done === true) {
                console.debug('[OllamaProvider] Stream completed, triggering onComplete');
                cb.onComplete?.();
                this.sseClient.stopConnection();
                return;
              }
              const token = json?.message?.content;
              if (typeof token === 'string' && token.length > 0) {
                cb.onToken?.(token);
              }
            };

            try {
              // 可能是单个 JSON，也可能包含多行 'data: {json}'
              const text = String(rawData || '').trim();
              if (!text) return;

              // 情况一：原始就是 JSON
              if (text[0] === '{' || text[0] === '[') {
                try { processJson(JSON.parse(text)); return; } catch {}
              }

              // 情况二：拆分处理每一行的 data: 片段
              const lines = text.split(/\r?\n/);
              for (const line of lines) {
                const l = line.trim();
                if (!l) continue;
                if (l.startsWith('data:')) {
                  const payload = l.slice(5).trim();
                  if (!payload || payload === '[DONE]') { continue; }
                  try {
                    const json = JSON.parse(payload);
                    processJson(json);
                  } catch (e) {
                    // 跳过无法解析的片段（避免将原始JSON直接注入UI）
                    console.debug('[OllamaProvider] skip non-JSON SSE line:', payload?.slice(0,120));
                  }
                }
              }
            } catch (error) {
              console.error('[OllamaProvider] Failed to handle SSE data:', error);
            }
          }
        }
      );
    } catch (error: any) {
      console.error('[OllamaProvider] SSE connection failed:', error);
      cb.onError?.(error);
    }
  }

  async fetchModels(): Promise<Array<{name: string, label?: string, aliases?: string[]}> | null> {
    try {
      const url = `${this.baseUrl.replace(/\/$/, '')}/api/tags`;
      let resp: Response;
      
      // 添加超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8秒超时
      
      try {
        const { tauriFetch } = await import('@/lib/request');
        resp = (await tauriFetch(url, { 
          method: 'GET', 
          rawResponse: true, 
          browserHeaders: true,
          danger: { acceptInvalidCerts: true, acceptInvalidHostnames: true },
          timeout: 8000 // 同时设置tauriFetch的超时
        }));
      } catch (fetchError) {
        // 如果tauriFetch失败，尝试使用原生fetch
        try {
          resp = await fetch(url, { 
            method: 'GET',
            signal: controller.signal
          });
        } catch (nativeFetchError) {
          clearTimeout(timeoutId);
          if (nativeFetchError instanceof Error && nativeFetchError.name === 'AbortError') {
            console.warn('[Ollama] fetchModels timeout');
            return null;
          }
          throw nativeFetchError;
        }
      }
      
      clearTimeout(timeoutId);
      
      if (!resp.ok) return null;
      const data = await resp.json();
      if (Array.isArray(data.models)) {
        return data.models.map((m: any) => ({
          name: m.name,
          label: m.name, // Ollama模型名通常就是显示名
          aliases: [m.name]
        }));
      }
    } catch (e) {
      console.warn('[Ollama] fetchModels error', e);
    }
    return null;
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
