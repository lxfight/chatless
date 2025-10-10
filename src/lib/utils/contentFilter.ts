/**
 * 内容过滤工具
 * 用于过滤掉content中的工具调用标记，避免与segments重复渲染
 */

/**
 * 过滤掉content中的工具调用标记
 * 这些内容应该只在ToolCallCard中渲染
 */
export function filterToolCallMarkers(content: string): string {
  if (!content) return '';
  
  // 移除 JSON 格式的工具调用标记
  // 例如: {"__tool_call_card__":{"id":"xxx","server":"filesystem","tool":"list_directory",...}}
  const filtered = content.replace(/\{[^}]*"__tool_call_card__"[^}]*\}/g, '');
  
  // 不要修改换行符！保留原始markdown格式
  // 注意：之前的 replace(/\n\n+/g, '\n\n').trim() 会破坏markdown格式
  
  return filtered;
}

/**
 * 检查content是否包含工具调用标记
 */
export function hasToolCallMarkers(content: string): boolean {
  return /"__tool_call_card__"/.test(content);
}

