const EN_STOPWORDS = new Set([
  'the','a','an','and','or','of','to','for','in','on','at','by','with','from','as','is','are','be','this','that','these','those','your','my','our','their','into'
]);

function stripDiacritics(input: string): string {
  try {
    return input.normalize('NFD').replace(/\p{Diacritic}+/gu, '');
  } catch {
    return input;
  }
}

function segmentWords(text: string, locale: string): string[] {
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const seg = new (Intl as any).Segmenter(locale || 'en', { granularity: 'word' });
    return Array.from(seg.segment(text)).map((s: any) => s.segment).filter((w: string) => /\p{L}|\p{N}/u.test(w));
  } catch {
    return text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  }
}

function toAsciiSlug(tokens: string[]): string {
  const joined = tokens.join('-');
  const ascii = stripDiacritics(joined).toLowerCase().replace(/[^a-z0-9-]+/g, '');
  return ascii.replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function englishSlug(name: string): string[] {
  const words = segmentWords(name, 'en').map(w => w.toLowerCase());
  const filtered = words.filter(w => w.length > 1 && !EN_STOPWORDS.has(w));
  const candidates: string[] = [];
  if (filtered.length > 0) candidates.push(toAsciiSlug(filtered.slice(0, 2)));
  if (filtered.length > 1) candidates.push(toAsciiSlug([filtered[0], filtered[filtered.length - 1]]));
  if (filtered.length > 0) candidates.push(filtered[0]);
  return candidates.filter(Boolean);
}

export function generateShortcutCandidates(name: string, tags: string[] = [], locales: string[] = []): string[] {
  const out: string[] = [];
  const locale = (locales && locales[0]) || (typeof navigator !== 'undefined' ? navigator.language : 'en');
  // Always provide ASCII-friendly candidates
  out.push(...englishSlug(name));
  // Add tag hints (lower priority)
  out.push(...(tags || []).slice(0, 2).map(t => toAsciiSlug([t.toString().toLowerCase()])));
  // Clean, dedupe, trim length
  const uniq = Array.from(new Set(out.map(s => s.replace(/^\//, '').toLowerCase()).filter(Boolean)));
  return uniq.map(s => s.slice(0, 16)).filter(s => s.length >= 2).slice(0, 5);
}

