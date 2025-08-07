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

/**
 * 通用的SSE客户端工具类
 * 只负责SSE通信的基础功能，不涉及任何业务逻辑
 */
export class SSEClient {
  private unlisteners: Array<() => void> = [];
  private isConnected = false;
  private debugTag: string;

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
      headers = {},
      body,
      debugTag = this.debugTag
    } = config;

    try {
      // 调用开始回调
      callbacks.onStart?.();

      console.debug(`[${debugTag}] start_sse URL:`, url);
      console.debug(`[${debugTag}] start_sse Body:`, this.formatBodyForLog(body));

      // 启动SSE连接
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

        // 添加数据格式检查
        console.debug(`[${debugTag}] SSE Event received:`, {
          dataLength: data.length,
          startsWithData: data.startsWith('data:'),
          containsNewlines: data.includes('\n'),
          isJSON: (() => {
            try {
              JSON.parse(data);
              return true;
            } catch {
              return false;
            }
          })(),
          rawData: data.substring(0, 200) + (data.length > 200 ? '...' : '')
        });

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
        callbacks.onError?.(new Error(e.payload));
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
   * 停止SSE连接
   */
  async stopConnection(): Promise<void> {
    if (this.unlisteners.length > 0) {
      // 清理监听器
      this.unlisteners.forEach(unlisten => unlisten());
      this.unlisteners = [];
      
      // 通知后端停止SSE
      try {
        await invoke('stop_sse');
      } catch (error) {
        console.warn(`[${this.debugTag}] Failed to stop SSE:`, error);
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