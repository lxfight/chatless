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
  
  const out = [...segments];
  
  // 获取或创建最后一个text segment
  let lastText = '';
  if (out.length === 0 || out[out.length - 1].kind !== 'text') {
    // 创建新的text segment
    out.push({ kind: 'text', text: '' });
  }
  
  // 累积文本：先追加新chunk到原始文本
  const lastSegment = out[out.length - 1] as TextSegment;
  lastText = (lastSegment.text || '') + chunk;
  
  // 🔑 关键修复：对整个累积的文本进行过滤
  // 这样可以确保未完成的工具调用指令片段被实时移除
  const filtered = filterToolCallContent(lastText);
  
  // 更新text segment的内容为过滤后的文本
  lastSegment.text = filtered;
  
  return out;
}

/**
 * 统一的内容过滤器（Segments层的核心职责）
 * 
 * ## 职责
 * 
 * 过滤掉所有不应该在UI中显示的内容：
 * - 完整的工具调用指令块
 * - 未完成的工具调用指令片段（流式场景的关键）
 * - JSON格式的工具调用
 * - 内部工具卡片标记
 * 
 * ## 设计原则
 * 
 * 1. **单一职责**: 这是segments层唯一的过滤入口
 * 2. **同步执行**: 不依赖动态导入，确保性能
 * 3. **保留格式**: 不修改markdown格式、换行符等
 * 
 * ## 使用场景
 * 
 * - `appendText`: 追加文本时过滤
 * - 外部模块: 需要过滤工具调用指令时使用
 * 
 * @param text 要过滤的原始文本
 * @returns 过滤后的文本
 */
export function filterToolCallContent(text: string): string {
  if (!text) return '';
  
  let out = text;
  
  // 1) 移除内部注入的不可见JSON标记
  out = out.replace(/\{[^}]*"__tool_call_card__"[^}]*\}/g, '');
  
  // 2) 移除完整的工具调用指令块（XML 风格）
  out = out.replace(/<use_mcp_tool>[\s\S]*?<\/use_mcp_tool>/gi, '');
  out = out.replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '');
  
  // 2.1) 移除 GPT‑OSS 风格的工具调用指令
  //      形如：<|channel|>commentary to=server[.tool] <|constrain|>json<|message|>{...}
  out = out.replace(
    /<\|channel\|\>\s*commentary[\s\S]*?<\|message\|\>\s*\{[\s\S]*?\}/gi,
    ''
  );
  //      无标签变体：commentary to=server[.tool] json {...}
  out = out.replace(/commentary\s+to=[^\n]+?\s+json\s*\{[\s\S]*?\}/gi, '');
  //      极简变体：to=server[.tool] {...}
  out = out.replace(/(?:^|\s)to\s*=\s*[a-z0-9_.-]+\s*\{[\s\S]*?\}/gi, '');
  
  // 3) 移除JSON格式的工具调用（包含 "type":"tool_call"）
  out = out.replace(/\{[\s\S]*?"type"\s*:\s*"tool_call"[\s\S]*?\}/gi, '');
  
  // 4) 关键：移除未完成的指令片段（流式输出场景）
  // 这是防止用户看到指令文本的核心逻辑
  out = out.replace(/<use_mcp_tool>[\s\S]*$/i, '');
  out = out.replace(/<tool_call>[\s\S]*$/i, '');
  // 4.1) GPT‑OSS 风格的未完成残片
  out = out.replace(/<\|channel\|\>\s*commentary[\s\S]*$/i, '');
  out = out.replace(/commentary\s+to=[^\n]*$/i, '');
  // 4.1.1) 极简残片：以 "to=" 开头但未闭合 JSON
  out = out.replace(/(?:^|\s)to\s*=\s*[a-z0-9_.-]+\s*\{?$/i, '');
  // 清理单独残留的约束/消息标签
  out = out.replace(/<\|constrain\|\>\s*json/gi, '');
  out = out.replace(/<\|message\|\>/gi, '');

  // 4.1) 进一步清除指令残片（当起始标签已被截断时）
  // 情况：我们在之前的render周期已经把 `<use_mcp_tool>...` 起始处及其后续内容清空，
  // 接下来流入的token可能是 `</server_name><tool_name>...` 这类“无起始标签”的尾部残片。
  // 策略：当文本中不存在 `<use_mcp_tool>`/`<tool_call>` 起始标签，但出现了与工具指令相关的标签名时，
  // 从最近一次出现这些标签名的位置开始截断，避免任何残片进入UI。
  const hasStartTag = /<use_mcp_tool|<tool_call/i.test(out);
  if (!hasStartTag) {
    const residualMarkers = [
      'server_name', 'tool_name', 'arguments',
      '</server_name', '</tool_name', '</arguments',
      '<server_name', '<tool_name', '<arguments',
      'use_mcp_tool', 'tool_call'
    ];
    let residualIndex = -1;
    for (const marker of residualMarkers) {
      const idx = out.lastIndexOf(marker);
      if (idx > residualIndex) residualIndex = idx;
    }
    // 仅当残片出现在文本靠近尾部时才截断，防止误伤
    if (residualIndex !== -1 && residualIndex >= out.length - 80) {
      out = out.substring(0, residualIndex);
    }
  }

  // 4.2) 清理不完整的标签前缀（逐字符输出时常见）
  // 例如："<use", "<use_mcp_t", "</ser", "<tool_" 等落在文本尾部的半截标签
  const incompletePrefixes = [
    '<use_mcp_tool', '<tool_call', '</use_mcp_tool', '</tool_call',
    '<server_name', '</server_name', '<tool_name', '</tool_name',
    '<arguments', '</arguments', '</think', '<think'
  ];
  for (const tag of incompletePrefixes) {
    // 如果文本以该tag的任意前缀结尾，则移除该前缀，避免闪烁
    for (let len = tag.length; len > 0; len--) {
      const prefix = tag.substring(0, len);
      if (out.endsWith(prefix)) {
        out = out.slice(0, -prefix.length);
        break;
      }
    }
  }
  
  // 保留原始markdown格式和换行符
  
  return out;
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

