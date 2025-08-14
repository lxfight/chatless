import { BaseProvider, CheckResult, LlmMessage, StreamCallbacks } from './BaseProvider';
import { getStaticModels } from '../../provider/staticModels';
import { SSEClient } from '@/lib/sse-client';

/**
 * OpenAI 兼容 Provider（宽松解析版）
 * - 专供各类 OpenAI 兼容聚合/代理服务
 * - 兼容两种事件负载："data: {json}" 与 直接 "{json}"，并识别 "[DONE]"
 */
export class OpenAICompatibleProvider extends BaseProvider {
  private sseClient: SSEClient;

  constructor(baseUrl: string, apiKey?: string, displayName: string = 'OpenAI-Compatible') {
    super(displayName, baseUrl, apiKey);
    this.sseClient = new SSEClient('OpenAICompatibleProvider');
  }

  async fetchModels(): Promise<Array<{ name: string; label?: string; aliases?: string[] }> | null> {
    const key = this.name || 'OpenAI-Compatible';
    const list = getStaticModels(key);
    return list?.map((m) => ({ name: m.id, label: m.label, aliases: [m.id] })) ?? null;
  }

  async checkConnection(): Promise<CheckResult> {
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
      const err = new Error('NO_KEY');
      (err as any).code = 'NO_KEY';
      (err as any).userMessage = '未配置 API 密钥，请前往设置为该 Provider 或模型配置密钥';
      cb.onError?.(err);
      return;
    }

    const url = `${this.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const mapped: any = { ...opts };
    if (opts.maxTokens !== undefined && mapped.max_tokens === undefined) mapped.max_tokens = opts.maxTokens;
    if (opts.maxOutputTokens !== undefined && mapped.max_tokens === undefined) mapped.max_tokens = opts.maxOutputTokens;
    if (opts.topP !== undefined && mapped.top_p === undefined) mapped.top_p = opts.topP;
    if (opts.frequencyPenalty !== undefined && mapped.frequency_penalty === undefined)
      mapped.frequency_penalty = opts.frequencyPenalty;
    if (opts.presencePenalty !== undefined && mapped.presence_penalty === undefined)
      mapped.presence_penalty = opts.presencePenalty;
    if (opts.stop !== undefined && mapped.stop === undefined) mapped.stop = opts.stop;

    const body = {
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
      ...mapped,
    };

    // 思考流态管理
    let thinkingStarted = false;
    let thinkingEnded = false;

    try {
      await this.sseClient.startConnection(
        {
          url,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body,
          debugTag: 'OpenAICompatibleProvider',
        },
        {
          onStart: cb.onStart,
          onError: cb.onError,
          onData: (rawData: string) => {
            // 宽松解析：支持 data: 前缀或直接 JSON
            const payload = rawData.startsWith('data:') ? rawData.substring(5).trim() : rawData.trim();
            if (!payload) return;

            if (payload === '[DONE]') {
              // 若仍处于思考段，补齐关闭标签
              if (thinkingStarted && !thinkingEnded) {
                cb.onToken?.('</think>');
                thinkingEnded = true;
              }
              cb.onComplete?.();
              this.sseClient.stopConnection();
              return;
            }

            try {
              const json = JSON.parse(payload);
              const delta = json?.choices?.[0]?.delta ?? {};

              // 1) 思考内容（reasoning_content）优先，以 <think> 包装
              const reasoningPiece = typeof delta.reasoning_content === 'string' ? delta.reasoning_content : undefined;
              if (reasoningPiece && reasoningPiece.length > 0) {
                if (!thinkingStarted) {
                  cb.onToken?.('<think>');
                  thinkingStarted = true;
                  thinkingEnded = false;
                }
                cb.onToken?.(reasoningPiece);
              }

              // 2) 正常内容
              const contentPiece: string | undefined =
                (typeof delta.content === 'string' ? delta.content : undefined) ||
                (typeof json?.choices?.[0]?.message?.content === 'string'
                  ? json.choices[0].message.content
                  : undefined);

              if (contentPiece && contentPiece.length > 0) {
                // 在第一次出现正常内容时，关闭思考段
                if (thinkingStarted && !thinkingEnded) {
                  cb.onToken?.('</think>');
                  thinkingEnded = true;
                }
                cb.onToken?.(contentPiece);
              }
            } catch (err) {
              // 非 JSON 负载，忽略
              console.warn('[OpenAICompatibleProvider] JSON parse error', err);
            }
          },
        }
      );
    } catch (error: any) {
      console.error('[OpenAICompatibleProvider] SSE connection failed:', error);
      cb.onError?.(error);
    }
  }

  async destroy(): Promise<void> {
    await this.sseClient.destroy();
  }

  cancelStream(): void {
    this.sseClient.stopConnection();
  }
}


