import { BaseProvider, CheckResult, LlmMessage, StreamCallbacks } from './BaseProvider';
import { getStaticModels } from '../../provider/staticModels';
import { SSEClient } from '@/lib/sse-client';

export class GoogleAIProvider extends BaseProvider {
  private sseClient: SSEClient;
  private processedPayloads: Set<string> = new Set(); // 防止重复处理（按原始payload去重）

  constructor(baseUrl: string, apiKey?: string) {
    super('Google AI', baseUrl, apiKey);
    this.sseClient = new SSEClient('GoogleAIProvider');
  }

  async fetchModels(): Promise<Array<{name: string, label?: string, aliases?: string[]}> | null> {
    // Google AI 特殊：支持通过 query 参数 ?key=API_KEY 获取
    // curl https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY
    try {
      const apiKey = await this.getApiKey();
      const base = (this as any).baseUrl?.replace(/\/$/, '') || 'https://generativelanguage.googleapis.com/v1beta';
      const url = `${base}/models${apiKey ? `?key=${encodeURIComponent(apiKey)}` : ''}`;
      const resp: any = await (await import('@/lib/request')).tauriFetch(url, { method: 'GET', fallbackToBrowserOnError: true, verboseDebug: true, debugTag: 'ModelList' });
      const items = Array.isArray(resp?.models) ? resp.models : (Array.isArray(resp?.data) ? resp.data : []);
      if (Array.isArray(items) && items.length) {
        return items.map((it: any)=>{
          const id = it?.name || it?.id;
          const label = it?.display_name || it?.label || id;
          return { name: String(id), label: String(label), aliases: [String(id)] };
        });
      }
    } catch (e) {
      // 网络或鉴权失败时回退静态模型
      console.warn('[GoogleAIProvider] fetchModels via query key failed, fallback to static list', e);
    }
    const list = getStaticModels('Google AI');
    return list?.map((m)=>({ name: m.id, label: m.label, aliases: [m.id] })) ?? null;
  }

  async checkConnection(): Promise<CheckResult> {
    // 暂不在线检查，按是否配置密钥给出状态
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
      console.error('[GoogleAIProvider] No API key provided');
      const err = new Error('NO_KEY');
      (err as any).code = 'NO_KEY';
      (err as any).userMessage = '未配置 API 密钥（Google AI）。请在设置中配置密钥后重试';
      cb.onError?.(err);
      return;
    }
    
    // 规范化模型ID：去除可能的 "models/" 前缀，避免重复拼接
    const normalizedModel = model.startsWith('models/') ? model.slice('models/'.length) : model;
    // 构造正确的 URL - 使用官方文档中的流式API端点
    const url = `${this.baseUrl.replace(/\/$/, '')}/models/${normalizedModel}:streamGenerateContent?alt=sse`;
    
    // 将通用选项映射到 Gemini generationConfig
    const generationConfig: any = {
      ...(opts.generationConfig || {}),
    };
    // 仅当未在 generationConfig 中出现时才从扁平字段映射
    if (generationConfig.temperature === undefined && opts.temperature !== undefined) {
      generationConfig.temperature = opts.temperature;
    }
    if (generationConfig.topP === undefined && opts.topP !== undefined) {
      generationConfig.topP = opts.topP;
    }
    // OpenAI 风格的 maxTokens → Gemini 的 maxOutputTokens
    if (generationConfig.maxOutputTokens === undefined) {
      const flatMax = (opts as any).maxOutputTokens ?? (opts as any).maxTokens;
      if (flatMax !== undefined) generationConfig.maxOutputTokens = flatMax;
    }
    if (generationConfig.stopSequences === undefined && (opts as any).stop) {
      generationConfig.stopSequences = (opts as any).stop;
    }

    const body: any = {
      contents: messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      })),
      generationConfig,
    };
    // 透传 Gemini 允许的其他顶层字段（若存在）
    if ((opts as any).safetySettings) body.safetySettings = (opts as any).safetySettings;
    if ((opts as any).tools) body.tools = (opts as any).tools;

    console.log('[GoogleAIProvider] Starting chat stream with:', {
      model: normalizedModel,
      url,
      hasApiKey: !!apiKey,
      messageCount: messages.length
    });

    // 重置已处理集合
    this.processedPayloads.clear();

    try {
      await this.sseClient.startConnection(
        {
          url,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          },
          body,
          debugTag: 'GoogleAIProvider'
        },
        {
          onStart: () => {
            console.log('[GoogleAIProvider] SSE connection started');
            cb.onStart?.();
          },
          onError: (error) => {
            console.error('[GoogleAIProvider] SSE connection error:', error);
            cb.onError?.(error);
          },
          onData: (rawData: string) => {
            console.debug('[GoogleAIProvider] Received raw data:', rawData);
            
            // Google AI 的流式响应为 JSON，每个事件包含候选增量文本
            try {
              // 某些实现会把 JSON 前面加 "data:" 或在同一事件中拼接多个 JSON
              const payload = rawData.startsWith('data:') ? rawData.substring(5).trim() : rawData.trim();
              if (!payload) return;
              if (this.processedPayloads.has(payload)) return; // 完全重复的 payload 直接跳过
              this.processedPayloads.add(payload);
              const parsedData = JSON.parse(payload);
              
              // 检查是否有candidates数组
              if (parsedData.candidates && Array.isArray(parsedData.candidates) && parsedData.candidates.length > 0) {
                const candidate = parsedData.candidates[0];
                
                // 提取文本内容
                if (candidate.content?.parts && Array.isArray(candidate.content.parts)) {
                  for (const part of candidate.content.parts) {
                    const piece = typeof part.text === 'string' ? part.text : undefined;
                    if (piece && piece.length > 0) cb.onToken?.(piece);
                  }
                }
                
                // 检查是否完成
                if (candidate.finishReason === 'STOP') {
                  console.log('[GoogleAIProvider] Stream completed (finishReason: STOP)');
                  cb.onComplete?.();
                  // 确保及时关闭并移除监听，避免后续开启的新流将事件冒泡到旧回调
                  this.sseClient.stopConnection();
                }
              }
              
              // 检查promptFeedback（Google AI特有的错误处理）
              if (parsedData.promptFeedback?.blockReason) {
                const error = new Error(`Content blocked: ${parsedData.promptFeedback.blockReason}`);
                console.error('[GoogleAIProvider] Content blocked:', parsedData.promptFeedback);
                cb.onError?.(error);
              }
              
            } catch (error) {
              console.error('[GoogleAIProvider] Failed to parse chunk:', error);
              cb.onError?.(error instanceof Error ? error : new Error('Failed to parse response'));
            }
          }
        }
      );
    } catch (error: any) {
      console.error('[GoogleAIProvider] SSE connection failed:', error);
      cb.onError?.(error);
    }
  }

  /**
   * 清理资源
   */
  async destroy(): Promise<void> {
    this.processedPayloads.clear();
    await this.sseClient.destroy();
  }

  /**
   * 取消流式连接
   */
  cancelStream(): void {
    this.sseClient.stopConnection();
  }
}
