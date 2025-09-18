import type { Message as LlmMessage } from '@/lib/llm/types';

/**
 * HistoryBuilder：把 UI/Store 数据转为可发送给模型的历史消息
 */
export class HistoryBuilder {
  private history: LlmMessage[] = [];

  addSystem(content: string | undefined | null): this {
    if (content && content.trim()) this.history.push({ role: 'system', content });
    return this;
  }

  addUser(content: string, images?: string[] | null): this {
    const msg: any = { role: 'user', content };
    if (images && images.length) msg.images = images;
    this.history.push(msg);
    return this;
  }

  addAssistant(content: string): this {
    this.history.push({ role: 'assistant', content });
    return this;
  }

  addMany(list: Array<{ role: 'user'|'assistant'; content: string; images?: string[] }>): this {
    for (const it of list) {
      const { role, content, images } = it;
      const msg: any = { role, content };
      if (images && images.length) msg.images = images;
      this.history.push(msg);
    }
    return this;
  }

  take(): LlmMessage[] {
    return this.history.slice();
  }
}


