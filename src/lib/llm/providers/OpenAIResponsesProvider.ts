import { BaseProvider, CheckResult, LlmMessage, StreamCallbacks } from './BaseProvider';
import { SSEClient } from '@/lib/sse-client';

/**
 * OpenAI Responses Provider
 * - 适配 OpenAI Responses 风格的 /responses 接口
 * - 解析流式事件：response.output_text.delta / response.reasoning.delta / response.completed / [DONE]
 * - 参考文档：`https://platform.openai.com/docs/api-reference/responses/create`
 */
export class OpenAIResponsesProvider extends BaseProvider {
  private sseClient: SSEClient;

  constructor(baseUrl: string, apiKey?: string, displayName: string = 'OpenAI (Responses)') {
    super(displayName, baseUrl, apiKey);
    this.sseClient = new SSEClient('OpenAIResponsesProvider');
  }

  async checkConnection(): Promise<CheckResult> {
    const apiKey = await this.getApiKey();
    if (!apiKey) return { ok: false, reason: 'NO_KEY', message: 'NO_KEY' };
    return { ok: true };
  }

  /**
   * 将通用消息映射为 Responses API 的 input 结构
   */
  private mapMessagesToResponsesInput(messages: LlmMessage[]): any[] {
    return messages.map((m) => ({
      role: m.role,
      content: [
        {
          type: 'input_text',
          text: m.content,
        },
      ],
    }));
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
      (err as any).userMessage = '未配置 API 密钥，请为该 Provider 或模型配置密钥';
      cb.onError?.(err);
      return;
    }

    const url = `${this.baseUrl.replace(/\/$/, '')}/responses`;

    // 选项映射：Responses 使用 max_output_tokens / temperature / top_p 等
    const mapped: any = { ...opts };
    if (opts.maxOutputTokens !== undefined && mapped.max_output_tokens === undefined) mapped.max_output_tokens = opts.maxOutputTokens;
    if (opts.maxTokens !== undefined && mapped.max_output_tokens === undefined) mapped.max_output_tokens = opts.maxTokens;
    if (opts.topP !== undefined && mapped.top_p === undefined) mapped.top_p = opts.topP;
    if (opts.temperature !== undefined && mapped.temperature === undefined) mapped.temperature = opts.temperature;

    const body = {
      model,
      input: this.mapMessagesToResponsesInput(messages),
      stream: true,
      ...mapped,
    };

    // 解析 Responses 流事件所需的状态
    let lastEvent: string | null = null;
    let thinkingStarted = false;
    let thinkingEnded = false;

    const flushThinkingIfNeeded = () => {
      if (thinkingStarted && !thinkingEnded) {
        cb.onToken?.('</think>');
        thinkingEnded = true;
      }
    };

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
          debugTag: 'OpenAIResponsesProvider',
        },
        {
          onStart: cb.onStart,
          onError: cb.onError,
          onData: (rawLine: string) => {
            const line = rawLine.trim();
            if (!line) return;

            // 兼容 [DONE]
            if (line === '[DONE]') {
              flushThinkingIfNeeded();
              cb.onComplete?.();
              this.sseClient.stopConnection();
              return;
            }

            // 记录 event 行
            if (line.startsWith('event:')) {
              lastEvent = line.slice(6).trim();
              return;
            }

            // 剩余行按 JSON payload 尝试解析
            let data: any = null;
            try {
              data = JSON.parse(line);
            } catch (_) {
              // 忽略非 JSON 行
              return;
            }

            // 根据上一次的 event 类型路由
            switch (lastEvent) {
              case 'response.reasoning.delta': {
                const piece: string | undefined =
                  (typeof data?.delta === 'string' ? data.delta : undefined) ||
                  (typeof data?.text === 'string' ? data.text : undefined) ||
                  (typeof data?.content === 'string' ? data.content : undefined);
                if (piece && piece.length > 0) {
                  if (!thinkingStarted) {
                    cb.onToken?.('<think>');
                    thinkingStarted = true;
                    thinkingEnded = false;
                  }
                  cb.onToken?.(piece);
                }
                break;
              }
              case 'response.output_text.delta': {
                const piece: string | undefined =
                  (typeof data?.delta === 'string' ? data.delta : undefined) ||
                  (typeof data?.text === 'string' ? data.text : undefined) ||
                  (typeof data?.content === 'string' ? data.content : undefined);
                if (piece && piece.length > 0) {
                  // 第一次出现正文时，关闭思考段
                  flushThinkingIfNeeded();
                  cb.onToken?.(piece);
                }
                break;
              }
              case 'response.output_text.done': {
                // 输出完成事件（不一定是整体完成）
                flushThinkingIfNeeded();
                break;
              }
              case 'response.completed': {
                // 整体完成
                flushThinkingIfNeeded();
                cb.onComplete?.();
                this.sseClient.stopConnection();
                break;
              }
              default: {
                // 兜底：若没有 event 或未知事件，但负载含有 text/delta 字段，也尝试输出
                const piece: string | undefined =
                  (typeof data?.delta === 'string' ? data.delta : undefined) ||
                  (typeof data?.text === 'string' ? data.text : undefined) ||
                  (typeof data?.content === 'string' ? data.content : undefined);
                if (piece && piece.length > 0) {
                  flushThinkingIfNeeded();
                  cb.onToken?.(piece);
                }
                break;
              }
            }
          },
        }
      );
    } catch (error: any) {
      console.error('[OpenAIResponsesProvider] SSE connection failed:', error);
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

