/**
 * 工具参数规范化器
 * 
 * 负责将工具调用的参数规范化为统一格式
 */

/**
 * 规范化工具参数
 * 
 * @param server - 服务器名称
 * @param originalArgs - 原始参数
 * @returns 规范化后的参数
 * 
 * @example
 * ```typescript
 * const normalized = normalizeArgs('filesystem', { path: 'C:\\Users\\file.txt' });
 * // 返回: { path: 'C:/Users/file.txt' }
 * ```
 */
export function normalizeArgs(
  server: string,
  originalArgs: Record<string, unknown>
): Record<string, unknown> {
  const args: Record<string, unknown> & { path?: string } = { ...(originalArgs || {}) };
  
  // Filesystem: 统一路径分隔符为正斜杠
  if (server === 'filesystem' && typeof args.path === 'string') {
    args.path = args.path.replace(/\\/g, '/');
  }
  
  return args;
}

