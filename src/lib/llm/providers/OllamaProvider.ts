import { BaseProvider, CheckResult, LlmMessage, StreamCallbacks } from './BaseProvider';
import { SSEClient } from '@/lib/sse-client';
import { ThinkingStrategyFactory, type ThinkingModeStrategy } from './thinking';
import { StreamEventAdapter } from '@/lib/llm/adapters/StreamEventAdapter';

export class OllamaProvider extends BaseProvider {
  private sseClient: SSEClient;
  private aborted: boolean = false;
  private currentReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private thinkingStrategy: ThinkingModeStrategy | null = null;

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
          timeout: 8000, // 同时设置tauriFetch的超时
          fallbackToBrowserOnError: true,
          verboseDebug: true,
          debugTag: 'ModelList'
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
    
    // 构建Ollama选项，先处理自定义参数，再处理标准参数
    const ollamaOptions: Record<string, any> = {};
    
    // 1. 先添加所有自定义参数（避免被标准参数覆盖）
    if (opts.options && typeof opts.options === 'object') {
      Object.assign(ollamaOptions, opts.options);
    }
    
    // 2. 添加opts顶层的所有自定义参数（但过滤掉扩展字段，如 mcpServers/extensions）
    const o: any = opts || {};
    const { extensions, mcpServers: _mcpServers, ...restOpts } = o;
    for (const [key, value] of Object.entries(restOpts)) {
      // 跳过已处理的标准参数和内部字段
      if (!['options', 'temperature', 'topP', 'topK', 'minP', 'stop', 'maxTokens', 'maxOutputTokens', 
           'numPredict', 'numCtx', 'repeatLastN', 'repeatPenalty', 'seed', 'frequencyPenalty', 'presencePenalty'].includes(key)) {
        ollamaOptions[key] = value;
      }
    }

    // 3.1 若有 MCP 配置（extensions.mcpServers 或顶层 mcpServers），允许以 Ollama 自定义选项透传（留口子，不强制字段定义）
    const mcpList: any = (extensions && extensions.mcpServers) || _mcpServers;
    if (Array.isArray(mcpList) && mcpList.length > 0) {
      // 放入 options.mcpServers，供上游自定义中间件/代理读取（Ollama自身忽略无妨）
      ollamaOptions.mcpServers = mcpList;
    }
    
    // 3. 最后添加标准参数映射（确保正确的格式）
    if (typeof (opts as any).temperature === 'number') ollamaOptions.temperature = (opts as any).temperature;
    if (typeof (opts as any).topP === 'number') ollamaOptions.top_p = (opts as any).topP;
    if (typeof (opts as any).topK === 'number') ollamaOptions.top_k = (opts as any).topK;
    if (typeof (opts as any).minP === 'number') ollamaOptions.min_p = (opts as any).minP;
    if (typeof (opts as any).stop !== 'undefined') ollamaOptions.stop = (opts as any).stop;
    
    // Ollama 专有参数
    if (typeof (opts as any).numPredict === 'number') ollamaOptions.num_predict = (opts as any).numPredict;
    else if (typeof (opts as any).maxTokens === 'number') ollamaOptions.num_predict = (opts as any).maxTokens;
    else if (typeof (opts as any).maxOutputTokens === 'number') ollamaOptions.num_predict = (opts as any).maxOutputTokens;
    
    if (typeof (opts as any).numCtx === 'number') ollamaOptions.num_ctx = (opts as any).numCtx;
    if (typeof (opts as any).repeatLastN === 'number') ollamaOptions.repeat_last_n = (opts as any).repeatLastN;
    if (typeof (opts as any).repeatPenalty === 'number') ollamaOptions.repeat_penalty = (opts as any).repeatPenalty;
    if (typeof (opts as any).seed === 'number') ollamaOptions.seed = (opts as any).seed;

    // 处理think参数（根据Ollama文档，这应在body顶层）
    // 只有在opts中明确提供了thinking参数时才使用，否则不传递（让模型使用默认值）
    const hasThinkingParam = typeof (opts as any).thinking === 'boolean';
    const thinkParam = hasThinkingParam ? (opts as any).thinking : undefined;
    
    // 处理stream参数 - 只有在opts中明确提供了streaming参数时才使用，否则默认true（大多数情况下需要流式）
    const hasStreamingParam = typeof (opts as any).streaming === 'boolean';
    const streamParam = hasStreamingParam ? (opts as any).streaming : true;
    
    const body: Record<string, any> = {
      model,
      stream: streamParam,
      messages: processedMessages,
      options: ollamaOptions,
    };
    
    // 只有在明确提供了think参数时才添加到body（避免不支持的模型报错）
    if (hasThinkingParam && typeof thinkParam === 'boolean') {
      body.think = thinkParam;
    }

    try {
      // 首选：使用 Tauri HTTP（支持跨域/自签证书）进行 NDJSON 流解析
      let resp: any = null;
      try {
        const { tauriFetch } = await import('@/lib/request');
        resp = await tauriFetch(url, {
          method: 'POST',
          rawResponse: true,
          browserHeaders: true,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/x-ndjson, application/json, text/event-stream'
          },
          body,
          debugTag: 'OllamaStream'
        });
      } catch {
        resp = null;
      }
      
      // 次选：浏览器 fetch
      if (!resp) {
        try {
          resp = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/x-ndjson, application/json, text/event-stream'
            },
            body: JSON.stringify(body),
          });
        } catch {
          resp = null;
        }
      }

      // 若 fetch 不可用或失败，退回到 SSEClient（某些代理会把 NDJSON 包装成 SSE）
      if (!resp || !resp.ok) {
        await this.startSSEFallback(url, body, cb, model);
        return;
      }

      const contentType = (resp.headers.get?.('Content-Type') || '').toLowerCase();
      if (contentType.includes('text/event-stream')) {
        // 服务端实际返回 SSE，切到 SSE 解析
        await this.startSSEFallback(url, body, cb, model);
        return;
      }

      // NDJSON / JSON 流解析
      cb.onStart?.();
      const reader = resp.body?.getReader();
      if (!reader) {
        throw new Error('ReadableStream reader not available');
      }
      this.currentReader = reader;
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      const processJson = (json: any) => {
        if (!json) return;
        if (json.done === true) {
          cb.onComplete?.();
          return;
        }
        const token = json?.message?.content;
        if (typeof token === 'string' && token.length > 0) {
          cb.onToken?.(token);
        }
      };

      while (true) {
        if (this.aborted) {
          try { await reader.cancel(); } catch { /* noop */ }
          this.currentReader = null;
          return;
        }
        const { value, done } = await reader.read();
        if (done) {
          // flush 缓冲区
          const last = buffer.trim();
          if (last) {
            try { processJson(JSON.parse(last)); } catch { /* ignore */ }
          }
          
          cb.onComplete?.();
          break;
        }
        const decoded = decoder.decode(value, { stream: true });
        buffer += decoded;
        let idx: number;
        while ((idx = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line || line === '[DONE]') continue;
          // 兼容偶发的 'data: {...}' 片段
          const payload = line.startsWith('data:') ? line.slice(5).trim() : line;
          try {
            const json = JSON.parse(payload);
            processJson(json);
          } catch {
            // 非JSON行忽略
          }
        }
      }
    } catch (error: any) {
      console.error('[OllamaProvider] stream error:', error);
      cb.onError?.(error);
    }
  }

  private async startSSEFallback(url: string, body: unknown, cb: StreamCallbacks, _modelName?: string) {
    const DEBUG_OLLAMA = false;
    try {
      // 创建Ollama专用thinking策略（新架构）
      this.thinkingStrategy = ThinkingStrategyFactory.createOllamaStrategy();
      
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
            if (DEBUG_OLLAMA) {
              try { console.log('[DEBUG:Ollama:onData]', { rawDataLength: rawData?.length, fullData: rawData }); } catch { /* noop */ }
            }
            
            const processJson = (json: any) => {
              if (!json) return;
              
              const thinking = json?.message?.thinking || '';
              const content = json?.message?.content || '';
              
              if (DEBUG_OLLAMA) {
                try {
                  console.log('[DEBUG:Ollama:processJson]', { 
                    done: json.done, 
                    hasThinking: !!thinking,
                    thinkingLength: thinking?.length,
                    hasContent: !!content, 
                    contentLength: content?.length,
                    thinking: thinking.substring(0, 50),
                    content: content.substring(0, 50)
                  });
                } catch { /* noop */ }
              }
              
              // 使用策略处理token，得到结构化事件
              const result = this.thinkingStrategy!.processToken({
                thinking,
                content,
                done: json.done
              });
              
              // 🔍 诊断：检测"只thinking不输出content"的情况
              if (json.done && this.thinkingStrategy) {
                const strategy = this.thinkingStrategy as any;
                const accumulatedThinking = strategy.thinkingBuffer || '';
                const accumulatedContent = strategy.contentBuffer || '';
                
                // 检测工具调用关键词
                const toolCallKeywords = /call|use|invoke|filesystem|list_directory|read_file|mcp_tool/i;
                const mentionsToolCall = toolCallKeywords.test(accumulatedThinking);
                const hasActualOutput = accumulatedContent.includes('<use_mcp_tool>');
                
                if (mentionsToolCall && !hasActualOutput && DEBUG_OLLAMA) {
                  try {
                    console.warn('⚠️ [TOOL-CALL-MISSING] 模型在thinking中提到工具调用，但未在content中输出标签!', {
                      thinkingPreview: accumulatedThinking.substring(0, 200),
                      contentPreview: accumulatedContent.substring(0, 200),
                      thinkingChars: accumulatedThinking.length,
                      contentChars: accumulatedContent.length
                    });
                  } catch { /* noop */ }
                }
              }
              
              // 检查是否为内部调用（如生成标题），避免输出冗余日志
              const isInternal = (cb as any).__internal === true;
              
              // 优先使用onEvent（直接传递结构化事件）
              if (cb.onEvent && result.events && result.events.length > 0) {
                if (!isInternal && DEBUG_OLLAMA) {
                  try {
                    console.log('[DEBUG:Ollama] 输出事件:', result.events.map(e => ({
                      type: e.type,
                      contentLength: 'content' in e ? e.content?.length : undefined
                    })));
                  } catch { /* noop */ }
                }
                
                result.events.forEach(event => cb.onEvent!(event));
              }
              // 降级：使用onToken（转换为文本，兼容旧代码）
              else if (cb.onToken && result.events && result.events.length > 0) {
                const text = StreamEventAdapter.eventsToText(result.events);
                if (text.length > 0) {
                  if (!isInternal && DEBUG_OLLAMA) {
                    try { console.log('[DEBUG:Ollama] 调用onToken (兼容模式), token:', text.substring(0, 100)); } catch { /* noop */ }
                  }
                  cb.onToken(text);
                }
              }
              
              // 处理完成
              if (result.isComplete) {
                cb.onComplete?.();
                this.sseClient.stopConnection();
                // 重置策略
                this.thinkingStrategy?.reset();
                return;
              }
            };
            
            try {
              const text = String(rawData || '').trim();
              if (!text) return;
              if (text[0] === '{' || text[0] === '[') {
                try { processJson(JSON.parse(text)); return; } catch { /* ignore */ }
              }
              const lines = text.split(/\r?\n/);
              for (const line of lines) {
                const l = line.trim(); if (!l) continue;
                if (l.startsWith('data:')) {
                  const payload = l.slice(5).trim(); if (!payload || payload === '[DONE]') continue;
                  try { processJson(JSON.parse(payload)); } catch { /* ignore non-JSON line */ }
                }
              }
            } catch (e) { console.error('[OllamaProvider] Failed to handle fallback SSE data:', e); }
          }
        }
      );
    } catch (err) {
      console.error('[OllamaProvider] SSE fallback failed:', err);
      cb.onError?.(err as any);
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
          timeout: 8000, // 同时设置tauriFetch的超时
          fallbackToBrowserOnError: true,
          verboseDebug: true,
          debugTag: 'ModelList'
        }));
      } catch {
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
    this.aborted = true;
    try { this.currentReader?.cancel(); } catch { /* noop */ }
    this.currentReader = null;
    this.sseClient.stopConnection();
  }
}
