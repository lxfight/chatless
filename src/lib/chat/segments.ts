export type ToolCallStatus = 'running' | 'success' | 'error';

export interface TextSegment { kind: 'text'; text: string }
export interface ThinkSegment { kind: 'think'; text: string }
export interface ToolCardSegment {
  kind: 'toolCard';
  id: string;
  server: string;
  tool: string;
  status: ToolCallStatus;
  args?: Record<string, unknown>;
  resultPreview?: string;
  errorMessage?: string;
  schemaHint?: string;
  messageId: string;
}

export type MessageSegment = TextSegment | ThinkSegment | ToolCardSegment;

export function ensureTextTail(segments: MessageSegment[], initialText: string): MessageSegment[] {
  const out = [...segments];
  if (out.length === 0 || out[out.length - 1].kind !== 'text') {
    out.push({ kind: 'text', text: initialText });
  }
  return out;
}

export function appendText(segments: MessageSegment[], chunk: string): MessageSegment[] {
  if (!chunk) return segments;
  const out = [...segments];
  if (out.length === 0 || out[out.length - 1].kind !== 'text') {
    out.push({ kind: 'text', text: chunk });
  } else {
    (out[out.length - 1] as TextSegment).text = ((out[out.length - 1] as TextSegment).text || '') + chunk;
  }
  return out;
}

export function insertRunningCard(
  segments: MessageSegment[],
  card: Omit<ToolCardSegment, 'status'> & { status?: ToolCallStatus }
): MessageSegment[] {
  const out = [...segments];
  // 关键修复：必须带上 kind: 'toolCard'，否则上层统计与渲染将无法识别为卡片
  out.push({ kind: 'toolCard', ...card, status: 'running' } as ToolCardSegment);
  return out;
}

export function updateCardStatus(
  segments: MessageSegment[],
  match: { id?: string; server: string; tool: string },
  to: Partial<Pick<ToolCardSegment, 'status' | 'resultPreview' | 'errorMessage' | 'schemaHint'>>
): MessageSegment[] {
  return segments.map((s) => {
    if (s.kind !== 'toolCard') return s;
    const idOk = match.id ? s.id === match.id : true;
    if (idOk && s.server === match.server && s.tool === match.tool && s.status === 'running') {
      return { ...s, ...to } as ToolCardSegment;
    }
    return s;
  });
}

