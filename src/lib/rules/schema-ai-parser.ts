/**
 * 开发辅助模块：使用所选 Provider/Model 调用 AI 来解析 Schema
 * 注意：仅用于调试器表单的自动填充，不写入任何持久化状态。
 */

export interface AiParseSuggestion {
  endpointSuffix?: string;
  modelsArrayPath?: string;
  idPath?: string;
  labelPath?: string;
}

// 默认提示词：请模型从用户粘贴的 OpenAPI/JSON 文档片段中，提取我们需要的字段
export function buildSchemaParsePrompt(schemaText: string) {
  return `你是一个 API Schema 解析助手。给定 OpenAPI/JSON 示例或文档片段，请根据以下目标输出简单 JSON：\n\n目标：\n- 识别模型列表接口的相对路径（若能看出，给出如 /models 或 /v1/models；不确定可省略）\n- 识别模型列表所在的数组字段路径（点号语法，如 data 或 result.items）\n- 识别每个模型条目中的 ID 字段路径（点号语法，如 id 或 model 或 name）\n- 识别每个模型条目中的 名称 字段路径（可选，点号语法，如 label 或 name），如果没有可留空\n\n仅返回 JSON，不要包含额外说明。示例输出：\n{\n  "endpointSuffix": "/models",\n  "modelsArrayPath": "data",\n  "idPath": "id",\n  "labelPath": "name"\n}\n\n待解析文本：\n${schemaText}`;
}

export async function aiParseSchemaWithModel(provider: string, model: string, schemaText: string): Promise<AiParseSuggestion | null> {
  try {
    const { getInterpreter, initializeLLM } = await import('@/lib/llm');
    await initializeLLM();
    const inst = getInterpreter();
    if (!inst) return null;
    const prompt = buildSchemaParsePrompt(schemaText);
    const result = await inst.chat(provider, model, [{ role: 'user', content: prompt } as any], { temperature: 0 });
    const text = (result?.content || '').trim();
    try { return JSON.parse(text); } catch { return null; }
  } catch (e) {
    console.warn('[schema-ai-parser] 调用模型解析失败:', e);
    return null;
  }
}

