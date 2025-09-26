// 预留 Provider 适配层骨架：后续将 MCP 工具映射到各 Provider 的原生工具/函数协议

export type Provider = 'openai' | 'anthropic' | 'gemini' | 'bedrock' | string;

export interface ProviderToolSpec {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>; // JSON Schema 片段
}

export function mcpToolsToProviderSpec(provider: Provider, tools: any[]): ProviderToolSpec[] {
  // 目前占位：返回最小必要信息；后续按 provider 差异做映射和裁剪
  return (tools || []).map((t: any) => ({
    name: t?.name,
    description: t?.description,
    parameters: t?.inputSchema || t?.input_schema || undefined,
  }));
}

export function toolResultToNextMessage(provider: Provider, server: string, tool: string, result: unknown, originalUserContent?: string): { role: 'user' | 'system'; content: string } {
  // 先用通用文本回注，兼容所有模型；后续按 provider 的工具结果协议替换
  const text = typeof result === 'string' ? result : JSON.stringify(result);
  const userContext = originalUserContent ? `用户原始问题：${originalUserContent}\n\n` : '';
  
  return {
    role: 'user',
    content: `${userContext}工具调用结果：${server}.${tool} -> ${text.slice(0, 12000)}

请分析上述工具调用结果：
1. 如果结果正常且足够回答用户问题，请直接给出完整的中文答案
2. 如果结果异常（如错误、空结果、格式问题等），请尝试调用其他工具或重新调用该工具
3. 如果还需要更多信息才能完整回答，请继续调用相关工具
4. 如果需要调用工具，请使用 <use_mcp_tool><server_name>...</server_name><tool_name>...</tool_name><arguments>{...}</arguments></use_mcp_tool> 格式

请基于实际情况灵活处理，确保最终能够完整回答用户的原始问题。`
  };
}

