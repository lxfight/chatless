import { chat } from '@/lib/llm';
import type { Message } from '@/lib/llm/types';
import type { Conversation } from '@/types/chat';

export interface TitleGeneratorOptions {
  maxLength?: number; // 期望的最大长度（字符）
  language?: 'zh' | 'en';
  /**
   * 失败时的回退策略：
   * - 'trim'：使用用户消息裁剪作为标题
   * - 'none'：不做回退（返回空字符串，由调用方决定是否保持默认标题）
   */
  fallbackPolicy?: 'trim' | 'none';
}

/**
 * 规范化与裁剪标题，移除不需要的符号并限制长度
 */
export function normalizeTitle(raw: string, maxLength: number): string {
  if (!raw) return '';
  let title = String(raw).trim();

  // 若包含 JSON 形态的 {"title":"..."}，先直接提取值
  try {
    const jsonLike = title.match(/"title"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i);
    if (jsonLike && jsonLike[1]) {
      // 还原转义字符
      const unescaped = jsonLike[1].replace(/\\n/g, ' ').replace(/\\t/g, ' ').replace(/\\"/g, '"');
      title = unescaped;
    }
  } catch { /* ignore regex parse */ }

  // 去除 R1 等模型输出的思考标签与任意 HTML/XML 标签
  title = title.replace(/<think>[\s\S]*?<\/think>/gi, '');
  title = title.replace(/<[^>]+>/g, '');

  // 去除换行与多余空白
  title = title.replace(/\s+/g, ' ');

  // 去除包裹引号、句号、尾随标点与 emoji 等非常见符号
  title = title
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .replace(/[\r\n]/g, ' ')
    .replace(/[。！？!?,;；]+$/g, '')
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '');

  // 再次 trim
  title = title.trim();

  // 裁剪到最大长度
  if (title.length > maxLength) {
    title = title.slice(0, maxLength);
  }

  return title || '';
}

/**
 * 判断是否为默认会话标题（用于新建会话占位）
 */
export function isDefaultTitle(title: string | undefined | null): boolean {
  const t = (title || '').trim();
  // 注意：JS 的 \b 对中文不友好，使用 startsWith 判断更稳健
  return t.startsWith('新对话');
}

/**
 * 从会话中提取第一条用户消息内容，作为标题生成的种子
 */
export function extractFirstUserMessageSeed(conversation: Conversation | null | undefined): string {
  if (!conversation || !Array.isArray(conversation.messages)) return '';
  const msg = conversation.messages.find(m => m.role === 'user');
  return (msg?.content || '').trim();
}

/**
 * 是否在“首次助手回复完成后”触发标题生成：
 * - 当前标题仍为默认
 * - 对话中助手消息数量正好为 1（即首条回复刚完成）
 */
export function shouldGenerateTitleAfterAssistantComplete(conversation: Conversation | null | undefined): boolean {
  if (!conversation) return false;

  // 1) 仍为默认标题
  if (!isDefaultTitle(conversation.title)) return false;

  // 2) 至少已有一条助手回复（确保不是空会话）
  const assistantCount = conversation.messages?.filter(m => m.role === 'assistant').length ?? 0;
  if (assistantCount === 0) return false;

  // 3) 首条用户消息存在
  const firstSeed = extractFirstUserMessageSeed(conversation);
  return !!firstSeed;
}

/**
 * 构造用于标题生成的消息列表
 */
function buildTitlePromptMessages(content: string, opts: TitleGeneratorOptions): Message[] {
  const max = opts.maxLength ?? 24;
  const lang = opts.language ?? 'zh';

  // 严格格式：仅输出 JSON 对象 {"title":"..."}
  const system =
    lang === 'zh'
      ? `你是一个标题助手。请基于用户第一句消息生成一个会话标题。
严格遵循以下要求：
1) 仅输出一个 JSON 对象，格式严格为：{"title":"<标题>"}
2) 标题不超过${max}个字符，不含引号、句号、换行、表情或多余空白
3) 贴近用户原话关键词，避免过度概括
4) 不输出任何解释、前后缀、示例、思考过程或其它文本（包括 <think> 标签）
5) 直接给出 JSON，不要使用代码块标记，不要换行`
      : `You are a title assistant. Generate a title from the user's first message.
Follow these rules strictly:
1) Output ONLY a JSON object of the form {"title":"<title>"}
2) Title max ${max} chars, no quotes, punctuation, line breaks or emojis
3) Keep key phrases from the original message, avoid over-generalization
4) Do NOT output explanations, prefixes, suffixes, examples, or thoughts (including <think>)
5) Output JSON only, no code fences, no extra lines`;

  return [
    { role: 'system', content: system },
    { role: 'user', content },
  ];
}

/**
 * 使用当前 Provider/Model 基于第一条消息生成会话标题
 */
export async function generateTitleFromFirstMessage(
  provider: string,
  model: string,
  firstUserMessage: string,
  options: TitleGeneratorOptions = {}
): Promise<string> {
  const maxLength = options.maxLength ?? 24;
  try {
    console.log('[TitleGenerator] start', { provider, model, seedLength: (firstUserMessage || '').length, lang: options.language ?? 'zh' });
    const messages = buildTitlePromptMessages(firstUserMessage, { maxLength, language: options.language ?? 'zh' });
    const { content } = await chat(provider, model, messages, { temperature: 0.2 });
    console.debug('[TitleGenerator] 原始模型输出长度:', (content || '').length);
    console.debug('[TitleGenerator] 原始模型输出前200字:', String(content || '').slice(0, 200));
    // 尝试优先从结构化输出中解析
    const parsed = extractTitleFromOutput(content, maxLength);
    console.debug('[TitleGenerator] 解析后的标题:', parsed);
    if (parsed) return parsed;
    // 退化到通用清洗
    const normalized = normalizeTitle(content, maxLength);
    console.debug('[TitleGenerator] 清洗后的标题:', normalized);
    if (normalized) return normalized;
  } catch (e) {
    // 忽略错误，走降级
    console.warn('[TitleGenerator] 生成标题失败，使用降级策略：', e);
  }

  // 降级策略
  const policy = options.fallbackPolicy ?? 'none';
  if (policy === 'trim') {
    const fallback = normalizeTitle(firstUserMessage, maxLength);
    return fallback || '新对话';
  }
  // policy === 'none'：不改变标题，由调用方决定保留默认标题
  return '';
}

/**
 * 从模型输出解析标题，优先识别 JSON 或标签格式
 */
export function extractTitleFromOutput(raw: string, maxLength: number): string {
  if (!raw) return '';
  let text = String(raw).trim();

  // 去掉可能的代码块围栏，降低解析失败概率
  text = text.replace(/```[a-zA-Z]*\n([\s\S]*?)\n```/g, '$1');
  // 先移除 <think> 块，避免其中的花括号干扰 JSON 解析
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '');

  // 优先用正则在任意位置提取 \"title\" 字段（无需完整 JSON），成功即返回
  try {
    const m = text.match(/"title"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i);
    if (m && m[1]) {
      const unescaped = m[1]
        .replace(/\\n/g, ' ')
        .replace(/\\t/g, ' ')
        .replace(/\\"/g, '"');
      return normalizeTitle(unescaped, maxLength);
    }
  } catch { /* ignore regex parse */ }

  // 1) JSON 解析：{ "title": "..." }
  try {
    // 宽松提取 JSON：允许跨行与额外文本；优先匹配包含 "title" 的最短片段
    const idx = text.indexOf('{');
    const lastIdx = text.lastIndexOf('}');
    if (idx !== -1 && lastIdx !== -1 && lastIdx > idx) {
      const slice = text.slice(idx, lastIdx + 1);
      // 尝试逐步收缩到包含 "title" 的片段
      const titlePos = slice.toLowerCase().indexOf('"title"');
      if (titlePos !== -1) {
        // 从开头到第一个可能的结尾进行多次尝试
        for (let end = slice.length; end > titlePos + 7; end--) {
          const candidate = slice.slice(0, end);
          try {
            const obj = JSON.parse(candidate);
            if (obj && typeof obj.title === 'string') {
              return normalizeTitle(obj.title, maxLength);
            }
          } catch { /* ignore partial parse step */ }
        }
      }
      // 直接尝试整体解析
      try {
        const obj = JSON.parse(slice);
        if (obj && typeof obj.title === 'string') {
          return normalizeTitle(obj.title, maxLength);
        }
      } catch { /* ignore full parse step */ }
    }
  } catch { /* ignore json block outer */ }

  // 2) XML/HTML 标签：<title>...</title>
  const xmlMatch = text.match(/<title>([\s\S]*?)<\/title>/i);
  if (xmlMatch && xmlMatch[1]) {
    return normalizeTitle(xmlMatch[1], maxLength);
  }

  // 3) 形如“标题: xxx”或“Title: xxx”的行
  const line = text.split(/\r?\n/).find(l => /^(标题|Title)\s*[:：]/i.test(l));
  if (line) {
    const val = line.replace(/^(标题|Title)\s*[:：]/i, '');
    const norm = normalizeTitle(val, maxLength);
    if (norm) return norm;
  }

  return '';
}

