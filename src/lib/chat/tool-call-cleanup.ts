/**
 * 工具调用内容清理工具
 * 
 * 负责从消息内容中移除工具调用指令，确保用户只看到工具卡片而不是原始指令
 */

import { WEB_SEARCH_SERVER_NAME } from "../mcp/nativeTools/webSearch";

/**
 * 清理文本中的所有工具调用指令
 * 
 * @param text 要清理的文本
 * @returns 清理后的文本
 */
export function cleanToolCallInstructions(text: string): string {
  if (!text) return '';
  
  let cleaned = text;
  
  // 0. 移除 GPT-OSS 风格的工具调用指令
  //    形如：<|channel|>commentary to=web_search <|constrain|>json<|message|>{...}
  cleaned = cleaned.replace(
    /<\|channel\|\>\s*commentary\s+to=[^\s]+[\s\S]*?<\|message\|\>\s*\{[\s\S]*?\}/gi,
    ''
  );

  // 1. 移除完整的 <use_mcp_tool> 块
  cleaned = cleaned.replace(/<use_mcp_tool>[\s\S]*?<\/use_mcp_tool>/gi, '');
  
  // 2. 移除完整的 <tool_call> 块
  cleaned = cleaned.replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '');
  // 2.1 移除无标签 GPT‑OSS 变体：commentary to=... json {...}
  cleaned = cleaned.replace(/commentary\s+to=[^\n]+?\s+json\s*\{[\s\S]*?\}/gi, '');
  // 2.2 移除“>>”分隔符变体：to= >>server>>tool>>{...}>>
  cleaned = cleaned.replace(/to\s*=\s*>+[a-z0-9_\-]+>+[a-z0-9_\-]+>+\s*\{[\s\S]*?\}>+/gi, '');
  
  // 3. 移除 JSON 格式的工具调用
  cleaned = cleaned.replace(/\{[\s\S]*?"type"\s*:\s*"tool_call"[\s\S]*?\}/gi, '');
  
  // 4. 移除未完成的指令片段（流式输出中可能出现）
  cleaned = cleaned.replace(/<use_mcp_tool>[\s\S]*$/i, '');
  cleaned = cleaned.replace(/<tool_call>[\s\S]*$/i, '');
  
  // 5. 移除内部工具卡片标记
  cleaned = cleaned.replace(/\{[^}]*"__tool_call_card__"[^}]*\}/g, '');
  
  // 6. 清理多余的空行（但保留 markdown 格式）
  cleaned = cleaned.replace(/\n\n\n+/g, '\n\n').trim();
  
  return cleaned;
}

/**
 * 从文本中提取工具调用指令（不清理文本）
 * 
 * @param text 要解析的文本
 * @returns 解析出的工具调用信息，如果没有则返回 null
 */
export function extractToolCallFromText(
  text: string
): null | { server: string; tool: string; args?: Record<string, unknown> } {
  if (!text) return null;
  
  // 0. 解析 GPT-OSS 风格：<|channel|>commentary to=xxx[.yyy] <|constrain|>json <|message|>{...}
  try {
    const chan = /<\|channel\|\>\s*commentary\s+to=([\s\S]*?)(?:\s*)(?:<\|constrain\|\>|<\|message\|\>)/i.exec(text);
    if (chan) {
      const toTargetRaw = (chan[1] || '').trim();
      const msgIndex = chan.index !== undefined ? (chan.index + chan[0].length) : -1;
      if (toTargetRaw && msgIndex >= 0) {
        const json = extractFirstJsonObject(text.slice(msgIndex));
        if (json) {
          try {
            const args = JSON.parse(json);
            let server = '';
            let tool = '';
            if (toTargetRaw.includes('.')) {
              const dot = toTargetRaw.indexOf('.');
              server = toTargetRaw.slice(0, dot).trim();
              tool = toTargetRaw.slice(dot + 1).trim().replace(/\s+/g, '_');
            } else {
              server = toTargetRaw.trim();
              // 未带工具名：对 web_search 设默认 search，其他服务器无法确定则返回 null
              tool = server === WEB_SEARCH_SERVER_NAME ? 'search' : '';
            }
            if (server && tool) {
              return { server, tool, args };
            }
          } catch { /* ignore */ }
        }
      }
    }
  } catch { /* ignore */ }

  // 1. 尝试解析 <tool_call> XML 格式
  const xmlMatch = text.match(/<tool_call>([\s\S]*?)<\/tool_call>/i);
  if (xmlMatch && xmlMatch[1]) {
    try {
      const obj = JSON.parse(xmlMatch[1]);
      const server = obj.server || obj.mcp || obj.provider;
      const tool = obj.tool || obj.tool_name || obj.name;
      if (server && tool) {
        return {
          server,
          tool,
          args: obj.parameters || obj.args || obj.params
        };
      }
    } catch { /* ignore */ }
  }
  
  // 2. 尝试解析 <use_mcp_tool> 格式
  const useMatch = text.match(/<use_mcp_tool>([\s\S]*?)<\/use_mcp_tool>/i);
  if (useMatch && useMatch[1]) {
    try {
      const block = useMatch[1];
      const mServer = block.match(/<server_name[^>]*>([\s\S]*?)<\/server_name>/i);
      const mTool = block.match(/<tool_name[^>]*>([\s\S]*?)<\/tool_name>/i);
      const mArgs = block.match(/<arguments[^>]*>([\s\S]*?)<\/arguments>/i);
      
      const server = (mServer?.[1] || '').trim();
      const tool = (mTool?.[1] || '').trim();
      
      let args: Record<string, unknown> | undefined = undefined;
      if (mArgs && mArgs[1]) {
        const inside = mArgs[1].trim();
        // 移除可能的代码围栏
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
        return { server, tool, args };
      }
    } catch { /* ignore */ }
  }
  
  // 2.5 解析“>>”分隔符极简变体：to= >>server>>tool>>{...}>>
  try {
    const simple = /to\s*=\s*>+([a-z0-9_\-]+)>+([a-z0-9_\-]+)>+\s*/i.exec(text);
    if (simple) {
      const server = simple[1];
      const tool = simple[2].replace(/\s+/g, '_');
      const pos = simple.index !== undefined ? (simple.index + simple[0].length) : -1;
      if (server && tool && pos >= 0) {
        const jsonStr = extractFirstJsonObject(text.slice(pos));
        if (jsonStr) {
          try {
            const args = JSON.parse(jsonStr);
            return { server, tool, args };
          } catch { /* ignore */ }
        }
      }
    }
  } catch { /* ignore */ }
  
  // 3. 尝试解析裸 JSON 格式
  try {
    const jsonMatch = text.match(/\{[\s\S]*?"type"\s*:\s*"tool_call"[\s\S]*?\}/i);
    if (jsonMatch && jsonMatch[0]) {
      const obj = JSON.parse(jsonMatch[0]);
      const server = obj.server || obj.mcp || obj.provider;
      const tool = obj.tool || obj.tool_name || obj.name;
      if (server && tool) {
        return {
          server,
          tool,
          args: obj.parameters || obj.args || obj.params
        };
      }
    }
  } catch { /* ignore */ }
  
  return null;
}

/**
 * 从给定字符串开头提取第一个 JSON 对象（基于括号深度匹配）
 */
function extractFirstJsonObject(s: string): string | null {
  let depth = 0;
  let start = -1;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '{') {
      if (start === -1) start = i;
      depth++;
    } else if (ch === '}') {
      if (depth > 0) depth--;
      if (depth === 0 && start !== -1) {
        return s.slice(start, i + 1);
      }
    }
  }
  return null;
}

/**
 * 创建工具调用卡片标记
 * 
 * @param cardId 卡片唯一标识
 * @param server 服务器名称
 * @param tool 工具名称
 * @param args 工具参数
 * @param messageId 消息ID
 * @returns JSON 字符串标记
 */
export function createToolCardMarker(
  cardId: string,
  server: string,
  tool: string,
  args: Record<string, unknown> | undefined,
  messageId: string
): string {
  return JSON.stringify({
    __tool_call_card__: {
      id: cardId,
      server,
      tool,
      status: 'running' as const,
      args: args || {},
      messageId
    }
  });
}

