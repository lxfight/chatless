/**
 * 追问阶段专用提示词
 * 
 * 设计原则：
 * 1. 精简高效：追问阶段不需要重复所有初始调用的规则
 * 2. 聚焦目标：明确告知模型当前任务（基于工具结果回答）
 * 3. 减少干扰：避免提供过多工具调用指导，优先引导直接回答
 */

/**
 * 第一次追问：工具执行完成后的初次追问
 * 目标：引导模型基于工具结果直接给出答案
 * 
 * @param originalQuestion - 用户原始问题
 * @param hasError - 工具调用是否失败
 * @param enabledServers - 可用的服务器列表（用于在一个消息中提供工具上下文）
 * @param includeToolContext - 是否包含工具上下文
 */
export function buildFirstFollowUpPrompt(
  originalQuestion: string, 
  hasError?: boolean,
  enabledServers?: string[],
  includeToolContext?: boolean
): string {
  if (hasError) {
    // 工具调用失败时的特殊提示
    const toolInfo = includeToolContext && enabledServers && enabledServers.length > 0
      ? `\n\n【可用工具】\n${enabledServers.join(', ')}\n\n【调用格式】\n<use_mcp_tool><server_name>...</server_name><tool_name>...</tool_name><arguments>{...}</arguments></use_mcp_tool>`
      : '';
    
    return `工具调用遇到了问题。请基于错误信息处理：

【处理策略】：
1. 如果是参数错误，请调整参数后重新调用该工具
2. 如果是连接错误，请直接重试该工具（系统会自动重连）
3. 如果是工具不可用，请尝试其他可用工具
4. 如果无法通过工具解决，请基于已有知识回答用户

用户问题：${originalQuestion}${toolInfo}`;
  }
  
  // 正常情况：工具成功返回结果
  const toolInfo = includeToolContext && enabledServers && enabledServers.length > 0
    ? `\n\n【备用选项】（仅在结果明显错误或完全不相关时使用）\n可用工具: ${enabledServers.join(', ')}`
    : '';
  
  return `你现在需要基于工具调用结果，给用户一个完整的中文答案。

【核心任务】（最高优先级）：
1. 工具已经返回了结果，你的任务是阅读和总结
2. 直接输出中文答案，不要输出工具调用指令
3. 答案要简洁明了，以最少的字说明用户问的问题，不要直接重复工具调用结果
4. 除非信息明显不足，一般不应再调用超过 1 次新的工具；如果多次尝试后仍有不确定之处，请说明局限并给出你能给出的最佳答案。

用户问题：${originalQuestion}${toolInfo}`;
}

/**
 * 第二次追问（轻量追问）：第一次追问失败后的强制追问
 * 目标：更强硬地要求模型直接回答，禁止工具调用
 */
export function buildSecondFollowUpPrompt(originalQuestion: string): string {
  return `【最终回答要求】

工具调用结果已经提供，现在必须给出最终答案。

你的任务：
1. 阅读上面的工具调用结果
2. 直接输出中文答案（不超过150字）
3. 禁止输出任何工具调用指令
4. 禁止说"我需要..."、"让我..."等规划性语言

用户问题：${originalQuestion}

现在直接回答：`;
}

/**
 * 精简的工具描述（仅在真正需要时提供）
 * 只包含最核心的信息，用于第一次追问阶段
 */
export function buildMinimalToolContext(enabledServers: string[]): string[] {
  const messages: string[] = [];
  
  // 只提供可用服务器列表，不提供详细的工具描述
  if (enabledServers.length > 0) {
    const list = enabledServers.length > 3 
      ? `${enabledServers.slice(0, 3).join(', ')} (+${enabledServers.length - 3} more)` 
      : enabledServers.join(', ');
    messages.push(`可用工具: ${list}`);
  }
  
  // 只提供最简单的调用格式，不提供详细规则
  messages.push(`如需调用工具: <use_mcp_tool><server_name>...</server_name><tool_name>...</tool_name><arguments>{...}</arguments></use_mcp_tool>`);
  
  return messages;
}

/**
 * 构建追问阶段的完整system消息
 * 
 * 优化策略：合并为单一长消息，减少LLM混淆
 * 
 * @param stage - 追问阶段：'first' | 'second'
 * @param originalQuestion - 用户原始问题
 * @param enabledServers - 可用的服务器列表
 * @param includeToolContext - 是否包含工具上下文（第二次追问不包含）
 * @param hasError - 工具调用是否失败（用于调整提示策略）
 */
export function buildFollowUpSystemMessages(
  stage: 'first' | 'second',
  originalQuestion: string,
  enabledServers: string[] = [],
  includeToolContext: boolean = true,
  hasError?: boolean
): Array<{ role: 'system'; content: string }> {
  // 优化：将所有提示词合并为单一长消息
  // 原因：减少system消息数量，避免优先级混淆，提高指令遵循率
  
  const messages: Array<{ role: 'system'; content: string }> = [];
  
  // 追问阶段也需要时间上下文，但使用简洁版本
  try {
    const { buildSimpleTimeContext, isTimeRelatedQuery } = require('@/lib/prompts/TimeContext');
    const isTimeRelated = isTimeRelatedQuery(originalQuestion);
    if (isTimeRelated) {
      const timeContext = buildSimpleTimeContext();
      messages.push({ role: 'system', content: timeContext });
    }
  } catch {
    // 忽略错误，时间上下文不是必需的
  }
  
  if (stage === 'first') {
    // 第一次追问：合并核心任务和工具上下文到一个消息
    const prompt = buildFirstFollowUpPrompt(
      originalQuestion, 
      hasError, 
      enabledServers, 
      includeToolContext
    );
    messages.push({ role: 'system', content: prompt });
    return messages;
  } else {
    // 第二次追问：保持简洁，只有强制回答指令
    const prompt = buildSecondFollowUpPrompt(originalQuestion);
    messages.push({ role: 'system', content: prompt });
    return messages;
  }
}

/**
 * 追问阶段的设计哲学
 * 
 * ## 为什么要精简？
 * 
 * 1. **减少token消耗**：追问阶段不需要重复所有初始规则
 * 2. **提高理解度**：过多规则反而让模型confused，不知道优先级
 * 3. **聚焦当前任务**：工具已执行完成，现在只需要"总结回答"
 * 4. **避免误导**：详细的工具调用指导反而鼓励模型再次调用工具
 * 
 * ## 两阶段策略
 * 
 * - **第一次追问**：温和引导，允许在结果不足时调用工具
 * - **第二次追问**：强制回答，完全禁止工具调用
 * 
 * ## 对比初始调用
 * 
 * | 阶段 | System消息数量 | 包含内容 |
 * |------|---------------|----------|
 * | 初始调用 | 10-20条 | 详细工具描述、完整规则、示例 |
 * | 第一次追问 | 2-3条 | 核心任务、最小化工具信息 |
 * | 第二次追问 | 1条 | 强制回答指令 |
 */

