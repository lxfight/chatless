/**
 * 规范化工具调用的 arguments：
 * - 支持字符串 JSON
 * - 支持对象
 * - 其他类型与空值返回 undefined
 */
export function normalizeToolArgs(raw: unknown): Record<string, unknown> | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return undefined; }
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  return undefined;
}


