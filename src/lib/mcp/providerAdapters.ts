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

/**
 * 格式化web_search结果，提取关键信息
 */
function formatWebSearchResult(result: unknown): string {
  if (!Array.isArray(result) || result.length === 0) {
    return JSON.stringify(result);
  }

  // 提取前3个搜索结果的关键信息
  const formatted = result.slice(0, 3).map((item, index) => {
    const title = item?.source_title || item?.title || '未知标题';
    const url = item?.url || '';
    let snippet = item?.snippet || '';
    
    // 清理snippet: 移除过多的HTML标记和重复的换行
    snippet = snippet
      .replace(/!\[\]\([^)]+\)/g, '') // 移除markdown图片
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 转换markdown链接为纯文本
      .replace(/\\n{3,}/g, '\n\n') // 压缩过多换行
      .replace(/\s{3,}/g, ' ') // 压缩过多空格
      .slice(0, 500); // 限制snippet长度

    return `${index + 1}. ${title}\n${url ? `链接: ${url}\n` : ''}摘要: ${snippet}\n`;
  }).join('\n---\n\n');

  return `搜索返回 ${result.length} 个结果，以下是前 ${Math.min(3, result.length)} 个:\n\n${formatted}`;
}

export function toolResultToNextMessage(provider: Provider, server: string, tool: string, result: unknown, originalUserContent?: string): { role: 'user' | 'system'; content: string } {
  // 对web_search结果进行特殊格式化
  let formattedResult: string;
  if (server === 'web_search' && tool === 'search') {
    formattedResult = formatWebSearchResult(result);
  } else {
    formattedResult = typeof result === 'string' ? result : JSON.stringify(result);
  }
  
  const text = formattedResult.slice(0, 12000);
  const userContext = originalUserContent ? `用户原始问题：${originalUserContent}\n\n` : '';
  
  return {
    role: 'user',
    content: `${userContext}下面是刚刚调用 ${server}.${tool} 得到的结果（可能已做适度截断）：
${text}

请你先认真阅读这些结果，并结合你已有的知识，直接用中文回答用户的问题。

【回答策略】
1. 如果这些结果已经基本覆盖用户问题，请直接给出清晰、凝练的中文答案（尽量一次说完）。
2. 只有在结果明显缺少关键信息时，才可以再调用极少量的工具补充信息（一般不超过 1 次），并避免对同一内容反复搜索。
3. 工具调用完成后必须给出最终答案，而不是继续规划或无限制地重复调用工具。

请基于实际情况给出你认为最有帮助、最直接的回答。`
  };
}

