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

  addUser(content: string, images?: string[] | null, contextData?: string | null): this {
    let finalContent = content;
    
    // 如果有文档上下文数据，将其附加到消息内容中
    if (contextData && contextData.trim()) {
      finalContent = `${content}\n\n[Document Context]\n${contextData}`;
    }
    
    const msg: any = { role: 'user', content: finalContent };
    if (images && images.length) msg.images = images;
    this.history.push(msg);
    return this;
  }

  // ✅ 【正确使用场景】：构建 LLM 历史对话
  // 
  // 说明：
  // - LLM API 要求消息格式必须包含 content 字段
  // - 这里使用 content 是正确的，因为：
  //   1. LLM 需要完整的历史对话内容
  //   2. segments 是UI层概念，LLM API不认识
  //   3. content 应该已经被清理过（移除了工具调用指令）
  addAssistant(content: string): this {
    this.history.push({ role: 'assistant', content });
    return this;
  }

  addMany(list: Array<{ role: 'user'|'assistant'; content: string; images?: string[]; contextData?: string }>): this {
    for (const it of list) {
      const { role, content, images, contextData } = it;
      
      let finalContent = content;
      // 对于用户消息，如果有文档上下文数据，将其附加到消息内容中
      if (role === 'user' && contextData && contextData.trim()) {
        finalContent = `${content}\n\n[Document Context]\n${contextData}`;
      }
      
      const msg: any = { role, content: finalContent };
      if (images && images.length) msg.images = images;
      this.history.push(msg);
    }
    return this;
  }

  take(): LlmMessage[] {
    return this.history.slice();
  }
}


