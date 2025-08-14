"use client";

import { Message, StreamCallbacks, ChatOptions } from './types';
import type { BaseProvider } from './providers/BaseProvider';
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
  // 记录当前活跃的 Provider，用于用户点击“停止生成”时通知具体 Provider 关闭其内部 SSE 客户端
  private activeProvider: BaseProvider | null = null;

  /** 初始化占位（保持与旧 API 兼容） */
  async initialize(_forceUpdate = false): Promise<void> {
    // 新实现无需任何预处理，直接返回。
    return;
  }

  /** 取消当前正在进行的流式请求 */
  cancelStream(): void {
    // 0. 通知当前 Provider 主动关闭（确保其内部的 SSEClient 也会移除监听并调用后端 stop_sse）
    try {
      this.activeProvider?.cancelStream?.();
    } catch (_) {}

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
      // 计算参数策略应用时的“有效 Provider 名称”
      // 场景：New API 这类多策略聚合，根据模型选择下游协议，需要把策略引擎视作对应的真实 Provider
      let policyProviderName = provider;
      try {
        const lower = provider.toLowerCase();
        const isMulti = lower === 'new api' || lower === 'newapi';
        if (isMulti) {
          const { specializedStorage } = await import('@/lib/storage');
          const s = (await specializedStorage.models.getModelStrategy(provider, model))
            || (await specializedStorage.models.getProviderDefaultStrategy(provider))
            || 'openai-compatible';
          policyProviderName = ((): string => {
            switch (s) {
              case 'gemini': return 'Google AI';
              case 'anthropic': return 'Anthropic';
              case 'deepseek': return 'DeepSeek';
              case 'openai': return 'OpenAI';
              case 'openai-compatible':
              default: return 'OpenAI-Compatible';
            }
          })();
        }
      } catch (_) {}

      // 应用参数策略（按 Provider/模型正则自动注入/修正）
      const refined = ParameterPolicyEngine.apply(policyProviderName, model, options || {});
      // 记录活跃 Provider，供 cancelStream 使用
      this.activeProvider = strategy;
      await strategy.chatStream(model, messages as any, callbacks, refined);
    } catch (e: any) {
      callbacks.onError?.(e);
      throw e;
    }
  }
}

// 保持旧默认实例导出（部分代码可能直接使用）
export const llmInterpreter = new LLMInterpreter();
