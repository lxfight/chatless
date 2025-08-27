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
  buildFocusedHint(server: string, toolName: string, requiredKeys: string[]): string | null;
};

const defaultStrategy: ProviderStrategy = {
  buildProtocolMessage() {
    return [
      // 兼容两种严格协议：推荐 use_mcp_tool（XML 包 JSON），以及向后兼容的 <tool_call> 包裹 JSON
      'Tool call protocol (strict). Prefer the following format and output ONLY inside tags:',
      '<use_mcp_tool><server_name>...</server_name><tool_name>...</tool_name><arguments>{...}</arguments></use_mcp_tool>',
      'Do NOT output plain JSON. Do NOT add any text outside tags. 禁止标签外任何文字；仅输出以上 XML。'
    ].join(' ');
  },
  buildEnabledServersLine(enabled: string[]) {
    if (!enabled.length) return null;
    return `Enabled MCP servers: ${enabled.join(', ')}. Prefer tools from these servers.`;
  },
  buildFocusedHint(server: string, toolName: string, requiredKeys: string[]) {
    if (!server || !toolName) return null;
    const req = requiredKeys && requiredKeys.length ? `(required: ${requiredKeys.slice(0,3).join(', ')})` : '';
    return `Focused hint: server ${server} → ${toolName}${req}.`;
  }
};

function getProviderStrategy(_provider?: string | null): ProviderStrategy {
  // 预留：可根据不同 provider 的个性化规则返回不同策略
  // 例如 deepseek/gemini/openai 做差异化表达、语言偏好或安全性要求
  return defaultStrategy;
}

export async function buildMcpSystemInjections(content: string, _currentConversationId?: string, providerName?: string): Promise<InjectionResult> {
  const sys: Array<{ role:'system'; content:string }> = [];
  const strategy = getProviderStrategy(providerName);
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

  // 单条严格协议
  sys.push({ role: 'system', content: strategy.buildProtocolMessage() });

  // 简要的启用 server 行
  const serversLine = strategy.buildEnabledServersLine(enabled);
  if (serversLine) sys.push({ role: 'system', content: serversLine });

  // 选取一个“最可能”的 server + 工具做一行聚焦提示
  if (enabled.length) {
    const target = enabled[0];
    try {
      const tools = await getToolsCached(target);
      if (Array.isArray(tools) && tools.length) {
        // 轻量评分，倾向包含 list/dir/ls 的工具
        const score = (t:any) => {
          const name = String(t?.name||'').toLowerCase();
          const desc = String(t?.description||'').toLowerCase();
          let s = 0; const kws = ['list','dir','ls','files','目录','列出'];
          for (const k of kws) if (name.includes(k) || desc.includes(k)) s += 2;
          if (/(@filesystem|filesystem)/i.test(content) && /(列出|目录|list|dir|ls)/i.test(content)) if (/list|dir|ls/.test(name)) s += 3;
          return s;
        };
        const best = [...tools].sort((a:any,b:any)=>score(b)-score(a))[0];
        if (best) {
          const schema: any = (best.inputSchema || best.input_schema || {});
          const required: string[] = schema.required || schema?.schema?.required || [];
          const hint = strategy.buildFocusedHint(target, best.name, required || []);
          if (hint) sys.push({ role: 'system', content: hint });
        }
      }
    } catch { /* ignore */ }
  }

  return { systemMessages: sys };
}
