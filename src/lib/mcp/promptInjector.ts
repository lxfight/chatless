import { getAllConfiguredServers, getConnectedServers } from './chatIntegration';
import { getToolsCached } from './toolsCache';
import { MAX_TOOL_SIGNATURES, MAX_TOOL_SUMMARY_PER_SERVER } from './constants';

export type InjectionResult = {
  systemMessages: Array<{ role: 'system'; content: string }>
};

export async function buildMcpSystemInjections(content: string, currentConversationId?: string): Promise<InjectionResult> {
  const sys: Array<{ role:'system'; content:string }> = [];
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
  } catch {}

  if (enabled.length) {
    sys.push({ role:'system', content: `Available MCP servers for this conversation: ${enabled.join(', ')}. Use tools when helpful.` });
    sys.push({ role:'system', content: `Tool call protocol (text-mode): If a tool is needed, output ONLY <tool_call>{"type":"tool_call","server":"<server>","tool":"<tool>","parameters":{...}}</tool_call>. Strict rules: (1) <server> and <tool> MUST be selected from the catalogs below; DO NOT invent names. (2) Provide ONLY required keys unless explicitly asked. (3) Paths use forward slashes /. (4) Prefer @mentioned server; if uncertain, ask for the missing key instead of guessing.` });

    // 目录摘要（限时/限量）
    const summaries: string[] = [];
    for (const s of enabled) {
      try {
        const tools = await getToolsCached(s);
        if (Array.isArray(tools) && tools.length) {
          const names = tools.slice(0, MAX_TOOL_SUMMARY_PER_SERVER).map((t:any)=>t.name).join(', ');
          summaries.push(`${s}: [${names}${tools.length>MAX_TOOL_SUMMARY_PER_SERVER?'…':''}]`);
        }
      } catch {}
    }
    if (summaries.length) sys.push({ role:'system', content: `MCP tool catalog (subset): ${summaries.join(' ; ')}. Only choose tool names from this list.` });

    // 详细清单：为每个启用的 server 下发工具与必填参数（牺牲部分 token 以提高一次成功率）
    for (const s of enabled) {
      try {
        const tools = await getToolsCached(s);
        if (!Array.isArray(tools) || !tools.length) continue;
        const detail: string[] = [];
        for (const t of tools.slice(0, MAX_TOOL_SIGNATURES)) {
          const schema: any = (t.inputSchema || t.input_schema || {});
          const props: Record<string, any> = schema.properties || schema?.schema?.properties || {};
          const required: string[] = schema.required || schema?.schema?.required || [];
          const reqList = required.map(k => `${k}${props?.[k]?.type?`:${props[k].type}`:''}`).join(', ');
          const exampleKeys = required.map(k => `${JSON.stringify(k)}:${JSON.stringify(`<${k}>`)}`).join(', ');
          const example = `<tool_call>{"type":"tool_call","server":${JSON.stringify(s)},"tool":${JSON.stringify(t.name)},"parameters":{${exampleKeys}}}</tool_call>`;
          detail.push(`- ${t.name}${reqList?` (required: ${reqList})`:''}${t.description?` — ${t.description}`:''} | call: ${example}`);
        }
        if (detail.length) {
          sys.push({ role:'system', content: `Server ${s} tools (top ${Math.min(tools.length, MAX_TOOL_SIGNATURES)}):\n${detail.join('\n')}` });
        }
      } catch {}
    }

    // 精准提示：对首个目标 server 注入简短签名
    const target = enabled[0];
    try {
      const tools = await getToolsCached(target);
      if (Array.isArray(tools) && tools.length) {
        const brief = tools.slice(0, MAX_TOOL_SIGNATURES).map((t:any)=>{
          const schema = (t.inputSchema || t.input_schema || {}) as any;
          const req: string[] = schema.required || schema?.schema?.required || [];
          const reqStr = req.slice(0,3).join(', ');
          return `${t.name}${reqStr?`(required: ${reqStr})`:''}`;
        }).join(' ; ');
        sys.push({ role:'system', content: `Focused tool signatures for @${target}: ${brief}. Choose a tool from this list only. Provide ONLY required keys. If no tool fits, answer normally without a tool.` });
      }
    } catch {}
  }

  return { systemMessages: sys };
}
