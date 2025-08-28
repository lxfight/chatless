import { getToolsCached } from './toolsCache';

export async function buildSchemaHint(server: string, tool: string): Promise<string> {
  try {
    const tools = await getToolsCached(server);
    const meta = Array.isArray(tools) ? tools.find((t:any)=> t?.name === tool) : null;
    const schema = meta?.inputSchema || meta?.input_schema;
    if (schema && typeof schema === 'object') {
      const props = schema.properties || schema?.schema?.properties || {};
      const required: string[] = schema.required || schema?.schema?.required || [];
      const pick = Object.keys(props).slice(0, 3);
      const sample: any = {};
      for (const k of pick) {
        const p: any = (props)[k] || {};
        const t = Array.isArray(p?.type) ? p.type[0] : (p?.type || 'string');
        sample[k] = t === 'number' || t === 'integer' ? 0 : t === 'boolean' ? false : t === 'array' ? [] : '';
      }
      const requiredStr = required.length ? `Required: ${required.join(', ')}` : '';
      return `请按如下 JSON 重试（仅示例，注意必填项）：\n${JSON.stringify(sample)}\n${requiredStr}`;
    }
  } catch {}
  return '';
}
