import { streamChat, chat } from '@/lib/llm';

type LlmMessage = import('@/lib/llm/types').Message;
type StreamCallbacks = import('@/lib/llm/types').StreamCallbacks;

/**
 * ChatGateway: 聊天系统的唯一对外入口。
 * - 统一管理 provider/model 的生效选择
 * - 统一注入参数策略与 MCP servers（保持上层简洁）
 * - 对上层只暴露 chat/stream 两个方法
 */
export class ChatGateway {
  private readonly provider: string;
  private readonly model: string;
  private readonly baseOptions: Record<string, any>;

  constructor(params: { provider: string; model: string; options?: Record<string, any> }) {
    this.provider = params.provider;
    this.model = params.model;
    this.baseOptions = params.options || {};
  }

  /**
   * 非流式对话
   */
  async chat(messages: LlmMessage[], options?: Record<string, any>): Promise<{ content: string; raw: any }> {
    const merged = { ...this.baseOptions, ...(options || {}) };
    return chat(this.provider, this.model, messages, merged);
  }

  /**
   * 流式对话
   */
  async stream(messages: LlmMessage[], callbacks: StreamCallbacks, options?: Record<string, any>) {
    const merged = { ...this.baseOptions, ...(options || {}) };
    return streamChat(this.provider, this.model, messages, callbacks, merged);
  }
}


