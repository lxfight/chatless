/**
 * 解析AI消息内容，分离代码块和非代码块文本
 */
export interface CodePart {
  language: string | null;
  code: string;
}

export interface ParsedMessage {
  nonCodeParts: string[];
  codeParts: CodePart[];
}

/**
 * 解析消息内容，分离代码块和非代码文本
 */
export function parseMessageContent(content: string): ParsedMessage {
  const nonCodeParts: string[] = [];
  const codeParts: CodePart[] = [];
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;

  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // 添加代码块之前的部分
    if (match.index > lastIndex) {
      nonCodeParts.push(content.substring(lastIndex, match.index));
    }
    
    // 添加代码块
    codeParts.push({
      language: match[1] || null,
      code: match[2].trim(),
    });
    
    lastIndex = match.index + match[0].length;
  }

  // 添加最后一个代码块之后的部分
  if (lastIndex < content.length) {
    nonCodeParts.push(content.substring(lastIndex));
  }
  
  // 如果没有代码块，整个内容就是非代码部分
  if (codeParts.length === 0 && nonCodeParts.length === 0 && content) {
      nonCodeParts.push(content);
  }

  return { nonCodeParts, codeParts };
}

/**
 * 解析消息内容，分离思考内容和常规内容
 */
export function parseMessageWithThinking(content: string): {
  hasThinking: boolean;
  thinkingContent: string;
  responseContent: string;
  isThinkingComplete: boolean;
} {
  const thinkStartIndex = content.indexOf('<think>');
  const thinkEndIndex = content.indexOf('</think>');
  
  // 如果只有开始标签，说明思考还未完成，所有内容都是思考内容
  if (thinkStartIndex !== -1 && thinkEndIndex === -1) {
    const thinkingContent = content.substring(thinkStartIndex + 7);
    const responseContent = content.substring(0, thinkStartIndex);
    
    const result = {
      hasThinking: true,
      thinkingContent: thinkingContent.trim(),
      responseContent: responseContent.trim(),
      isThinkingComplete: false // 思考还未完成
    };
    

    
    return result;
  }
  
  // 如果有完整的think标签
  if (thinkStartIndex !== -1 && thinkEndIndex !== -1 && thinkEndIndex > thinkStartIndex) {
    const thinkingContent = content.substring(thinkStartIndex + 7, thinkEndIndex);
    const beforeThink = content.substring(0, thinkStartIndex);
    const afterThink = content.substring(thinkEndIndex + 8);
    // 确保正确处理换行符，避免内容丢失
    const responseContent = (beforeThink + afterThink).trim();
    
    const result = {
      hasThinking: true,
      thinkingContent: thinkingContent.trim(),
      responseContent: responseContent.trim(),
      isThinkingComplete: true
    };
    

    
    return result;
  }
  
  // 如果没有找到think标签，返回原始内容
  return {
    hasThinking: false,
    thinkingContent: '',
    responseContent: content,
    isThinkingComplete: true
  };
}

/**
 * 计算思考时长（基于内容长度估算）
 * 这是一个简单的估算方法，假设平均阅读/思考速度
 */
function calculateThinkingDuration(thinkingContent: string): number {
  // 基于字符数估算思考时间
  // 假设平均每秒思考5-10个字符（中文）
  const charCount = thinkingContent.length;
  const baseTime = Math.max(3, Math.floor(charCount / 8)); // 最少3秒，平均每8个字符1秒
  
  // 添加一些随机性，模拟真实的思考时间
  const randomFactor = 0.8 + Math.random() * 0.4; // 0.8-1.2的随机系数
  
  return Math.floor(baseTime * randomFactor);
}

/**
 * 检查消息是否包含思考内容
 * 注意：这个函数的逻辑可能需要根据新的需求重新评估或移除
 * 因为我们不再显式处理 <think> 标签了
 */
export function hasThinkingContent(content: string): boolean {
  const thinkRegex = /<think>[\s\S]*?<\/think>/gi;
  return thinkRegex.test(content);
} 