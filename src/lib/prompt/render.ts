export function renderPromptContent(template: string, variableValues?: Record<string, string>): string {
  if (!template) return '';
  const vars = variableValues || {};
  // 允许中文等非 ASCII 变量名；兼容 {{key="default"}} / {{key='default'}} / {{key=默认}}
  const pattern = /\{\{\s*([^\s{}=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^}]+)))?\s*\}\}/gu;
  return template.replace(pattern, (_match, key: string, d1?: string, d2?: string, d3?: string) => {
    const provided = vars[key];
    const fallback = d1 ?? d2 ?? (d3 ? String(d3).trim() : undefined);
    return (provided ?? fallback ?? '').toString();
  });
}

