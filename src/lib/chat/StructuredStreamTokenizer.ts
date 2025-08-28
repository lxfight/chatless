export type StructuredEvent =
  | { type: 'text'; chunk: string }
  | { type: 'think_start' }
  | { type: 'think_chunk'; chunk: string }
  | { type: 'think_end' }
  | { type: 'tool_call'; server: string; tool: string; args?: Record<string, unknown> };

type State = 'BODY' | 'THINK' | 'FENCE';

/**
 * 统一流式分词器：
 * - 识别 <think> 与 </think>
 * - 识别代码围栏 ```...```（语言标识可选）
 * - 优先从围栏或裸 JSON 中提取 {"type":"tool_call"} 指令，生成 tool_call 事件
 * - 在 FENCE 状态内不会将 <think> 识别为思考，仅按文本处理（或作为 tool_call）
 */
export class StructuredStreamTokenizer {
  private buffer = '';
  private state: State = 'BODY';
  private toolEmitted = false;

  push(token: string): StructuredEvent[] {
    this.buffer += token || '';
    const out: StructuredEvent[] = [];
    // 尝试在任何状态下“尽早”探测到 tool_call（宽容不完整 JSON），只触发一次
    const tryEarlyEmitTool = () => {
      if (this.toolEmitted) return;
      // 在思考阶段不触发 tool_call（仅在非 THINK 阶段早触发）
      if (this.state === 'THINK') return;
      // XML 起始但未闭合的场景，尝试解析已获得的JSON片段
      const startIdx = this.buffer.indexOf('<tool_call>');
      const endIdx = this.buffer.indexOf('</tool_call>');
      if (startIdx !== -1 && (endIdx === -1 || endIdx < startIdx)) {
        const partial = this.buffer.slice(startIdx + '<tool_call>'.length);
        const ev = tryEmitToolFromJson(partial) || tryEmitToolFromXml(partial);
        if (ev) { out.push(ev); this.toolEmitted = true; }
      }
      // <use_mcp_tool> 起始但未闭合
      const useStart = this.buffer.indexOf('<use_mcp_tool>');
      const useEnd = this.buffer.indexOf('</use_mcp_tool>');
      if (!this.toolEmitted && useStart !== -1 && (useEnd === -1 || useEnd < useStart)) {
        const partial = this.buffer.slice(useStart + '<use_mcp_tool>'.length);
        const ev = tryEmitToolFromUseTag(partial);
        if (ev) { out.push(ev); this.toolEmitted = true; }
      }
      // 裸 JSON：一旦出现 "type":"tool_call" 就尝试解析局部对象
      const typeIdx = this.buffer.search(/"type"\s*:\s*"tool_call"/i);
      if (!this.toolEmitted && typeIdx !== -1) {
        // 回溯到最近的 '{'
        let start = typeIdx; while (start >= 0 && this.buffer[start] !== '{') start--;
        if (start >= 0) {
          const partial = this.buffer.slice(start);
          const ev = tryEmitToolFromJson(partial);
          if (ev) { out.push(ev); this.toolEmitted = true; }
        }
      }
    };
    tryEarlyEmitTool();

    const THINK_START = '<think>';
    const THINK_END = '</think>';
    const FENCE = '```';
    const SAFE_TAIL = 16; // 防跨 token 丢失标记，保留末尾若干字符在缓冲区

    const emitText = (txt: string) => { if (txt) { out.push({ type: 'text', chunk: txt }); } };

    const tryEmitToolFromJson = (jsonText: string): null | StructuredEvent => {
      const preprocess = (raw: string): string => {
        let s = raw.trim();
        // 去掉可能的前缀，例如 'xml' 或 'XML'
        const idx = s.indexOf('{');
        if (idx > 0) s = s.slice(idx);
        // 尝试修复未转义的反斜杠：在字符串字面量中把 \ 转义成 \\
        let out = '';
        let inStr = false; let escape = false;
        for (let i = 0; i < s.length; i++) {
          const ch = s[i];
          if (escape) { out += ch; escape = false; continue; }
          if (ch === '\\') {
            if (inStr) { out += '\\\\'; } else { out += ch; }
            continue;
          }
          if (ch === '"') { inStr = !inStr; out += ch; continue; }
          if (ch === '\\') { escape = true; out += ch; continue; }
          out += ch;
        }
        return out;
      };
      try {
        const obj: any = JSON.parse(preprocess(jsonText));
        const t = String(obj && (obj.type || obj['r#type']) || '').toLowerCase();
        if (t === 'tool_call' || obj.tool || obj.tool_name) {
          const server = obj.server || obj.mcp || obj.provider || '';
          const tool = obj.tool || obj.tool_name || obj.name || '';
          const args = obj.parameters || obj.args || obj.params || undefined;
          if (server && tool) return { type: 'tool_call', server, tool, args };
        }
      } catch { /* ignore */ }
      // 次级兜底：用正则提取字段（容忍非标准 JSON）
      try {
        const mServer = jsonText.match(/"server"\s*:\s*"([^"]+)"/i);
        const mTool = jsonText.match(/"tool"\s*:\s*"([^"]+)"/i);
        const mParams = jsonText.match(/"parameters"\s*:\s*\{([\s\S]*?)\}/i);
        const server = mServer?.[1] || '';
        const tool = mTool?.[1] || '';
        let args: Record<string, unknown> | undefined = undefined;
        if (mParams) {
          // 简单解析 k:"v" 键值对
          args = {};
          const kvRe = /"([^"]+)"\s*:\s*"([\s\S]*?)"/g; let mm: RegExpExecArray | null;
          while ((mm = kvRe.exec(mParams[1])) !== null) { (args as any)[mm[1]] = mm[2]; }
        }
        if (server && tool) return { type: 'tool_call', server, tool, args };
      } catch { /* ignore */ }
      return null;
    };

    const tryEmitToolFromXml = (xmlText: string): null | StructuredEvent => {
      const txt = (xmlText || '').trim();
      if (!/<type>\s*tool_call\s*<\/type>/i.test(txt)) return null;
      const mServer = txt.match(/<server>\s*([^<]+)\s*<\/server>/i);
      const mTool = txt.match(/<tool>\s*([^<]+)\s*<\/tool>/i);
      const mParams = txt.match(/<parameters>([\s\S]*?)<\/parameters>/i);
      const server = (mServer?.[1] || '').trim();
      const tool = (mTool?.[1] || '').trim();
      let args: Record<string, unknown> | undefined = undefined;
      if (mParams && mParams[1]) {
        args = {};
        const inner = mParams[1];
        const pairRe = /<([a-zA-Z0-9_]+)>[\s\S]*?<\/\1>/g; let mm: RegExpExecArray | null;
        while ((mm = pairRe.exec(inner)) !== null) {
          const tag = mm[1];
          const valMatch = new RegExp(`<${tag}>([\\s\\S]*?)<\/${tag}>`, 'i').exec(mm[0]);
          const value = (valMatch?.[1] || '').trim();
          (args as any)[tag] = value;
        }
      }
      if (server && tool) return { type: 'tool_call', server, tool, args };
      return null;
    };

    // 解析 <use_mcp_tool> 协议
    const tryEmitToolFromUseTag = (block: string): null | StructuredEvent => {
      const s = (block || '').trim();
      const mServer = s.match(/<server_name>\s*([\s\S]*?)\s*<\/server_name>/i);
      const mTool = s.match(/<tool_name>\s*([\s\S]*?)\s*<\/tool_name>/i);
      const mArgs = s.match(/<arguments>\s*([\s\S]*?)\s*<\/arguments>/i);
      const server = (mServer?.[1] || '').trim();
      const tool = (mTool?.[1] || '').trim();
      let args: Record<string, unknown> | undefined = undefined;
      if (mArgs && mArgs[1]) {
        // 从 <arguments> 中提取 JSON 对象
        const inside = mArgs[1].trim();
        // 去掉可能的代码围栏或语言标识
        const fenced = inside.replace(/^```[a-zA-Z]*\s*/,'').replace(/```\s*$/,'');
        // 寻找第一个完整的 { ... }
        const start = fenced.indexOf('{');
        const end = fenced.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
          const jsonStr = fenced.slice(start, end + 1);
          try { args = JSON.parse(jsonStr); } catch { /* ignore */ }
        }
      }
      if (server && tool) return { type: 'tool_call', server, tool, args };
      return null;
    };

    // 从任意文本中提取首个完整的 { ... } JSON（包含 "type":"tool_call"），返回 [beforeText, jsonText, afterIndex]
    const extractFirstToolCallJson = (text: string): null | { before: string; json: string; endIndex: number } => {
      const typeIdx = text.search(/"type"\s*:\s*"tool_call"/i);
      if (typeIdx === -1) return null;
      // 回溯到最近的 '{'
      let start = typeIdx;
      while (start >= 0 && text[start] !== '{') start--;
      if (start < 0) return null;
      // 以简单的括号深度计数提取完整 JSON（考虑字符串与转义）
      let i = start;
      let depth = 0;
      let inStr = false;
      let escape = false;
      for (; i < text.length; i++) {
        const ch = text[i];
        if (escape) { escape = false; continue; }
        if (ch === '\\') { escape = true; continue; }
        if (ch === '"') { inStr = !inStr; continue; }
        if (!inStr) {
          if (ch === '{') depth++;
          else if (ch === '}') { depth--; if (depth === 0) { i++; break; } }
        }
      }
      if (depth !== 0) return null; // 尚未完整
      const before = text.slice(0, start);
      const json = text.slice(start, i);
      return { before, json, endIndex: i };
    };

    // 主解析循环：每次消费一个片段或状态切换
    while (this.buffer.length > 0) {
      if (this.state === 'BODY') {
        // A0) 发现 <use_mcp_tool> 起始但未闭合，先不要把起始之后的数据当作正文吐出
        const useStart0 = this.buffer.indexOf('<use_mcp_tool>');
        const useEnd0 = this.buffer.indexOf('</use_mcp_tool>');
        if (useStart0 !== -1 && (useEnd0 === -1 || useEnd0 < useStart0)) {
          const before = this.buffer.slice(0, useStart0);
          emitText(before);
          this.buffer = this.buffer.slice(useStart0);
          break;
        }
        // A) <use_mcp_tool> ... </use_mcp_tool>
        const useTag = this.buffer.match(/<use_mcp_tool>([\s\S]*?)<\/use_mcp_tool>/i);
        if (useTag && typeof useTag.index === 'number') {
          const before = this.buffer.slice(0, useTag.index);
          emitText(before);
          const ev = tryEmitToolFromUseTag(useTag[1] || '');
          if (ev) { out.push(ev); this.toolEmitted = true; try { const t = ev as any; console.log('[TOK:tool_call:use_mcp_tool]', t.server, t.tool); } catch { /* noop */ } }
          this.buffer = this.buffer.slice(useTag.index + useTag[0].length);
          continue;
        }
        // 1) XML 包裹的 <tool_call>... </tool_call>
        const xml = this.buffer.match(/<tool_call>([\s\S]*?)<\/tool_call>/i);
        if (xml && typeof xml.index === 'number') {
          const before = this.buffer.slice(0, xml.index);
          emitText(before);
          const ev = tryEmitToolFromJson(xml[1] || '') || tryEmitToolFromXml(xml[1] || '');
          if (ev) { out.push(ev); this.toolEmitted = true; try { const t = ev as any; console.log('[TOK:tool_call:xml]', t.server, t.tool); } catch { /* noop */ } }
          this.buffer = this.buffer.slice(xml.index + xml[0].length);
          continue;
        }
        // 裸 XML（不带 <tool_call> 包裹）
        const typeOnlyIdx = this.buffer.search(/<type>\s*tool_call\s*<\/type>/i);
        if (typeOnlyIdx !== -1) {
          const endParamsIdx = this.buffer.search(/<\/parameters>/i);
          if (endParamsIdx !== -1 && endParamsIdx > typeOnlyIdx) {
            const block = this.buffer.slice(typeOnlyIdx, endParamsIdx + '</parameters>'.length);
            const ev = tryEmitToolFromXml(block);
            if (ev) {
              emitText(this.buffer.slice(0, typeOnlyIdx));
              out.push(ev); this.toolEmitted = true;
              this.buffer = this.buffer.slice(endParamsIdx + '</parameters>'.length);
              continue;
            }
          }
        }
        // 1.5) 发现 <tool_call> 起始但尚无闭合，先不要把起始之后的数据当作正文吐出
        const toolStartIdx = this.buffer.indexOf('<tool_call>');
        const toolEndIdx = this.buffer.indexOf('</tool_call>');
        if (toolStartIdx !== -1 && (toolEndIdx === -1 || toolEndIdx < toolStartIdx)) {
          const before = this.buffer.slice(0, toolStartIdx);
          emitText(before);
          // 保留从 <tool_call> 起始开始的内容以待后续补全
          this.buffer = this.buffer.slice(toolStartIdx);
          break;
        }
        // 2) 裸 JSON：{ ... "type":"tool_call" ... }
        const found = extractFirstToolCallJson(this.buffer);
        if (found) {
          const ev = tryEmitToolFromJson(found.json);
          if (ev) {
            emitText(found.before);
            this.buffer = this.buffer.slice(found.endIndex);
            out.push(ev); this.toolEmitted = true; try { const t = ev as any; console.log('[TOK:tool_call:json]', t.server, t.tool); } catch { /* noop */ }
            continue;
          }
        }
        // 代码围栏开始?
        const fenceIdx = this.buffer.indexOf(FENCE);
        const thinkIdx = this.buffer.indexOf(THINK_START);
        // 进入 FENCE（围栏内不再解析 tool_call，全部作为文本处理）
        if (fenceIdx !== -1 && (thinkIdx === -1 || fenceIdx < thinkIdx)) {
          const before = this.buffer.slice(0, fenceIdx);
          emitText(before);
          this.buffer = this.buffer.slice(fenceIdx + FENCE.length);
          this.state = 'FENCE';
          continue;
        }
        // 进入 THINK
        if (thinkIdx !== -1) {
          const before = this.buffer.slice(0, thinkIdx);
          emitText(before);
          this.buffer = this.buffer.slice(thinkIdx + THINK_START.length);
          out.push({ type: 'think_start' });
          this.state = 'THINK';
          continue;
        }

        // 无特殊片段：不要一次性清空缓冲，保留末尾 SAFE_TAIL 以兼容跨 token 标记
        if (this.buffer.length > SAFE_TAIL) {
          const keep = this.buffer.slice(-SAFE_TAIL);
          const body = this.buffer.slice(0, -SAFE_TAIL);
          // 保护：若 body 里包含 <think> 的开头但未闭合，不把它作为 text 输出，等更多 token
          const thinkIdx2 = body.indexOf(THINK_START);
          const hasOpenThink = thinkIdx2 !== -1 && body.indexOf(THINK_END, thinkIdx2) === -1;
          if (!hasOpenThink) emitText(body);
          this.buffer = keep;
        } else {
          // 保守：等待更多 token，避免把半个 <think> 当作 text 输出
        }
        break;
      }

      if (this.state === 'THINK') {
        const endIdx = this.buffer.indexOf(THINK_END);
        if (endIdx === -1) {
          // 保留 THINK_END.length-1 个字符，避免跨 token 闭合被吃掉
          const tail = Math.max(0, THINK_END.length - 1);
          if (this.buffer.length > tail) {
            const keep = this.buffer.slice(-tail);
            const body = this.buffer.slice(0, -tail);
            if (body) out.push({ type: 'think_chunk', chunk: body });
            this.buffer = keep;
          }
          break;
        }
        if (endIdx > 0) out.push({ type: 'think_chunk', chunk: this.buffer.slice(0, endIdx) });
        out.push({ type: 'think_end' });
        this.buffer = this.buffer.slice(endIdx + THINK_END.length);
        this.state = 'BODY';
        continue;
      }

      // FENCE 状态：在围栏内部也尝试检测 tool_call JSON（优先级高于整体输出）
      if (this.state === 'FENCE') {
        // 先尝试解析围栏中的 tool_call JSON
        const found = extractFirstToolCallJson(this.buffer);
        if (found) {
          const ev = tryEmitToolFromJson(found.json);
          if (ev) {
            emitText(found.before);
            this.buffer = this.buffer.slice(found.endIndex);
            out.push(ev);
            continue;
          }
        }
        // 先处理 <use_mcp_tool>
        const useTag = this.buffer.match(/<use_mcp_tool>([\s\S]*?)<\/use_mcp_tool>/i);
        if (useTag && typeof useTag.index === 'number') {
          const before = this.buffer.slice(0, useTag.index);
          emitText(before);
          const ev = tryEmitToolFromUseTag(useTag[1] || '');
          if (ev) {
            this.buffer = this.buffer.slice(useTag.index + useTag[0].length);
            out.push(ev);
            continue;
          }
        }
        // 再尝试解析围栏中的 XML 工具调用
        const xml = this.buffer.match(/<tool_call>([\s\S]*?)<\/tool_call>/i);
        if (xml && typeof xml.index === 'number') {
          const before = this.buffer.slice(0, xml.index);
          emitText(before);
          const ev = tryEmitToolFromJson(xml[1] || '') || tryEmitToolFromXml(xml[1] || '');
          if (ev) {
            this.buffer = this.buffer.slice(xml.index + xml[0].length);
            out.push(ev);
            continue;
          }
        }
        // 裸 XML（<type>tool_call</type> ... </parameters>）
        const typeOnlyIdx = this.buffer.search(/<type>\s*tool_call\s*<\/type>/i);
        if (typeOnlyIdx !== -1) {
          const endParamsIdx = this.buffer.search(/<\/parameters>/i);
          if (endParamsIdx !== -1 && endParamsIdx > typeOnlyIdx) {
            const block = this.buffer.slice(typeOnlyIdx, endParamsIdx + '</parameters>'.length);
            const ev = tryEmitToolFromXml(block);
            if (ev) {
              emitText(this.buffer.slice(0, typeOnlyIdx));
              this.buffer = this.buffer.slice(endParamsIdx + '</parameters>'.length);
              out.push(ev);
              continue;
            }
          }
        }
        const endIdx = this.buffer.indexOf(FENCE);
        if (endIdx === -1) {
          if (this.buffer) out.push({ type: 'text', chunk: this.buffer });
          this.buffer = '';
          break;
        }
        const inner = this.buffer.slice(0, endIdx);
        if (inner) out.push({ type: 'text', chunk: inner });
        this.buffer = this.buffer.slice(endIdx + FENCE.length);
        this.state = 'BODY';
        continue;
      }
    }

    return out;
  }

  /**
   * 处理流式结束时缓冲区中的剩余内容
   */
  flush(): StructuredEvent[] {
    const out: StructuredEvent[] = [];
    
    // 如果缓冲区中还有内容，强制输出为文本
    if (this.buffer.length > 0) {
      out.push({ type: 'text', chunk: this.buffer });
      this.buffer = '';
    }
    
    return out;
  }
}

