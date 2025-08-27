export type ThinkEvent =
  | { type: 'text'; chunk: string }
  | { type: 'think_start' }
  | { type: 'think_chunk'; chunk: string }
  | { type: 'think_end' };

/**
 * 流式 <think> 解析器：
 * - 在 token 维度下支持跨 token 识别 <think> 与 </think>
 * - 输出事件用于驱动消息 FSM 的思考状态
 */
export class ThinkStreamTokenizer {
  private buffer = '';
  private inThink = false;

  push(token: string): ThinkEvent[] {
    this.buffer += token || '';
    const out: ThinkEvent[] = [];
    while (this.buffer.length > 0) {
      if (!this.inThink) {
        const idx = this.buffer.indexOf('<think>');
        if (idx === -1) {
          // 全部作为正文文本输出
          out.push({ type: 'text', chunk: this.buffer });
          this.buffer = '';
          break;
        }
        // 先输出前置正文文本
        if (idx > 0) {
          out.push({ type: 'text', chunk: this.buffer.slice(0, idx) });
        }
        // 进入思考段
        out.push({ type: 'think_start' });
        this.buffer = this.buffer.slice(idx + '<think>'.length);
        this.inThink = true;
        continue;
      }
      // in think
      const endIdx = this.buffer.indexOf('</think>');
      if (endIdx === -1) {
        // 仍未闭合，全部作为思考内容输出
        if (this.buffer.length > 0) out.push({ type: 'think_chunk', chunk: this.buffer });
        this.buffer = '';
        break;
      }
      // 输出思考内容片段
      if (endIdx > 0) {
        out.push({ type: 'think_chunk', chunk: this.buffer.slice(0, endIdx) });
      }
      // 结束思考段
      out.push({ type: 'think_end' });
      this.buffer = this.buffer.slice(endIdx + '</think>'.length);
      this.inThink = false;
      // 继续循环，处理标签后面的内容
    }
    return out;
  }
}

