/**
 * 工具调用内容清理工具
 * 
 * 负责从消息内容中移除工具调用指令，确保用户只看到工具卡片而不是原始指令
 */

/**
 * 清理文本中的所有工具调用指令
 * 
 * @param text 要清理的文本
 * @returns 清理后的文本
 */
export function cleanToolCallInstructions(text: string): string {
  if (!text) return '';
  
  let cleaned = text;
  
  // 1. 移除完整的 <use_mcp_tool> 块
  cleaned = cleaned.replace(/<use_mcp_tool>[\s\S]*?<\/use_mcp_tool>/gi, '');
  
  // 2. 移除完整的 <tool_call> 块
  cleaned = cleaned.replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '');
  
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

