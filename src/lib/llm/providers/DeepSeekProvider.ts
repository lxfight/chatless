import { BaseProvider, CheckResult, LlmMessage, StreamCallbacks } from './BaseProvider';
import { getStaticModels } from '../../provider/staticModels';
import { SSEClient } from '@/lib/sse-client';

/**
 * DeepSeek（深度寻求）模型服务 Provider
 * 目前仅实现健康检查与占位 chatStream，后续可根据官方 API 填充。
 */
export class DeepSeekProvider extends BaseProvider {
  private sseClient: SSEClient;

  constructor(baseUrl: string, apiKey?: string) {
    super('DeepSeek', baseUrl, apiKey);
    this.sseClient = new SSEClient('DeepSeekProvider');
  }

  async checkConnection(): Promise<CheckResult> {
    // DeepSeek 为 OpenAI 兼容风格，采用错误密钥的标准请求判断可达
    const base = this.baseUrl.replace(/\/$/, '');
    const url = `${base}/chat/completions`;
    const fakeKey = 'invalid_test_key_for_healthcheck';
    const body = { model: 'deepseek-chat', messages: [{ role: 'user', content: 'ping' }], stream: false };
    try {
      const { tauriFetch } = await import('@/lib/request');
      const { judgeApiReachable } = await import('./healthcheck');
      const resp: any = await tauriFetch(url, {
        method: 'POST', rawResponse: true, browserHeaders: true,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fakeKey}` },
        body, timeout: 5000, fallbackToBrowserOnError: true, debugTag: 'DeepSeek-HealthCheck', verboseDebug: true, includeBodyInLogs: true
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
   * DeepSeek ChatCompletion 流式接口实现
   * 文档: https://api-docs.deepseek.com/api/create-chat-completion
   */
  async chatStream(
    model: string,
    messages: LlmMessage[],
    cb: StreamCallbacks,
    opts: Record<string, any> = {}
  ): Promise<void> {
    // 组合请求参数
    const url = `${this.baseUrl.replace(/\/$/, '')}/chat/completions`;

    // 过滤扩展字段，避免把 mcpServers/extensions 传入
    const { extensions, mcpServers, ...restOpts } = (opts as any) || {};
    const mapped: any = { ...restOpts };
    if (opts.maxTokens !== undefined && mapped.max_tokens === undefined) mapped.max_tokens = opts.maxTokens;
    if (opts.maxOutputTokens !== undefined && mapped.max_tokens === undefined) mapped.max_tokens = opts.maxOutputTokens;
    if (opts.topP !== undefined && mapped.top_p === undefined) mapped.top_p = opts.topP;
    if (opts.topK !== undefined && mapped.top_k === undefined) mapped.top_k = opts.topK;
    if (opts.minP !== undefined && mapped.min_p === undefined) mapped.min_p = opts.minP;
    if (opts.frequencyPenalty !== undefined && mapped.frequency_penalty === undefined) mapped.frequency_penalty = opts.frequencyPenalty;
    if (opts.presencePenalty !== undefined && mapped.presence_penalty === undefined) mapped.presence_penalty = opts.presencePenalty;
    if (opts.stop !== undefined && mapped.stop === undefined) mapped.stop = opts.stop;

    const body = {
      model,
      stream: true,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      ...mapped,
    };

    // 准备请求头
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const apiKey = await this.getApiKey(model);
    if (!apiKey) {
      const err = new Error('NO_KEY');
      (err as any).code = 'NO_KEY';
      (err as any).userMessage = '未配置 API 密钥（DeepSeek）。请在设置中配置密钥后重试';
      cb.onError?.(err);
      return;
    }
    headers['Authorization'] = `Bearer ${apiKey}`;

    try {
      await this.sseClient.startConnection(
        {
          url,
          method: 'POST',
          headers,
          body,
          debugTag: 'DeepSeekProvider'
        },
        {
          onStart: cb.onStart,
          onError: cb.onError,
          onData: (rawData: string) => {
            // DeepSeek 特定的数据解析逻辑
            if (!rawData) return;

            // DeepSeek 与 OpenAI 一样, 以 "[DONE]" 结束
            if (rawData.trim() === '[DONE]') {
              cb.onComplete?.();
              this.sseClient.stopConnection();
              return;
            }

            try {
              const json = JSON.parse(rawData);
              const token = json?.choices?.[0]?.delta?.content;
              if (token) cb.onToken?.(token);
            } catch (err) {
              // 无法解析 JSON, 直接回传原始数据
              console.warn('[DeepSeekProvider] Failed to parse SSE chunk, fallback to raw:', err);
              cb.onToken?.(rawData);
            }
          }
        }
      );
    } catch (error: any) {
      console.error('[DeepSeekProvider] SSE connection failed:', error);
      cb.onError?.(error);
    }
  }

  async fetchModels(): Promise<Array<{name: string, label?: string, aliases?: string[]}> | null> {
    const list = getStaticModels('DeepSeek');
    return list?.map((m)=>({ name: m.id, label: m.label, aliases: [m.id] })) ?? null;
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
