import { ChatGateway } from './ChatGateway';
import type { Message } from '@/lib/llm/types';
import { extractTitleFromOutput, normalizeTitle } from './TitleGenerator';

export async function generateTitle(
  provider: string,
  model: string,
  seed: string,
  opts?: { maxLength?: number; language?: 'zh'|'en' }
): Promise<string> {
  const max = opts?.maxLength ?? 24;
  const lang = opts?.language ?? 'zh';
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

  const messages: Message[] = [
    { role: 'system', content: system },
    { role: 'user', content: seed },
  ];
  const gateway = new ChatGateway({ provider, model, options: { temperature: 0.2 } });
  const { content } = await gateway.chat(messages);
  const parsed = extractTitleFromOutput(content, max);
  return parsed || normalizeTitle(content, max);
}


