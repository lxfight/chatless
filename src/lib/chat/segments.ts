export type ToolCallStatus = 'running' | 'success' | 'error' | 'pending_auth';

export interface TextSegment { kind: 'text'; text: string }
export interface ThinkSegment { 
  kind: 'think'; 
  text: string;
  startTime?: number; // 开始时间戳（毫秒）
  duration?: number; // 思考时长（秒）
}
export interface ImageSegment { kind: 'image'; mimeType: string; data: string }
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

export type MessageSegment = TextSegment | ThinkSegment | ImageSegment | ToolCardSegment;

export function ensureTextTail(segments: MessageSegment[], initialText: string): MessageSegment[] {
  const out = [...segments];
  if (out.length === 0 || out[out.length - 1].kind !== 'text') {
    out.push({ kind: 'text', text: initialText });
  }
  return out;
}

export function appendText(segments: MessageSegment[], chunk: string): MessageSegment[] {
  if (!chunk) return segments;
  
  // 过滤掉工具调用标记，这些内容应该只在ToolCallCard中渲染
  const filtered = filterToolCallContent(chunk);
  if (!filtered) return segments;
  
  const out = [...segments];
  if (out.length === 0 || out[out.length - 1].kind !== 'text') {
    out.push({ kind: 'text', text: filtered });
  } else {
    (out[out.length - 1] as TextSegment).text = ((out[out.length - 1] as TextSegment).text || '') + filtered;
  }
  return out;
}

/**
 * 过滤掉工具调用标记，这些内容应该只在ToolCallCard中渲染
 */
function filterToolCallContent(text: string): string {
  if (!text) return '';
  
  // 移除包含 __tool_call_card__ 的 JSON 对象
  const filtered = text.replace(/\{[^}]*"__tool_call_card__"[^}]*\}/g, '');
  
  // 不要修改换行符！保留原始markdown格式
  // 注意：之前的 replace(/\n\n+/g, '\n\n').trim() 会破坏markdown格式
  
  return filtered;
}

export function appendThinkText(segments: MessageSegment[], chunk: string): MessageSegment[] {
  if (!chunk) return segments;
  const out = [...segments];
  if (out.length === 0 || out[out.length - 1].kind !== 'think') {
    // 创建新的think段，记录开始时间
    out.push({ kind: 'think', text: chunk, startTime: Date.now() });
  } else {
    // 追加到现有think段
    (out[out.length - 1] as ThinkSegment).text = ((out[out.length - 1] as ThinkSegment).text || '') + chunk;
  }
  return out;
}

/**
 * 完成最后一个think段，记录其持续时长
 */
export function finishLastThink(segments: MessageSegment[]): MessageSegment[] {
  if (segments.length === 0) return segments;
  const out = [...segments];
  const last = out[out.length - 1];
  if (last.kind === 'think' && last.startTime && !last.duration) {
    const durationMs = Date.now() - last.startTime;
    (out[out.length - 1] as ThinkSegment).duration = Math.round(durationMs / 100) / 10; // 保留1位小数的秒数
  }
  return out;
}

export function insertRunningCard(
  segments: MessageSegment[],
  card: Omit<ToolCardSegment, 'status'> & { status?: ToolCallStatus }
): MessageSegment[] {
  const out = [...segments];
  
  // 防止重复：检查是否已存在相同ID的卡片
  const existingCardIndex = out.findIndex(s => 
    s.kind === 'toolCard' && 
    s.id === card.id
  );
  
  if (existingCardIndex !== -1) {
    console.warn(`[insertRunningCard] 卡片 ${card.id} 已存在，跳过插入`);
    return out;
  }
  
  // 关键修复：必须带上 kind: 'toolCard'，否则上层统计与渲染将无法识别为卡片
  //@ts-expect-error  必须忽略ts的类型检查，否则会报错
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
    // 允许更新 running 或 pending_auth 状态的卡片
    if (idOk && s.server === match.server && s.tool === match.tool && (s.status === 'running' || s.status === 'pending_auth')) {
      // 特殊处理：如果 errorMessage 是 'pending_auth'，状态应该是 'pending_auth' 而不是 'error'
      if (to.errorMessage === 'pending_auth') {
        return { ...s, status: 'pending_auth', errorMessage: to.errorMessage } as ToolCardSegment;
      }
      return { ...s, ...to } as ToolCardSegment;
    }
    return s;
  });
}

