import { getAllConfiguredServers, getConnectedServers } from './chatIntegration';
import { getToolsCached } from './toolsCache';

export type InjectionResult = {
  systemMessages: Array<{ role: 'system'; content: string }>
};

type ProviderStrategy = {
  /**
   * 单条、严谨、双语合并的协议约束。必须简洁且稳定，避免“多条重复指令”。
   */
  buildProtocolMessage(): string;
  /**
   * 已启用的 server 的简短声明。用于给模型最小上下文。
   */
  buildEnabledServersLine(enabled: string[]): string | null;
  /**
   * 构造聚焦提示（仅 1 行），帮助模型优先选择目标 server 的最相关工具。
   */
  buildFocusedHint(): string | null;
};

const defaultStrategy: ProviderStrategy = {
  buildProtocolMessage() {
    return [
      'You can access external MCP tools (file system, knowledge, etc.).',
      'Call a tool ONLY when **all** conditions are met:',
      '1. The answer cannot be produced from your own knowledge.',
      '2. A listed MCP server clearly provides a tool that can solve the task.',
      '3. The user implicitly or explicitly requests actions like “list / read / search / execute / download / 上传 / 删除 / 目录”.',
      'If you decide to call, respond with one single line using EXACTLY this XML:',
      '<use_mcp_tool><server_name>S</server_name><tool_name>T</tool_name><arguments>{JSON}</arguments></use_mcp_tool>',
      'Never output anything outside the tag. 输出之外禁止任何文字。',
      'Wrong or unnecessary calls will be penalised. If no tool is required, answer normally.',
      'Examples:',
      'User: “列一下当前目录有哪些文件？” → <use_mcp_tool>...</use_mcp_tool>',
      'User: “黑洞是什么？” → 直接回答解释，无工具调用.'
    ].join(' ');
  },
  buildEnabledServersLine(enabled: string[]) {
    if (!enabled.length) return null;
    return `Enabled MCP servers: ${enabled.join(', ')}. Prefer tools from these servers.`;
  },
  buildFocusedHint() { return null; }
};

function getProviderStrategy(_provider?: string | null): ProviderStrategy {
  // 预留：可根据不同 provider 的个性化规则返回不同策略
  // 例如 deepseek/gemini/openai 做差异化表达、语言偏好或安全性要求
  return defaultStrategy;
}

export async function buildMcpSystemInjections(content: string, _currentConversationId?: string, providerName?: string): Promise<InjectionResult> {
  const sys: Array<{ role:'system'; content:string }> = [];
  const strategy = getProviderStrategy(providerName);

  // ---- 1. 粗粒度意图检测：无关问题则不注入任何 MCP 指令 ----
  const mentionLike = /@([a-zA-Z0-9_-]{1,64})/; // 显式 @mention
  const toolKeywords = /(文件|目录|列出|list\s|dir\s|ls\b|tool\b|mcp\b)/i;
  const needMcp = mentionLike.test(content) || toolKeywords.test(content);
  if (!needMcp) {
    return { systemMessages: [] }; // 不插入任何 MCP 指令
  }

  let enabled = await getConnectedServers();
  try {
    // 将 @mention 的 server 置前
    const mentionRe = /@([a-zA-Z0-9_-]{1,64})/g; const mentioned: string[] = []; let mm: RegExpExecArray | null;
    while ((mm = mentionRe.exec(content))) { const n = mm[1]; if (n && !mentioned.includes(n)) mentioned.push(n); }
    if (mentioned.length) {
      const all = await getAllConfiguredServers();
      const map = new Map(all.map(n => [n.toLowerCase(), n] as const));
      const filtered = mentioned.map(n => map.get(n.toLowerCase())).filter(Boolean) as string[];
      if (filtered.length) enabled = Array.from(new Set<string>([...filtered, ...enabled]));
    }
  } catch { /* ignore */ }

  // ---- 根据 @mention 精度控制工具清单 ----
  const TOOL_LIMIT = 8;
  const mentionRe = /@([a-zA-Z0-9_-]{1,64})/g;
  const mentioned: string[] = []; let mm: RegExpExecArray | null;
  while ((mm = mentionRe.exec(content))) { const n = mm[1]; if (n && !mentioned.includes(n)) mentioned.push(n); }

  const toolsLines: string[] = [];
  for (const server of enabled) {
    try {
      const tools = await getToolsCached(server);
      if (!Array.isArray(tools) || tools.length === 0) continue;
      const names = tools.map((t:any)=>t.name);
      const line = mentioned.includes(server)
        ? `Tools@${server}: ${names.join(', ')}`
        : `Tools@${server}: ${names.slice(0,TOOL_LIMIT).join(', ')}`;
      toolsLines.push(line);
    } catch { /* ignore */ }
  }
  for (const l of toolsLines) sys.push({ role: 'system', content: l });

  // 单条严格协议
  sys.push({ role: 'system', content: strategy.buildProtocolMessage() });

  // 简要的启用 server 行
  const serversLine = strategy.buildEnabledServersLine(enabled);
  if (serversLine) sys.push({ role: 'system', content: serversLine });

  // 移除强推工具的聚焦提示，避免过度引导

  return { systemMessages: sys };
}
