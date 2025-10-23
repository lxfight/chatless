/**
 * LLM响应日志工具
 * 用于在流式调用结束时打印完整的响应内容
 */

interface ResponseContent {
  thinking?: string;
  content?: string;
  toolCalls?: Array<{
    server?: string;
    tool?: string;
    arguments?: string;
  }>;
  raw?: string;
  [key: string]: any;
}

/**
 * 格式化并打印LLM完整响应
 * @param provider 提供者名称
 * @param model 模型名称
 * @param response 响应内容
 */
export function logCompleteResponse(
  provider: string,
  model: string,
  response: ResponseContent
) {
  console.group(`📨 [${provider}] LLM完整响应`);
  
  console.log('🤖 模型:', model);
  
  // Thinking内容
  if (response.thinking) {
    console.log('💭 Thinking:', {
      length: response.thinking.length,
      preview: truncateText(response.thinking, 200),
      full: response.thinking.length <= 500 ? response.thinking : '[太长，已截断]'
    });
  }
  
  // Content内容
  if (response.content) {
    console.log('💬 Content:', {
      length: response.content.length,
      preview: truncateText(response.content, 200),
      full: response.content.length <= 500 ? response.content : '[太长，已截断]',
      hasToolCall: response.content.includes('<use_mcp_tool>'),
      hasThinkTag: response.content.includes('<think>')
    });
  }
  
  // 工具调用
  if (response.toolCalls && response.toolCalls.length > 0) {
    console.log('🔧 工具调用:', response.toolCalls.map(tc => ({
      server: tc.server,
      tool: tc.tool,
      args: truncateText(tc.arguments || '', 100)
    })));
  }
  
  // Raw原始内容（如果有）
  if (response.raw) {
    const sanitizedRaw = sanitizeRaw(response.raw);
    console.log('📦 原始响应:', {
      length: response.raw.length,
      preview: truncateText(sanitizedRaw, 300)
    });
  }
  
  // 其他元数据
  const metadata = Object.keys(response).filter(
    k => !['thinking', 'content', 'toolCalls', 'raw'].includes(k)
  );
  if (metadata.length > 0) {
    const metaObj: Record<string, any> = {};
    metadata.forEach(key => {
      metaObj[key] = response[key];
    });
    console.log('📊 元数据:', metaObj);
  }
  
  console.groupEnd();
}

/**
 * 截断文本
 */
function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + `... [+${text.length - maxLength}字符]`;
}

/**
 * 清理raw内容（替换base64等大型数据）
 */
function sanitizeRaw(raw: string): string {
  if (!raw) return '';
  
  // 替换base64图片数据
  let sanitized = raw.replace(
    /"data:image\/[^"]+;base64,[^"]+"/g,
    '"[BASE64_IMAGE_DATA]"'
  );
  
  // 替换其他base64数据
  sanitized = sanitized.replace(
    /[A-Za-z0-9+/]{100,}={0,2}/g,
    '[BASE64_DATA]'
  );
  
  return sanitized;
}

/**
 * 从thinking策略中提取累积内容
 */
export function extractAccumulatedContent(strategy: any): {
  thinking: string;
  content: string;
} {
  return {
    thinking: strategy?.thinkingBuffer || '',
    content: strategy?.contentBuffer || ''
  };
}

