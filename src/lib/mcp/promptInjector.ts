import { getAllConfiguredServers, getConnectedServers, getGlobalEnabledServers } from './chatIntegration';
import { persistentCache } from './persistentCache';
import { MCPPrompts } from '@/lib/prompts/SystemPrompts';
import { WEB_SEARCH_SERVER_NAME } from '@/lib/mcp/nativeTools/webSearch';
import { WEB_SEARCH_TOOL_SCHEMA, WEB_FETCH_TOOL_SCHEMA } from '@/lib/mcp/nativeTools/webSearch';
import { useWebSearchStore } from '@/store/webSearchStore';

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
    return MCPPrompts.protocolRules;
  },
  buildEnabledServersLine(enabled: string[]) {
    return MCPPrompts.buildEnabledServersLine(enabled);
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

  // ---- 0. 时间上下文注入（优先级最高，确保LLM知道当前时间）----
  try {
    const { buildTimeContextMessage, isTimeRelatedQuery } = await import('@/lib/prompts/TimeContext');
    const isTimeRelated = isTimeRelatedQuery(content);
    // 如果是时间相关查询，强调搜索时使用当前时间
    const timeContextMsg = buildTimeContextMessage(isTimeRelated);
    sys.push({ role: 'system', content: timeContextMsg });
  } catch (e) {
    console.warn('[promptInjector] 时间上下文注入失败:', e);
  }

  // ---- 1. 粗粒度意图检测：无关问题则不注入任何 MCP 指令 ----
  const mentionLike = /@([a-zA-Z0-9_-]{1,64})/; // 显式 @mention
  const toolKeywords = /(文件|目录|列出|list\s|dir\s|ls\b|tool\b|mcp\b)/i;
  const needMcp = mentionLike.test(content) || toolKeywords.test(content);
  // 若启用了"网络搜索"，即使未匹配到关键词，也需要注入工具清单
  const webSearchEnabled = (() => {
    try { return !!useWebSearchStore.getState().isWebSearchEnabled; } catch { return false; }
  })();
  if (!needMcp && !webSearchEnabled) {
    // 即使不需要MCP，如果已经注入了时间上下文，也返回它
    return { systemMessages: sys };
  }

  // 仅使用“用户勾选+当前已连接”的交集，尊重用户设置
  const connected = await getConnectedServers();
  const globalEnabled = await getGlobalEnabledServers();
  let enabled = connected.filter((n) => globalEnabled.includes(n));
  try {
    // 将 @mention 的 server 置前
    const mentionRe = /@([a-zA-Z0-9_-]{1,64})/g; const mentioned: string[] = []; let mm: RegExpExecArray | null;
    while ((mm = mentionRe.exec(content))) { const n = mm[1]; if (n && !mentioned.includes(n)) mentioned.push(n); }
    if (mentioned.length) {
      const all = await getAllConfiguredServers();
      const map = new Map(all.map(n => [n.toLowerCase(), n] as const));
      // 只保留“用户勾选”的提及服务器
      const filtered = (mentioned
        .map(n => map.get(n.toLowerCase()))
        .filter(Boolean) as string[])
        .filter(n => globalEnabled.includes(n));
      if (filtered.length) enabled = Array.from(new Set<string>([...filtered, ...enabled]));
    }
  } catch { /* ignore */ }

  // ---- 根据 @mention 精度控制工具清单 ----
  const TOOL_LIMIT = 8;
  const DETAIL_LIMIT = 10; // 提供更丰富信息的工具数量上限（仅对 @mention 的 server）
  const SERVER_LIMIT_NO_MENTION = 3; // 未 @ 时展示的服务器上限
  const mentionRe = /@([a-zA-Z0-9_-]{1,64})/g;
  const mentioned: string[] = []; let mm: RegExpExecArray | null;
  while ((mm = mentionRe.exec(content))) { const n = mm[1]; if (n && !mentioned.includes(n)) mentioned.push(n); }

  // 构造系统提示
  const toolsLines: string[] = [];
  const detailLines: string[] = [];
  const combinedLines: string[] = [];

  if (mentioned.length > 0) {
    // 仅突出 @ 的服务器；其他服务器不再输出 Tools@ 行，降低噪音
    // 但必须是"已勾选"的服务器，未勾选则忽略（尊重用户设置）
    const mentionedEnabled = mentioned.filter(n => globalEnabled.includes(n));
    
    // 预连接被@mention的服务器，确保工具信息完整
    if (mentionedEnabled.length > 0) {
      console.log(`[MCP-Prompt] 检测到@mention服务器: ${mentionedEnabled.join(', ')}，开始预连接...`);
      try {
        await persistentCache.preconnectServers(mentionedEnabled);
      } catch (error) {
        console.warn('[MCP-Prompt] 预连接失败，继续使用现有逻辑:', error);
      }
    }
    
    for (const server of mentionedEnabled) {
      try {
        // 优先使用持久化缓存获取工具信息
        const tools = await persistentCache.getToolsWithCache(server);
        const names = Array.isArray(tools) ? tools.map((t:any)=>t?.name).filter(Boolean) : [];
        const listLine = names.length ? `Tools@${server}: ${names.join(', ')}` : `Tools@${server}: (connecting - 正在重连，可尝试调用工具)`;
        toolsLines.push(listLine);

        // 附加：对该 server 的前若干工具输出简要描述、必填项与“完整枚举”
        const subset = Array.isArray(tools) ? tools.slice(0, DETAIL_LIMIT) : [];
        if (subset.length) {
          detailLines.push(`ToolsDesc@${server}:`);
          for (const t of subset) {
            const nm = String(t?.name || '');
            const desc = t?.description ? String(t.description) : '';
            const schema: any = (t?.inputSchema?.schema || t?.inputSchema || t?.input_schema?.schema || t?.input_schema);
            const req: string[] = Array.isArray(schema?.required) ? schema.required : [];
            const props: Record<string, any> = schema?.properties || {};
            const allParamKeys = Object.keys(props);
            const optional = allParamKeys.filter(k => !req.includes(k));
            // 标题行：工具名 + 描述（不截断）
            detailLines.push(`• ${nm}${(desc ? ` - ${desc}` : '')}`);
            // 结构化的必填/可选
            detailLines.push(`   required: ${req.length ? req.join(', ') : '(none)'}`);
            if (optional.length) detailLines.push(`   optional: ${optional.join(', ')}`);

            try {
              // 全量枚举：对所有含 enum 的参数输出一行，列出全部枚举值
              for (const key of Object.keys(props)) {
                const p = props[key] || {};
                if (Array.isArray(p.enum) && p.enum.length) {
                  const vs = p.enum.map((v: any) => String(v)).join(' | ');
                  detailLines.push(`   - enum ${key}: ${vs}`);
                }
              }
              // 参数清单（完整）：名称、类型、是否必填、描述
              detailLines.push(`   params:`);
              for (const key of Object.keys(props)) {
                const p = props[key] || {};
                const tarr = Array.isArray(p.type) ? p.type : (p.type ? [p.type] : []);
                const alt = (p.anyOf || p.oneOf || []).map((x: any)=>x?.type).filter(Boolean);
                const types = (tarr.length ? tarr : alt.length ? alt : ['unknown']).join('|');
                const isReq = req.includes(key);
                const pdesc = p.description ? String(p.description) : '';
                detailLines.push(`     - ${key} (${types})${isReq ? ' [required]' : ''}${pdesc ? ` - ${pdesc}` : ''}`);
              }
              // 默认值（完整输出）
              for (const key of Object.keys(props)) {
                const p = props[key] || {};
                if (typeof p.default !== 'undefined') {
                  const dv = JSON.stringify(p.default);
                  detailLines.push(`   - default ${key}: ${dv}`);
                }
              }
            // 最小可行 JSON 示例：包含所有必填项，外加最多2个可选项
            const example = buildExampleFromSchema(schema, 2);
            if (example) {
              detailLines.push(`   - example: ${example}`);
            }
            } catch { /* ignore */ }
          }
        } else {
          // 连接中/未缓存：给出占位提示，并告知AI如何处理
          detailLines.push(`ToolsDesc@${server}: (connecting - 服务器正在重连中，稍等片刻后可直接尝试调用工具)`);
        }
      } catch { /* ignore */ }
    }

    // 额外注入：网络搜索工具（不依赖 MCP 连接）
    if (webSearchEnabled) {
      // 根据当前 provider 决定工具清单（ollama/duckduckgo: search + fetch；其他: search）
      let providerId = '';
      try {
        const s = useWebSearchStore.getState();
        providerId = _currentConversationId ? s.getConversationProvider(_currentConversationId) : s.provider;
      } catch { /* ignore */ }
      const toolNames = (providerId === 'ollama' || providerId === 'duckduckgo') ? 'search, fetch' : 'search';
      toolsLines.push(`Tools@${WEB_SEARCH_SERVER_NAME}: ${toolNames}`);
      try {
        // 为 web_search 提供完整 schema 描述，避免模型漏填必填参数
        const schema: any = (WEB_SEARCH_TOOL_SCHEMA as any)?.input_schema?.schema || (WEB_SEARCH_TOOL_SCHEMA as any)?.input_schema;
        const required: string[] = Array.isArray(schema?.required) ? schema.required : ['query'];
        const props: Record<string, any> = schema?.properties || { query: { type: 'string', description: '搜索关键词，例如 "东京今天的天气"' } };
        const allParamKeys = Object.keys(props);
        const optional = allParamKeys.filter(k => !required.includes(k));

        detailLines.push(`ToolsDesc@${WEB_SEARCH_SERVER_NAME}:`);
        detailLines.push(`• search - 在互联网上搜索实时信息（DuckDuckGo/Google/Bing/Ollama，根据设置选择）`);
        detailLines.push(`   required: ${required.join(', ') || '(none)'}`);
        if (optional.length) detailLines.push(`   optional: ${optional.join(', ')}`);
        detailLines.push(`   params:`);
        for (const key of Object.keys(props)) {
          const p = props[key] || {};
          const tarr = Array.isArray(p.type) ? p.type : (p.type ? [p.type] : []);
          const types = (tarr.length ? tarr : ['string']).join('|');
          const isReq = required.includes(key);
          const pdesc = p.description ? String(p.description) : '';
          detailLines.push(`     - ${key} (${types})${isReq ? ' [required]' : ''}${pdesc ? ` - ${pdesc}` : ''}`);
        }
        const example = (() => {
          try {
            return JSON.stringify({ query: '北京今天的天气' });
          } catch { return '{"query":"北京今天的天气"}'; }
        })();
        detailLines.push(`   - example: ${example}`);

        // ollama/duckduckgo 专属：补充 fetch 工具的简述
        if (providerId === 'ollama' || providerId === 'duckduckgo') {
          const fschema: any = (WEB_FETCH_TOOL_SCHEMA as any)?.input_schema?.schema || (WEB_FETCH_TOOL_SCHEMA as any)?.input_schema;
          const freq: string[] = Array.isArray(fschema?.required) ? fschema.required : ['url'];
          const fprops: Record<string, any> = fschema?.properties || { url: { type: 'string', description: '要抓取的网页地址（http/https）' } };
          const fetchNote = providerId === 'ollama' ? '依赖 Ollama Web Fetch API' : '直接 HTTP 抓取';
          detailLines.push(`• fetch - 抓取指定网页内容（返回标题/正文/链接），${fetchNote}`);
          detailLines.push(`   required: ${freq.join(', ')}`);
          detailLines.push(`   params:`);
          detailLines.push(`     - url (string) [required] - ${String(fprops?.url?.description || '网页地址')}`);
          detailLines.push(`   - example: {"url":"https://example.com"}`);
        }
      } catch { /* noop */ }
    }

    // 合并为单条，减少分段与截断
    combinedLines.push(...toolsLines);
    combinedLines.push(...detailLines);
    if (combinedLines.length) sys.push({ role: 'system', content: combinedLines.join('\n') });

    // 启用服务器行（突出 focus），并包含连接状态指导
    const hasConnecting = toolsLines.some(line => line.includes('connecting'));
    const focusLine = hasConnecting 
      ? `Enabled MCP servers: ${mentionedEnabled.join(', ')} (focused). 注意：如看到"connecting"状态，表示服务器正在重连，用户已授权，可直接调用相关工具，系统会自动处理连接。`
      : `Enabled MCP servers: ${mentionedEnabled.join(', ')} (focused).`;
    sys.push({ role: 'system', content: focusLine });
  } else {
    // 未 @：仅输出少量服务器的 Tools@，其余靠"Enabled servers"一行表达
    const serversShown = enabled.slice(0, SERVER_LIMIT_NO_MENTION);
    
    // 预连接前几个启用的服务器
    if (serversShown.length > 0) {
      try {
        await persistentCache.preconnectServers(serversShown);
      } catch (error) {
        console.debug('[MCP-Prompt] 预连接失败:', error);
      }
    }
    
    for (const server of serversShown) {
      try {
        const tools = await persistentCache.getToolsWithCache(server);
      if (!Array.isArray(tools) || tools.length === 0) continue;
        const names = tools.map((t:any)=>t?.name).filter(Boolean).slice(0, TOOL_LIMIT);
        if (names.length) toolsLines.push(`Tools@${server}: ${names.join(', ')}`);
    } catch { /* ignore */ }
  }
  // 额外注入：网络搜索工具（不依赖 MCP 连接）
  if (webSearchEnabled) {
    let providerId = '';
    try {
      const s = useWebSearchStore.getState();
      providerId = _currentConversationId ? s.getConversationProvider(_currentConversationId) : s.provider;
    } catch { /* ignore */ }
    const toolNames = (providerId === 'ollama' || providerId === 'duckduckgo') ? 'search, fetch' : 'search';
    toolsLines.push(`Tools@${WEB_SEARCH_SERVER_NAME}: ${toolNames}`);
    try {
      const schema: any = (WEB_SEARCH_TOOL_SCHEMA as any)?.input_schema?.schema || (WEB_SEARCH_TOOL_SCHEMA as any)?.input_schema;
      const required: string[] = Array.isArray(schema?.required) ? schema.required : ['query'];
      const pdesc = (schema?.properties?.query?.description ? ` - ${schema.properties.query.description}` : '');
      const descLines = [
        `ToolsDesc@${WEB_SEARCH_SERVER_NAME}:`,
        `• search - 在互联网上搜索实时信息`,
        `   ⚠️ 工具名必须是: search (不是 run_code, run, 或其他)`,
        `   required: ${required.join(', ')}`,
        `   params:`,
        `     - query (string) [required]${pdesc}`,
        `   - example: <use_mcp_tool><server_name>web_search</server_name><tool_name>search</tool_name><arguments>{"query":"北京今天的天气"}</arguments></use_mcp_tool>`
      ];
      for (const l of descLines) sys.push({ role: 'system', content: l });

      if (providerId === 'ollama' || providerId === 'duckduckgo') {
        const fschema: any = (WEB_FETCH_TOOL_SCHEMA as any)?.input_schema?.schema || (WEB_FETCH_TOOL_SCHEMA as any)?.input_schema;
        const freq: string[] = Array.isArray(fschema?.required) ? fschema.required : ['url'];
        const fdesc = (fschema?.properties?.url?.description ? ` - ${fschema.properties.url.description}` : '');
        const fetchTitle = '• fetch - 抓取指定网页内容（返回标题/正文/链接）';
        const fLines = [
          fetchTitle,
          `   ⚠️ 工具名必须是: fetch (不是 get, read, 或其他)`,
          `   required: ${freq.join(', ')}`,
          `   params:`,
          `     - url (string) [required]${fdesc}`,
          `   - example: <use_mcp_tool><server_name>web_search</server_name><tool_name>fetch</tool_name><arguments>{"url":"https://example.com"}</arguments></use_mcp_tool>`
        ];
        for (const l of fLines) sys.push({ role: 'system', content: l });
      }
    } catch { /* ignore */ }
  }
  for (const l of toolsLines) sys.push({ role: 'system', content: l });

  // 单条严格协议 + 工程化策略
  sys.push({ role: 'system', content: strategy.buildProtocolMessage() });
  try {
    const { MCPPrompts } = await import('@/lib/prompts/SystemPrompts');
    sys.push({ role: 'system', content: MCPPrompts.decisionPolicy });
    sys.push({ role: 'system', content: MCPPrompts.outputContract });
    sys.push({ role: 'system', content: MCPPrompts.argumentsPolicy });
    sys.push({ role: 'system', content: MCPPrompts.errorPolicy });
  } catch { /* noop */ }

  // 简要的启用 server 行（若启用网络搜索，把 web_search 一并告知）
  const enabledWithWeb = webSearchEnabled ? [...enabled, WEB_SEARCH_SERVER_NAME] : enabled;
  const serversLine = strategy.buildEnabledServersLine(enabledWithWeb);
  if (serversLine) sys.push({ role: 'system', content: serversLine });

  // 若开启网络搜索，追加联网检索策略，明确“何时使用 web_search”
  if (webSearchEnabled) {
    try {
      const { MCPPrompts } = await import('@/lib/prompts/SystemPrompts');
      sys.push({ role: 'system', content: MCPPrompts.webSearchPolicy });
    } catch { /* ignore */ }
  }
    return { systemMessages: sys };
  }

  // 单条严格协议（统一追加在末尾，保持一致） + 工程化策略
  sys.push({ role: 'system', content: strategy.buildProtocolMessage() });
  try {
    const { MCPPrompts } = await import('@/lib/prompts/SystemPrompts');
    sys.push({ role: 'system', content: MCPPrompts.decisionPolicy });
    sys.push({ role: 'system', content: MCPPrompts.outputContract });
    sys.push({ role: 'system', content: MCPPrompts.argumentsPolicy });
    sys.push({ role: 'system', content: MCPPrompts.errorPolicy });
  } catch { /* noop */ }

  // 情景化聚焦提示（极短一行，帮助模型做出第一步动作）- 动态解析，不写死 server_name
  try {
    const { buildContextualHints } = await import('@/lib/mcp/intent/IntentHintBuilder');
    const hints = await buildContextualHints(content);
    for (const h of hints) sys.push({ role: 'system', content: h });
  } catch { /* noop */ }

  return { systemMessages: sys };
}

function _trimText(text: string, max: number): string {
  if (!text) return '';
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

// 从 schema 生成“最小可行 arguments”示例：必填项 + 少量可选
function buildExampleFromSchema(schema: any, optionalLimit: number = 2): string | null {
  try {
    if (!schema || typeof schema !== 'object') return null;
    const props: Record<string, any> = schema.properties || {};
    const required: string[] = Array.isArray(schema.required) ? schema.required : [];
    const example: Record<string, any> = {};
    // 填充必填项
    for (const k of required) {
      const p = props[k] || {};
      example[k] = pickSampleForProp(p);
    }
    // 追加少量可选项
    let added = 0;
    for (const k of Object.keys(props)) {
      if (required.includes(k)) continue;
      if (added >= optionalLimit) break;
      const p = props[k] || {};
      example[k] = pickSampleForProp(p);
      added++;
    }
    return JSON.stringify(example);
  } catch { return null; }
}

function pickSampleForProp(p: any): any {
  if (typeof p?.default !== 'undefined') return p.default;
  const types = Array.isArray(p?.type) ? p.type : (p?.type ? [p.type] : []);
  const t = types[0] || (p?.anyOf?.[0]?.type) || (p?.oneOf?.[0]?.type) || 'string';
  if (Array.isArray(p?.enum) && p.enum.length) return p.enum[0];
  switch (t) {
    case 'number': return 0;
    case 'integer': return 0;
    case 'boolean': return false;
    case 'array': {
      const itemType = p?.items?.type || 'string';
      return [itemType === 'number' ? 0 : itemType === 'boolean' ? false : ''];
    }
    case 'object': return {};
    case 'string':
    default: return '';
  }
}
