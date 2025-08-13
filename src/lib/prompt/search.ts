import type { PromptItem } from '@/types/prompt';

function normalize(text: string): string {
  return text.toLowerCase();
}

export function scorePrompt(prompt: PromptItem, query: string): number {
  if (!query) return 0;
  const q = normalize(query);
  let score = 0;
  const fields = [prompt.name, prompt.description || '', prompt.content, (prompt.tags || []).join(' ')];
  for (const f of fields) {
    const t = normalize(f || '');
    if (!t) continue;
    if (t.includes(q)) score += q.length * 2;
    const words = q.split(/\s+/).filter(Boolean);
    for (const w of words) {
      if (t.includes(w)) score += w.length;
    }
  }
  score += (prompt.stats?.uses || 0) * 0.1;
  return score;
}

export function filterAndSortPrompts(prompts: PromptItem[], opts: { query?: string; favoriteOnly?: boolean; tag?: string | null; sortBy?: 'recent'|'frequency'|'name' }) {
  const { query = '', favoriteOnly = false, tag = null, sortBy = 'recent' } = opts || {};
  let list = prompts.filter((p) => {
    if (favoriteOnly && !p.favorite) return false;
    if (tag && !(p.tags || []).some((t) => t.toLowerCase() === tag.toLowerCase())) return false;
    if (!query) return true;
    return scorePrompt(p, query) > 0;
  });
  switch (sortBy) {
    case 'frequency':
      list = list.sort((a, b) => (b.stats?.uses || 0) - (a.stats?.uses || 0));
      break;
    case 'name':
      list = list.sort((a, b) => a.name.localeCompare(b.name));
      break;
    default:
      list = list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }
  if (query) list = list.sort((a, b) => scorePrompt(b, query) - scorePrompt(a, query));
  return list;
}

