import { BaseProvider, CheckResult, LlmMessage, StreamCallbacks } from './BaseProvider';
import { getStaticModels } from '../../provider/staticModels';
import { SSEClient } from '@/lib/sse-client';
import { ThinkingStrategyFactory, type ThinkingModeStrategy } from './thinking';
import { StreamEventAdapter } from '../adapters/StreamEventAdapter';

export class OpenAIProvider extends BaseProvider {
  private sseClient: SSEClient;
  private aborted: boolean = false;
  private thinkingStrategy: ThinkingModeStrategy;

  constructor(baseUrl: string, apiKey?: string, displayName: string = 'OpenAI') {
    super(displayName, baseUrl, apiKey);
    this.sseClient = new SSEClient('OpenAIProvider');
    // OpenAI使用标准的<think>标签策略（新架构）
    this.thinkingStrategy = ThinkingStrategyFactory.createStandardStrategy();
  }

  async fetchModels(): Promise<Array<{name: string, label?: string, aliases?: string[]}> | null> {
    // 暂不进行在线拉取，统一使用静态模型清单；按 provider 名称读取对应静态清单
    const key = this.name || 'OpenAI';
    const list = getStaticModels(key);
    return list?.map((m)=>({ name: m.id, label: m.label, aliases: [m.id] })) ?? null;
  }

  async checkConnection(): Promise<CheckResult> {
    // 采用“无成本连通性检查”策略：构造一次标准 API 请求，携带显式错误密钥，
    // 只要服务端返回可识别的鉴权错误（401/403/带有"auth"/"key"提示），即可判定 API 可达。
    const base = this.baseUrl.replace(/\/$/, '');
    const url = `${base}/chat/completions`;
    const fakeKey = 'invalid_test_key_for_healthcheck';
    const body = { model: 'gpt-3.5-turbo', messages: [{ role: 'user', content: 'ping' }], stream: false };
    try {
      const { tauriFetch } = await import('@/lib/request');
      const { judgeApiReachable } = await import('./healthcheck');
      const resp: any = await tauriFetch(url, {
        method: 'POST',
        rawResponse: true,
        browserHeaders: true,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fakeKey}` },
        body,
        timeout: 5000,
        fallbackToBrowserOnError: true,
        debugTag: 'OpenAI-HealthCheck',
        verboseDebug: true,
        includeBodyInLogs: true
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

  async chatStream(
    model: string, 
    messages: LlmMessage[], 
    cb: StreamCallbacks,
    opts: Record<string, any> = {}
  ): Promise<void> {
    const apiKey = await this.getApiKey(model);
    if (!apiKey) {
      const err = new Error('NO_KEY');
      (err as any).code = 'NO_KEY';
      (err as any).userMessage = '未配置 API 密钥，请在“设置 → 模型与Provider”中为当前 Provider 或模型配置密钥';
      cb.onError?.(err);
      return;
    }

    const url = `${this.baseUrl.replace(/\/$/, '')}/chat/completions`;
    // 将通用选项映射为 OpenAI 字段（snake_case）
    // 过滤掉扩展字段，避免把 mcpServers/extensions 传到不支持的后端
    const { extensions: _extensions, mcpServers: _mcpServers, ...restOpts } = (opts as any) || {};
    const mapped: any = { ...restOpts };
    const o: any = opts as any;
    if (o.maxTokens !== undefined && mapped.max_tokens === undefined) mapped.max_tokens = o.maxTokens;
    if (o.maxOutputTokens !== undefined && mapped.max_tokens === undefined) mapped.max_tokens = o.maxOutputTokens;
    if (o.topP !== undefined && mapped.top_p === undefined) mapped.top_p = o.topP;
    if (o.topK !== undefined && mapped.top_k === undefined) mapped.top_k = o.topK;
    if (o.minP !== undefined && mapped.min_p === undefined) mapped.min_p = o.minP;
    if (o.frequencyPenalty !== undefined && mapped.frequency_penalty === undefined) mapped.frequency_penalty = o.frequencyPenalty;
    if (o.presencePenalty !== undefined && mapped.presence_penalty === undefined) mapped.presence_penalty = o.presencePenalty;
    if (o.stop !== undefined && mapped.stop === undefined) mapped.stop = o.stop;

    const body = {
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: true,
      ...mapped,
    };

    try {
      this.aborted = false;
      this.thinkingStrategy.reset(); // 重置策略状态
      
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
            if (this.aborted) { this.sseClient.stopConnection(); return; }
            // 严格 OpenAI：只处理以 data: 开头的行
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
              if (!token) return;
              
              // 使用策略处理token，得到结构化事件
              const result = this.thinkingStrategy.processToken({
                content: token,
                done: false
              });
              
              // 优先使用onEvent（直接传递结构化事件）
              if (cb.onEvent && result.events && result.events.length > 0) {
                result.events.forEach(event => cb.onEvent!(event));
              }
              // 降级：使用onToken（转换为文本，兼容旧代码）
              else if (cb.onToken && result.events && result.events.length > 0) {
                const text = StreamEventAdapter.eventsToText(result.events);
                if (text.length > 0) {
                  cb.onToken(text);
                }
              }
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
    this.aborted = true;
    this.sseClient.stopConnection();
  }
}
