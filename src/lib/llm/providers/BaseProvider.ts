import { tauriFetch } from '@/lib/request';

/**
 * 通用消息结构，后续可移到独立 types 文件
 */
export interface LlmMessage {
  role: 'user' | 'assistant' | 'system' | string;
  content: string;
  images?: string[];
}

export interface CheckResult {
  success: boolean;
  message?: string;
}

export interface StreamCallbacks {
  onStart?: () => void;
  onToken?: (token: string) => void;
  onComplete?: () => void;
  onError?: (err: Error) => void;
}

export interface SseRequestOptions {
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: any;
}

/**
 * 抽象基类：各 Provider 继承并实现具体行为
 */
export abstract class BaseProvider {
  /** 存放取消 SSE 监听的函数数组，由派生类负责填充 */
  protected sseUnlisten: Array<() => void> | null = null;
  constructor(
    public readonly name: string,
    protected baseUrl: string,
    protected apiKey?: string | null
  ) {}

  protected async getApiKey(model?: string): Promise<string | null> {
    const { KeyManager } = await import('../KeyManager');
    if (model) {
      const modelKey = await KeyManager.getModelKey(this.name, model);
      if (modelKey) return modelKey;
    }
    return await KeyManager.getProviderKey(this.name);
  }

  /**
   * 健康 / 鉴权检查
   */
  abstract checkConnection(): Promise<CheckResult>;

  /**
   * SSE / 流式聊天
   */
  abstract chatStream(
    model: string,
    messages: LlmMessage[],
    callbacks: StreamCallbacks,
    options?: Record<string, any>
  ): Promise<void>;

  /**
   * （可选）拉取模型列表
   */
  fetchModels?(): Promise<Array<{name: string, label?: string, aliases?: string[]}> | null>;

  /**
   * 取消流式连接
   */
  cancelStream?(): void;

  /**
   * 销毁资源
   */
  destroy?(): Promise<void>;

  // —— 公用工具 ——
  protected async fetchJson<T = any>(url: string, init?: RequestInit): Promise<T> {
    const resp = await tauriFetch(url, init as any);
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`HTTP ${resp.status} ${resp.statusText}\n${body}`);
    }
    return await resp.json();
  }
}
