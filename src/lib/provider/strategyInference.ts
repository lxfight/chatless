// 统一的模型ID → 请求策略 推断工具

export type StrategyValue = 'openai' | 'openai-responses' | 'openai-compatible' | 'anthropic' | 'gemini' | 'deepseek';

/**
 * 根据模型 id/名称 推断应使用的请求策略。
 * - gemini → gemini
 * - deepseek → deepseek
 * - claude/anthropic → anthropic
 * - gpt/openai → openai
 * - 兜底 → openai-compatible
 */
export function inferStrategyFromModelId(modelId: string): StrategyValue | null {
  const s = (modelId || '').toLowerCase();
  if (s.includes('gemini')) return 'gemini';
  if (s.includes('deepseek')) return 'deepseek';
  if (s.includes('claude') || s.includes('anthropic')) return 'anthropic';
  if (s.includes('gpt') || s.includes('openai')) return 'openai';
  return null;
}


