import { INTENT_RULES, type IntentRule } from './IntentCatalog';
import { persistentCache } from '@/lib/mcp/persistentCache';
import { getConnectedServers, getGlobalEnabledServers } from '@/lib/mcp/chatIntegration';

/**
 * 在“已启用 ∩ 已连接”的服务器里解析：哪些 server 支持某个 toolName
 */
async function resolveServersByTool(toolName: string): Promise<string[]> {
  const connected = await getConnectedServers();
  const enabled = await getGlobalEnabledServers();
  const candidates = connected.filter((n) => enabled.includes(n));
  const matched: string[] = [];
  for (const server of candidates) {
    try {
      const tools = await persistentCache.getToolsWithCache(server);
      if (Array.isArray(tools) && tools.some((t:any)=> String(t?.name || '').toLowerCase() === toolName.toLowerCase())) {
        matched.push(server);
      }
    } catch { /* ignore */ }
  }
  return matched;
}

function matchRule(content: string, rule: IntentRule): boolean {
  for (const m of rule.matchers) {
    if (m.type === 'regex') {
      if (!m.pattern.test(content)) return false;
    } else if (m.type === 'anyOf') {
      if (!m.patterns.some(p => p.test(content))) return false;
    }
  }
  return true;
}

/**
 * 构建情景化提示行（不写死 server 名）
 * 返回若干 system 行，用于追加到注入提示中
 */
export async function buildContextualHints(content: string): Promise<string[]> {
  const lines: string[] = [];
  if (!content || !content.trim()) return lines;
  for (const rule of INTENT_RULES) {
    if (!matchRule(content, rule)) continue;
    // 逐个候选工具解析当前环境中能用的 server
    for (const cand of rule.toolCandidates) {
      const servers = await resolveServersByTool(cand.toolName);
      if (servers.length === 0) continue;
      // 构造 1 行最小提示，枚举可用 server（运行时解析，非写死）
      const sv = servers.length > 3 ? `${servers.slice(0,3).join(', ')}(+${servers.length-3} more)` : servers.join(', ');
      lines.push(
        `若需要“${cand.label || cand.toolName}”，可使用以下任一已启用Server: ${sv}。` +
        ` 推荐的调用：<use_mcp_tool><server_name><从上面任选其一></server_name><tool_name>${cand.toolName}</tool_name><arguments>${cand.argumentTemplate}</arguments></use_mcp_tool>`
      );
      // 每条规则只给一个最佳候选行即可，避免过长
      break;
    }
    // 如果没有任何候选工具匹配到可用 server，也至少给出通用 hint
    if (!lines.some(l => l.includes(rule.id))) {
      lines.push(rule.hint);
    }
  }
  return lines;
}


