import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

/**
 * SSE事件回调接口 - 只处理原始数据，不涉及业务逻辑
 */
export interface SSECallbacks {
  /** 接收到原始SSE数据时的回调 */
  onData?: (rawData: string) => void;
  /** 发生错误时的回调 */
  onError?: (error: Error) => void;
  /** 连接开始时的回调 */
  onStart?: () => void;
  /** 连接关闭时的回调 */
  onClose?: () => void;
}

/**
 * SSE连接配置
 */
export interface SSEConnectionConfig {
  /** 请求URL */
  url: string;
  /** 请求方法，默认为POST */
  method?: 'GET' | 'POST' | 'PUT';
  /** 请求头 */
  headers?: Record<string, string>;
  /** 请求体 */
  body?: any;
  /** 调试标签，用于日志输出 */
  debugTag?: string;
}

// 导入公共的浏览器兜底工具
import { shouldUseBrowserRequest } from '@/lib/provider/browser-fallback-utils';

/**
 * 通用的SSE客户端工具类
 * 只负责SSE通信的基础功能，不涉及任何业务逻辑
 */
export class SSEClient {
  private unlisteners: Array<() => void> = [];
  private isConnected = false;
  private debugTag: string;
  private eventSource: EventSource | null = null;

  constructor(debugTag: string = 'SSEClient') {
    this.debugTag = debugTag;
  }

  /**
   * 启动SSE连接
   */
  async startConnection(
    config: SSEConnectionConfig,
    callbacks: SSECallbacks
  ): Promise<void> {
    // 如果已有连接，先停止
    await this.stopConnection();

    const {
      url,
      method = 'POST',
      headers: rawHeaders = {},
      body,
      debugTag = this.debugTag
    } = config;

    // 确保 SSE 流不被 gzip 压缩，Tauri 侧无法自动解压
    const headers: Record<string, string> = {
      'Accept-Encoding': 'identity',
      ...rawHeaders,
    };

    try {
      // 调用开始回调
      callbacks.onStart?.();

      console.debug(`[${debugTag}] start_sse URL:`, url);
      console.debug(`[${debugTag}] start_sse Body:`, this.formatBodyForLog(body));

      // 检查是否应该使用浏览器SSE方式
      if (await shouldUseBrowserRequest(url, debugTag)) {
        await this.startBrowserSSE(config, callbacks);
        return;
      }

      // 启动Tauri SSE连接
      await invoke('start_sse', {
        url,
        method,
        headers,
        body
      });

      // 监听SSE事件 - 只传递原始数据，不进行任何解析
      const unlistenEvent = await listen<string>('sse-event', (e) => {
        const data = e.payload;
        if (!data) return;

        // 直接传递原始数据给业务层处理
        callbacks.onData?.(data);
      });

      // 监听SSE状态
      const unlistenStatus = await listen<string>('sse-status', (e) => {
        console.debug(`[${debugTag}] SSE Status:`, e.payload);
      });

      // 监听SSE错误
      const unlistenError = await listen<string>('sse-error', (e) => {
        console.error(`[${debugTag}] SSE Error:`, e.payload);
        
        // 为HTTP 400错误提供更友好的提示
        let errorMessage = e.payload;
        if (e.payload && e.payload.includes('HTTP 400')) {
          errorMessage = `请求被拒绝 (HTTP 400)。这通常表示：

1. 提供商策略设置不正确
2. API密钥无效或已过期  
3. 请求参数格式错误
4. 账户余额不足或配额超限

建议检查：
• 提供商配置是否正确
• API密钥是否有效
• 账户状态是否正常
• 请求内容是否符合提供商要求

原始错误: ${e.payload}`;
        }
        
        callbacks.onError?.(new Error(errorMessage));
        this.stopConnection();
      });

      // 保存监听器
      this.unlisteners = [unlistenEvent, unlistenStatus, unlistenError];
      this.isConnected = true;

    } catch (error: any) {
      console.error(`[${debugTag}] start_sse failed:`, error);
      callbacks.onError?.(error);
      throw error;
    }
  }

  /**
   * 启动浏览器SSE连接
   */
  private async startBrowserSSE(
    config: SSEConnectionConfig,
    callbacks: SSECallbacks
  ): Promise<void> {
    const { url, method = 'POST', headers = {}, body, debugTag = this.debugTag } = config;

    try {
      // 对于POST请求，我们需要先发送请求获取流
      if (method === 'POST') {
        // 准备请求头
        const requestHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          ...headers
        };

        console.debug(`[${debugTag}] 启动浏览器SSE连接 (POST):`, url);

        const response = await fetch(url, {
          method: 'POST',
          headers: requestHeaders,
          body: typeof body === 'string' ? body : JSON.stringify(body || {}),
          // 添加信号支持，便于取消
          signal: this.createAbortController()?.signal
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error('Response body is null');
        }

        // 检查响应类型
        const contentType = response.headers.get('content-type');
        if (contentType && !contentType.includes('text/event-stream') && !contentType.includes('text/plain')) {
          console.warn(`[${debugTag}] Unexpected content-type: ${contentType}`);
        }

        // 处理流式响应
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        this.isConnected = true;

        const processBuffer = () => {
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // 保留最后一个不完整的行

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine) {
              // 处理SSE格式的数据 - 与Tauri端保持一致
              if (trimmedLine.startsWith('data: ')) {
                const data = trimmedLine.substring(6);
                // 将[DONE]信号传递给业务层处理，与Tauri端保持一致
                callbacks.onData?.(data);
              } else {
                // 对于非data:开头的行，直接作为数据传递（与Tauri端一致）
                // 这包括直接的JSON数据和其他格式数据
                callbacks.onData?.(trimmedLine);
              }
            }
          }
        };

        const readStream = async () => {
          try {
            while (this.isConnected) {
              const { done, value } = await reader.read();
              
              if (done) {
                console.debug(`[${debugTag}] Browser SSE stream completed`);
                callbacks.onClose?.();
                break;
              }

              buffer += decoder.decode(value, { stream: true });
              processBuffer();
            }
          } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
              console.debug(`[${debugTag}] Browser SSE stream aborted`);
              callbacks.onClose?.();
            } else {
              console.error(`[${debugTag}] Browser SSE read error:`, error);
              callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
            }
          } finally {
            try {
              reader.releaseLock();
            } catch (e) {
              console.warn(`[${debugTag}] Failed to release reader:`, e);
            }
          }
        };

        // 开始读取流
        readStream();

        // 保存清理函数
        this.unlisteners = [() => {
          this.isConnected = false;
          reader.cancel().catch(e => 
            console.warn(`[${debugTag}] Failed to cancel reader:`, e)
          );
        }];

      } else {
        // 对于GET请求，使用EventSource
        console.debug(`[${debugTag}] 启动浏览器EventSource连接 (GET):`, url);
        
        const eventSource = new EventSource(url);
        this.eventSource = eventSource;

        let connectionOpened = false;

        eventSource.onopen = () => {
          console.debug(`[${debugTag}] Browser EventSource opened`);
          connectionOpened = true;
          this.isConnected = true;
        };

        eventSource.onmessage = (event) => {
          callbacks.onData?.(event.data);
        };

        eventSource.onerror = (event) => {
          console.error(`[${debugTag}] Browser EventSource error:`, event);
          
          if (!connectionOpened) {
            callbacks.onError?.(new Error('Failed to establish EventSource connection'));
          } else {
            // 连接已建立但出错，可能是网络问题
            console.warn(`[${debugTag}] EventSource connection interrupted`);
          }
          
          this.stopConnection();
        };

        // 保存清理函数
        this.unlisteners = [() => {
          eventSource.close();
          this.eventSource = null;
        }];

        // 设置超时检查
        const timeoutId = setTimeout(() => {
          if (!connectionOpened) {
            console.warn(`[${debugTag}] EventSource connection timeout`);
            callbacks.onError?.(new Error('EventSource connection timeout'));
            this.stopConnection();
          }
        }, 10000); // 10秒超时

        this.unlisteners.push(() => clearTimeout(timeoutId));
      }

    } catch (error: any) {
      console.error(`[${debugTag}] Browser SSE failed:`, error);
      
      // 为HTTP 400错误提供更友好的提示
      let errorToPass = error;
      if (error instanceof Error && error.message.includes('HTTP 400')) {
        const friendlyError = new Error(`请求被拒绝 (HTTP 400)。这通常表示：

1. 提供商策略设置不正确
2. API密钥无效或已过期  
3. 请求参数格式错误
4. 账户余额不足或配额超限

建议检查：
• 提供商配置是否正确
• API密钥是否有效
• 账户状态是否正常
• 请求内容是否符合提供商要求

原始错误: ${error.message}`);
        errorToPass = friendlyError;
      }
      
      callbacks.onError?.(errorToPass);
      throw errorToPass;
    }
  }

  /**
   * 创建AbortController用于取消请求
   */
  private createAbortController(): AbortController | null {
    try {
      return new AbortController();
    } catch {
      // 某些环境可能不支持AbortController
      return null;
    }
  }

  /**
   * 停止SSE连接
   */
  async stopConnection(): Promise<void> {
    if (this.unlisteners.length > 0) {
      // 清理监听器
      this.unlisteners.forEach(unlisten => unlisten());
      this.unlisteners = [];
      
      // 如果是浏览器EventSource，直接关闭
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      } else {
        // 通知后端停止Tauri SSE
        try {
          await invoke('stop_sse');
        } catch (error) {
          console.warn(`[${this.debugTag}] Failed to stop SSE:`, error);
        }
      }
    }
    
    this.isConnected = false;
  }

  /**
   * 检查是否已连接
   */
  get connected(): boolean {
    return this.isConnected;
  }

  /**
   * 销毁客户端，清理所有资源
   */
  async destroy(): Promise<void> {
    await this.stopConnection();
  }

  /**
   * 格式化请求体，使其更易读
   */
  private formatBodyForLog(body: any): string {
    if (body === null || body === undefined) {
      return 'null';
    }
    if (typeof body === 'string') {
      return body;
    }
    if (typeof body === 'object') {
      // 处理包含图片的请求体，避免打印大量base64数据
      const sanitizedBody = this.sanitizeBodyForLog(body);
      return JSON.stringify(sanitizedBody, null, 2);
    }
    return String(body);
  }

  /**
   * 清理请求体中的敏感数据，避免日志过大
   */
  private sanitizeBodyForLog(body: any): any {
    if (Array.isArray(body)) {
      return body.map(item => this.sanitizeBodyForLog(item));
    }
    
    if (body && typeof body === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(body)) {
        if (key === 'messages' && Array.isArray(value)) {
          // 处理messages数组，清理其中的图片数据
          sanitized[key] = value.map((msg: any) => {
            if (msg && typeof msg === 'object') {
              const sanitizedMsg = { ...msg };
              if (msg.images && Array.isArray(msg.images)) {
                // 替换图片数组为占位符
                sanitizedMsg.images = msg.images.map((img: string, index: number) => {
                  if (typeof img === 'string') {
                    if (img.startsWith('data:image/')) {
                      // 处理Data URL格式
                      const format = img.match(/data:image\/([^;]+)/)?.[1] || 'unknown';
                      return `[base64图片${index + 1}, ${format}格式, ${img.length}字符]`;
                    } else if (img.length > 50 && /^[A-Za-z0-9+/=]+$/.test(img)) {
                      // 处理纯base64数据（长度大于50且只包含base64字符）
                      return `[base64图片${index + 1}, 纯base64格式, ${img.length}字符]`;
                    }
                  }
                  return img;
                });
              }
              return sanitizedMsg;
            }
            return msg;
          });
        } else if (key === 'images' && Array.isArray(value)) {
          // 直接处理images字段
          sanitized[key] = value.map((img: string, index: number) => {
            if (typeof img === 'string') {
              if (img.startsWith('data:image/')) {
                // 处理Data URL格式
                const format = img.match(/data:image\/([^;]+)/)?.[1] || 'unknown';
                return `[base64图片${index + 1}, ${format}格式, ${img.length}字符]`;
              } else if (img.length > 50 && /^[A-Za-z0-9+/=]+$/.test(img)) {
                // 处理纯base64数据（长度大于50且只包含base64字符）
                return `[base64图片${index + 1}, 纯base64格式, ${img.length}字符]`;
              }
            }
            return img;
          });
        } else if (typeof value === 'object' && value !== null) {
          // 递归处理嵌套对象
          sanitized[key] = this.sanitizeBodyForLog(value);
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    }
    
    return body;
  }
}

/**
 * 创建SSE客户端的便捷函数
 */
export function createSSEClient(debugTag: string): SSEClient {
  return new SSEClient(debugTag);
} 