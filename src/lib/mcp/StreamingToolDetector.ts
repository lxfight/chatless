/* eslint-disable no-console */
export class StreamingToolDetector {
  private buffer = '';
  private lastFence = -1;

  push(chunk: string): { server: string; tool: string; args?: Record<string, unknown> } | null {
    if (!chunk) return null;
    this.buffer += chunk;
    try { console.log('[MCP-DET] push', chunk.length, this.buffer.length); } catch { /* noop */ }
    // 1) XML 包裹
    const xml = this.buffer.match(/<tool_call>([\s\S]*?)<\/tool_call>/i);
    if (xml && xml[1]) {
      try {
        const obj = JSON.parse(xml[1]);
        try { console.log('[MCP-DET] XML tool_call detected'); } catch (err) { void err; }
        return this.pick(obj);
      } catch (err) { void err; }
    }
    // 2) 代码围栏追踪
    const idxFence = this.buffer.lastIndexOf('```');
    if (idxFence !== -1) this.lastFence = idxFence;
    const tailStart = this.lastFence >= 0 ? this.lastFence : Math.max(0, this.buffer.length - 8000);
    const tail = this.buffer.slice(tailStart);
    if (tail.includes('"type"') && tail.replace(/\s+/g,'').includes('"tool_call"')) {
      const braces = this.extractBalancedJson(tail);
      if (braces) {
        try { console.log('[MCP-DET] fenced tool_call', this.lastFence, tail.length); return this.pick(JSON.parse(braces)); } catch (err) { void err; }
      }
    }
    // 3) 裸 JSON 宽松
    const loose = this.extractBalancedJson(this.buffer);
    if (loose) {
      try {
        const obj = JSON.parse(loose);
        if ((obj.type||'').toLowerCase()==='tool_call' || obj.tool || obj.tool_name) return this.pick(obj);
      } catch { /* ignore */ }
    }
    return null;
  }

  private pick(obj: any) {
    const server = obj.server || obj.mcp || obj.provider || '';
    const tool = obj.tool || obj.tool_name || obj.name || '';
    const args = obj.args || obj.parameters || obj.params || undefined;
    return (server && tool) ? { server, tool, args } : null;
  }

  private extractBalancedJson(s: string): string | null {
    let start = -1; let bal = 0;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '{') { if (start === -1) start = i; bal++; }
      else if (ch === '}') { bal--; if (bal === 0 && start !== -1) { return s.slice(start, i + 1); } }
    }
    return null;
  }
}

