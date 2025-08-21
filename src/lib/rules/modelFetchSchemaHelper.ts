/**
 * 开发辅助模块：解析模型列表 Schema（低耦合、可单独演进）
 * 注意：这不是正式运行时功能，仅用于调试器快速代入表单字段。
 * - 输入：模型名（仅作为上下文标记）、schema 文本（OpenAPI 片段 / JSON 示例 / 文档片段）
 * - 输出：对调试器表单可用的建议字段
 */

export interface ModelFetchRuleSuggestion {
  endpointSuffix?: string;
  modelsArrayPath?: string;
  idPath?: string;
  labelPath?: string;
}

export async function suggestModelFetchRule(input: {
  model: string;
  schemaText: string;
}): Promise<ModelFetchRuleSuggestion | null> {
  try {
    const text = (input.schemaText || '').trim();
    if (!text) return null;

    // 1) 尝试直接解析为 JSON（当用户粘贴的是响应示例时）
    try {
      const json = JSON.parse(text);
      // 找到第一个数组
      const queue: Array<{ node: any; path: string }>= [{ node: json, path: '' }];
      let arrPath: string | undefined;
      while (queue.length) {
        const { node, path } = queue.shift()!;
        if (Array.isArray(node)) { arrPath = path.replace(/^\./,''); break; }
        if (node && typeof node === 'object') {
          for (const k of Object.keys(node)) {
            queue.push({ node: node[k], path: path ? `${path}.${k}` : k });
          }
        }
      }
      let idPath: string | undefined;
      let labelPath: string | undefined;
      if (arrPath) {
        const first = arrPath ? resolveByPath(json, arrPath)?.[0] : undefined;
        if (first && typeof first === 'object') {
          idPath = pickFirst(first, ['id','model','name']);
          labelPath = pickFirst(first, ['label','name','title']);
        }
      }
      return {
        modelsArrayPath: arrPath,
        idPath,
        labelPath,
      };
    } catch {}

    // 2) 粗略从 OpenAPI 文本中猜测
    const lower = text.toLowerCase();
    const candidates = ['/models','/v1/models','/model/list'];
    const endpointSuffix = candidates.find(c=>lower.includes(c)) as string | undefined;
    // 数组字段常见命名
    const arrayKeys = ['data','models','items','results'];
    const modelsArrayPath = arrayKeys.find(k=>new RegExp(`\\b${k}\\b`).test(lower));
    return { endpointSuffix, modelsArrayPath };
  } catch {
    return null;
  }
}

function resolveByPath(obj: any, path?: string) {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((acc: any, key: string) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

function pickFirst(o: any, keys: string[]): string | undefined {
  for (const k of keys) {
    if (o && Object.prototype.hasOwnProperty.call(o, k)) return k;
  }
  // 二级字段尝试
  for (const k1 of Object.keys(o||{})) {
    const child = o[k1];
    if (child && typeof child === 'object') {
      for (const k2 of keys) { if (Object.prototype.hasOwnProperty.call(child, k2)) return `${k1}.${k2}`; }
    }
  }
  return undefined;
}

