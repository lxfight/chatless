/**
 * 流式分词器（工具调用识别降级路径）
 * 
 * ## 当前状态
 * 
 * 此tokenizer 作为降级路径保留，主要用于：
 * 1. 当Provider不支持 `onEvent` 回调时的兼容处理
 * 2. 从文本中识别工具调用（JSON/XML/MCP格式）作为备用方案
 * 
 * ## 主要架构
 * 
 * **推荐**: Provider → onEvent → StreamOrchestrator → chatStore
 * 
 * **降级**: Provider → onToken → StreamTokenizer → chatStore
 * 
 * ## 职责
 * 
 * - 识别文本中的工具调用（JSON/XML/MCP格式）
 * - 处理代码围栏
 * 
 * ## 不再处理
 * 
 * - <think>标签解析（已由Provider层的ThinkingStrategy处理并通过onEvent输出）
 * 
 * @see src/lib/llm/types/stream-events.ts - 事件类型定义
 * @see src/lib/chat/stream/StreamOrchestrator.ts - 新的流式处理编排器
 * @see src/hooks/useChatActions.ts - onEvent 回调实现
 */

import { StreamEvent, createStreamEvent } from '@/lib/llm/types/stream-events';


type State = 'BODY' | 'FENCE';

/**
 * 简化版流式分词器
 * 只处理工具调用和代码围栏，thinking已由Provider层处理
 */
export class StreamTokenizer {
  private buffer = '';
  private state: State = 'BODY';
  private toolEmitted = false;

  push(token: string): StreamEvent[] {
    this.buffer += token || '';
    const out: StreamEvent[] = [];

    // 工具调用早期探测（只发事件，不把指令本身透传为正文）
    const tryEarlyEmitTool = () => {
      if (this.toolEmitted) return;
      
      // XML格式: <tool_call>...</tool_call>
      const startIdx = this.buffer.indexOf('<tool_call>');
      const endIdx = this.buffer.indexOf('</tool_call>');
      if (startIdx !== -1 && (endIdx === -1 || endIdx < startIdx)) {
        const partial = this.buffer.slice(startIdx + '<tool_call>'.length);
        const ev = this.tryEmitToolFromJson(partial) || this.tryEmitToolFromXml(partial);
        if (ev) { 
          out.push(ev); 
          this.toolEmitted = true; 
        }
      }
      
      // MCP格式: <use_mcp_tool>...</use_mcp_tool>
      const useStart = this.buffer.indexOf('<use_mcp_tool>');
      const useEnd = this.buffer.indexOf('</use_mcp_tool>');
      if (!this.toolEmitted && useStart !== -1 && (useEnd === -1 || useEnd < useStart)) {
        const partial = this.buffer.slice(useStart + '<use_mcp_tool>'.length);
        const ev = this.tryEmitToolFromUseTag(partial);
        if (ev) { 
          out.push(ev); 
          this.toolEmitted = true; 
        }
      }
      
      // JSON格式: {"type":"tool_call",...}
      const typeIdx = this.buffer.search(/"type"\s*:\s*"tool_call"/i);
      if (!this.toolEmitted && typeIdx !== -1) {
        let start = typeIdx;
        while (start >= 0 && this.buffer[start] !== '{') start--;
        if (start >= 0) {
          const partial = this.buffer.slice(start);
          const ev = this.tryEmitToolFromJson(partial);
          if (ev) { 
            out.push(ev); 
            this.toolEmitted = true; 
          }
        }
      }
    };

    tryEarlyEmitTool();

    const FENCE = '```';
    const SAFE_TAIL = 16;

    const emitContent = (txt: string) => { 
      if (txt) { 
        out.push(createStreamEvent.contentToken(txt)); 
      } 
    };

    // 主解析循环（正文输出前，优先剔除工具调用块）
    while (this.buffer.length > 0) {
      if (this.state === 'BODY') {
        // 检测 <use_mcp_tool>，不把其作为正文输出
        const useStart0 = this.buffer.indexOf('<use_mcp_tool>');
        const useEnd0 = this.buffer.indexOf('</use_mcp_tool>');
        if (useStart0 !== -1 && (useEnd0 === -1 || useEnd0 < useStart0)) {
          emitContent(this.buffer.slice(0, useStart0));
          this.buffer = this.buffer.slice(useStart0);
          break;
        }

        // 完整的 <use_mcp_tool>...</use_mcp_tool>（只触发事件，不输出块本身）
        const useTag = this.buffer.match(/<use_mcp_tool>([\s\S]*?)<\/use_mcp_tool>/i);
        if (useTag && typeof useTag.index === 'number') {
          emitContent(this.buffer.slice(0, useTag.index));
          const ev = this.tryEmitToolFromUseTag(useTag[1] || '');
          if (ev) { 
            out.push(ev); 
            this.toolEmitted = true; 
          }
          this.buffer = this.buffer.slice(useTag.index + useTag[0].length);
          continue;
        }

        // 检测 <tool_call>，不把其作为正文输出
        const toolStartIdx = this.buffer.indexOf('<tool_call>');
        const toolEndIdx = this.buffer.indexOf('</tool_call>');
        if (toolStartIdx !== -1 && (toolEndIdx === -1 || toolEndIdx < toolStartIdx)) {
          emitContent(this.buffer.slice(0, toolStartIdx));
          this.buffer = this.buffer.slice(toolStartIdx);
          break;
        }

        // 完整的 <tool_call>...</tool_call>（只触发事件，不输出块本身）
        const xml = this.buffer.match(/<tool_call>([\s\S]*?)<\/tool_call>/i);
        if (xml && typeof xml.index === 'number') {
          emitContent(this.buffer.slice(0, xml.index));
          const ev = this.tryEmitToolFromJson(xml[1] || '') || this.tryEmitToolFromXml(xml[1] || '');
          if (ev) { 
            out.push(ev); 
            this.toolEmitted = true; 
          }
          this.buffer = this.buffer.slice(xml.index + xml[0].length);
          continue;
        }

        // JSON工具调用（只触发事件，不透传JSON到正文）
        const found = this.extractFirstToolCallJson(this.buffer);
        if (found) {
          const ev = this.tryEmitToolFromJson(found.json);
          if (ev) {
            emitContent(found.before);
            this.buffer = this.buffer.slice(found.endIndex);
            out.push(ev); 
            this.toolEmitted = true;
            continue;
          }
        }

        // 代码围栏
        const fenceIdx = this.buffer.indexOf(FENCE);
        if (fenceIdx !== -1) {
          emitContent(this.buffer.slice(0, fenceIdx));
          emitContent('```');
          this.buffer = this.buffer.slice(fenceIdx + FENCE.length);
          this.state = 'FENCE';
          continue;
        }

        // 无特殊片段，输出普通内容
        if (this.buffer.length > SAFE_TAIL) {
          const keep = this.buffer.slice(-SAFE_TAIL);
          const body = this.buffer.slice(0, -SAFE_TAIL);
          emitContent(body);
          this.buffer = keep;
        }
        break;
      }

      // FENCE状态
      if (this.state === 'FENCE') {
        // 在围栏内检测工具调用
        const found = this.extractFirstToolCallJson(this.buffer);
        if (found) {
          const ev = this.tryEmitToolFromJson(found.json);
          if (ev) {
            emitContent(found.before);
            this.buffer = this.buffer.slice(found.endIndex);
            out.push(ev);
            continue;
          }
        }

        // 检测围栏结束
        const endIdx = this.buffer.indexOf(FENCE);
        if (endIdx === -1) {
          if (this.buffer.length > SAFE_TAIL) {
            emitContent(this.buffer.slice(0, -SAFE_TAIL));
            this.buffer = this.buffer.slice(-SAFE_TAIL);
          }
          break;
        }

        emitContent(this.buffer.slice(0, endIdx));
        emitContent('```');
        this.buffer = this.buffer.slice(endIdx + FENCE.length);
        this.state = 'BODY';
      }
    }

    return out;
  }

  flush(): StreamEvent[] {
    const out: StreamEvent[] = [];
    if (this.buffer) {
      out.push(createStreamEvent.contentToken(this.buffer));
      this.buffer = '';
    }
    return out;
  }

  // 辅助方法：JSON解析
  private tryEmitToolFromJson(jsonText: string): StreamEvent | null {
    try {
      let s = jsonText.trim();
      const idx = s.indexOf('{');
      if (idx > 0) s = s.slice(idx);
      
      const obj: any = JSON.parse(s);
      const t = String(obj && (obj.type || obj['r#type']) || '').toLowerCase();
      if (t === 'tool_call' || obj.tool || obj.tool_name) {
        const server = obj.server || obj.mcp || obj.provider || '';
        const tool = obj.tool || obj.tool_name || obj.name || '';
        const args = obj.parameters || obj.args || obj.params || undefined;
        if (server && tool) {
          return createStreamEvent.toolCall(
            `<tool_call>${jsonText}</tool_call>`,
            { serverName: server, toolName: tool, arguments: args }
          );
        }
      }
    } catch { /* ignore */ }
    return null;
  }

  // 辅助方法：XML解析
  private tryEmitToolFromXml(xmlText: string): StreamEvent | null {
    const txt = (xmlText || '').trim();
    if (!/<type>\s*tool_call\s*<\/type>/i.test(txt)) return null;
    
    const mServer = txt.match(/<server>\s*([^<]+)\s*<\/server>/i);
    const mTool = txt.match(/<tool>\s*([^<]+)\s*<\/tool>/i);
    const server = (mServer?.[1] || '').trim();
    const tool = (mTool?.[1] || '').trim();
    
    if (server && tool) {
      return createStreamEvent.toolCall(
        `<tool_call>${xmlText}</tool_call>`,
        { serverName: server, toolName: tool }
      );
    }
    return null;
  }

  // 辅助方法：MCP标签解析
  private tryEmitToolFromUseTag(block: string): StreamEvent | null {
    const s = (block || '').trim();
    const mServer = s.match(/<server_name>\s*([\s\S]*?)\s*<\/server_name>/i);
    const mTool = s.match(/<tool_name>\s*([\s\S]*?)\s*<\/tool_name>/i);
    const mArgs = s.match(/<arguments>\s*([\s\S]*?)\s*<\/arguments>/i);
    
    const server = (mServer?.[1] || '').trim();
    const tool = (mTool?.[1] || '').trim();
    let args: Record<string, unknown> | undefined = undefined;
    
    if (mArgs && mArgs[1]) {
      const inside = mArgs[1].trim();
      const fenced = inside.replace(/^```[a-zA-Z]*\s*/, '').replace(/```\s*$/, '');
      const start = fenced.indexOf('{');
      const end = fenced.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        try { 
          args = JSON.parse(fenced.slice(start, end + 1)); 
        } catch { /* ignore */ }
      }
    }
    
    if (server && tool) {
      return createStreamEvent.toolCall(
        `<use_mcp_tool>${block}</use_mcp_tool>`,
        { serverName: server, toolName: tool, arguments: args ? JSON.stringify(args) : undefined }
      );
    }
    return null;
  }

  // 辅助方法：提取JSON工具调用
  private extractFirstToolCallJson(text: string): null | { before: string; json: string; endIndex: number } {
    const typeIdx = text.search(/"type"\s*:\s*"tool_call"/i);
    if (typeIdx === -1) return null;

    let start = typeIdx;
    while (start >= 0 && text[start] !== '{') start--;
    if (start < 0) return null;

    let depth = 0;
    let i = start;
    for (; i < text.length; i++) {
      if (text[i] === '{') depth++;
      if (text[i] === '}') {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      }
    }

    if (depth !== 0) return null;
    
    const before = text.slice(0, start);
    const json = text.slice(start, i);
    return { before, json, endIndex: i };
  }
}


