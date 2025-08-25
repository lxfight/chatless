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

export function toolResultToNextMessage(provider: Provider, server: string, tool: string, result: unknown): { role: 'user' | 'system'; content: string } {
  // 先用通用文本回注，兼容所有模型；后续按 provider 的工具结果协议替换
  const text = typeof result === 'string' ? result : JSON.stringify(result);
  return {
    role: 'user',
    content: `Here is the result of MCP tool use ${server}.${tool}: ${text.slice(0, 4000)}\nPlease produce the final answer directly. If another tool is required, output <tool_call>{json}</tool_call> only.`
  };
}

