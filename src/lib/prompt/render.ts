export function renderPromptContent(template: string, variableValues?: Record<string, string>): string {
  if (!template) return '';
  const vars = variableValues || {};
  const pattern = /\{\{\s*([a-zA-Z0-9_\-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^}]+)))?\s*\}\}/g;
  return template.replace(pattern, (_match, key: string, d1?: string, d2?: string, d3?: string) => {
    const provided = vars[key];
    const fallback = d1 ?? d2 ?? (d3 ? String(d3).trim() : undefined);
    return (provided ?? fallback ?? '').toString();
  });
}

