"use client";

import { Message, StreamCallbacks, ChatOptions } from './types';
import { tauriFetch } from '@/lib/request';
import { isTauriEnvironment } from '@/lib/utils/environment';
import { ProviderRegistry } from './index';
import { ParameterPolicyEngine } from './ParameterPolicy';

/**
 * 简化版 LLMInterpreter：
 *  1. 仅依赖 ProviderRegistry 中已注册的 Provider 策略。
 *  2. 不再支持旧 metadata.json / 模板化请求的兼容路径。
 */
export class LLMInterpreter {
  /**
   * 非流式 chat：内部调用 streamChat 聚合 token 后返回。
   */
  async chat(
    provider: string,
    model: string,
    messages: Message[],
    options: ChatOptions = {}
  ): Promise<{ content: string; raw: any }> {
    let content = '';
    await this.streamChat(
      provider,
      model,
      messages,
      {
        onToken: (t) => (content += t),
        onError: () => {},
      },
      options
    );
    return { content, raw: null };
  }

  // —— 流控制 ——
  private currentStreamController: AbortController | null = null;
  private sseUnlisten: Array<() => void> = [];

  /** 初始化占位（保持与旧 API 兼容） */
  async initialize(_forceUpdate = false): Promise<void> {
    // 新实现无需任何预处理，直接返回。
    return;
  }

  /** 取消当前正在进行的流式请求 */
  cancelStream(): void {
    // 1. fetch 流
    if (this.currentStreamController) {
      this.currentStreamController.abort();
      this.currentStreamController = null;
    }
    // 2. SSE 流
    if (this.sseUnlisten.length) {
      this.sseUnlisten.forEach((u) => {
        try { u(); } catch (_) {}
      });
      this.sseUnlisten = [];
      import('@tauri-apps/api/core')
        .then(({ invoke }) => invoke('stop_sse').catch(() => {}))
        .catch(() => {});
    }
  }

  /**
   * 统一流式聊天接口，仅通过 ProviderRegistry 调度。
   */
  async streamChat(
    provider: string,
    model: string,
    messages: Message[],
    callbacks: StreamCallbacks,
    options: ChatOptions = {}
  ): Promise<void> {
    const strategy = ProviderRegistry.get(provider);
    if (!strategy) {
      const err = new Error(`Provider '${provider}' 未注册`);
      callbacks.onError?.(err);
      throw err;
    }

    try {
      // 应用参数策略（按 Provider/模型正则自动注入/修正）
      const refined = ParameterPolicyEngine.apply(provider, model, options || {});
      await strategy.chatStream(model, messages as any, callbacks, refined);
    } catch (e: any) {
      callbacks.onError?.(e);
      throw e;
    }
  }
}

// 保持旧默认实例导出（部分代码可能直接使用）
export const llmInterpreter = new LLMInterpreter();
