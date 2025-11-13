/**
 * 工具调用失败追踪器
 * 
 * 负责统计和管理工具调用失败次数，用于提供递进式的错误提示
 */

/**
 * 获取失败计数器的键
 */
function getFailCounterKey(conversationId: string, server: string, tool: string): string {
  return `mcp-fails-${conversationId}::${server}::${tool}`;
}

/**
 * 增加工具调用失败计数
 * 
 * @param conversationId - 会话ID
 * @param server - 服务器名称
 * @param tool - 工具名称
 * @returns 当前失败次数
 * 
 * @example
 * ```typescript
 * const failCount = incrementFailCount('conv-123', 'filesystem', 'read');
 * if (failCount === 1) {
 *   // 第一次失败，给出简单提示
 * } else if (failCount === 2) {
 *   // 第二次失败，给出详细提示
 * }
 * ```
 */
export function incrementFailCount(
  conversationId: string,
  server: string,
  tool: string
): number {
  const key = getFailCounterKey(conversationId, server, tool);
  const current = (globalThis as any)[key] || 0;
  const next = current + 1;
  (globalThis as any)[key] = next;
  return next;
}

/**
 * 获取工具调用失败计数
 * 
 * @param conversationId - 会话ID
 * @param server - 服务器名称
 * @param tool - 工具名称
 * @returns 当前失败次数
 */
export function getFailCount(
  conversationId: string,
  server: string,
  tool: string
): number {
  const key = getFailCounterKey(conversationId, server, tool);
  return (globalThis as any)[key] || 0;
}

/**
 * 重置工具调用失败计数
 * 
 * @param conversationId - 会话ID
 * @param server - 服务器名称
 * @param tool - 工具名称
 */
export function resetFailCount(
  conversationId: string,
  server: string,
  tool: string
): void {
  const key = getFailCounterKey(conversationId, server, tool);
  delete (globalThis as any)[key];
}

/**
 * 构建简洁的错误引导文本
 * 
 * 基于工具规范和实际错误生成针对性的修复建议
 * 
 * @param spec - 工具规范对象
 * @returns 简洁的引导文本
 */
export function buildConciseGuideText(spec: any): string {
  if (!spec || !spec.issues) return '';
  
  const lines: string[] = [];
  const missing: string[] = spec.issues.missingRequired || [];
  const unknown: string[] = spec.issues.unknownKeys || [];
  const mismatches: Array<{ key: string; expected: string; actual: string }> = 
    spec.issues.typeMismatches || [];
  const enums: Array<{ key: string; expected: string[]; actual: any }> = 
    spec.issues.enumViolations || [];
  
  if (missing.length) {
    lines.push(`缺失必填：${missing.join(', ')}`);
  }
  
  if (unknown.length) {
    lines.push(`未知参数：${unknown.join(', ')}`);
  }
  
  if (mismatches.length) {
    lines.push(`类型不匹配：${mismatches.map(
      (i) => `${i.key}(期望:${i.expected}, 实际:${i.actual})`
    ).join('; ')}`);
  }
  
  if (enums.length) {
    lines.push(`枚举不匹配：${enums.map(
      (i) => `${i.key}(允许:${(i.expected || []).slice(0, 20).join('|')}, 实际:${JSON.stringify(i.actual)})`
    ).join('; ')}`);
  }
  
  const suggestedArgs = spec.suggestedArguments 
    ? JSON.stringify(spec.suggestedArguments, null, 2) 
    : '';
  
  if (suggestedArgs) {
    lines.push('建议的最小可行 arguments：\n' + suggestedArgs);
  }
  
  return lines.join('\n');
}

