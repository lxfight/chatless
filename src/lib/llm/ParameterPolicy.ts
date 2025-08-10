/**
 * 参数策略引擎
 * - 通过 Provider 名称与模型 ID 的正则匹配，为请求选项注入/覆盖特定参数
 * - 便于预置厂商/模型的必要参数（如 Gemini 思考预算），并为后续用户自定义留出入口
 */

export type ParameterPatch = Record<string, any>;

export interface ParameterRule {
  id: string;
  description?: string;
  priority?: number; // 数值越大优先级越高
  provider?: RegExp; // 可选：按 Provider 名称匹配（不区分大小写时请在外部构造带 i 标志的正则）
  model?: RegExp; // 可选：按模型 ID 匹配
  apply: (base: ParameterPatch) => ParameterPatch; // 返回新对象或在拷贝上修改
}

function mergeDeep<T extends object, U extends object>(target: T, source: U): T & U {
  const output: any = Array.isArray(target) ? [...(target as any)] : { ...(target as any) };
  if (typeof source !== 'object' || source === null) return output as T & U;
  for (const [key, value] of Object.entries(source as any)) {
    if (Array.isArray(value)) {
      output[key] = value.slice();
    } else if (value && typeof value === 'object') {
      output[key] = mergeDeep(output[key] ?? {}, value);
    } else {
      output[key] = value;
    }
  }
  return output as T & U;
}

/** 预置规则集合（可按需扩展） */
const builtinRules: ParameterRule[] = [
  {
    id: 'google-gemini-thinking-required',
    priority: 100,
    description:
      '为需要思考模式或仅支持思考模式的 Gemini 系列模型注入非零思考预算，避免 Budget 0 错误',
    provider: /^(google\s*ai)$/i,
    // 兼容常见形态：gemini-2.5-pro、gemini-2.5-pro-latest、gemini-2.5-flash-thinking、gemini-1.5-pro-thinking 等
    model:
      /^(gemini-2\.5-(pro|flash-thinking)(?:-[a-z]+)?|gemini-1\.5-.*-thinking|gemini-2\.0-.*-thinking|.*-thinking)$/i,
    apply: (base) => {
      // 只注入思考预算；不强行设置 temperature/topP 等通用参数，避免用户未开启也被下发
      const patch: ParameterPatch = {
        generationConfig: {
          // 统一映射 maxTokens → maxOutputTokens（若用户显式设置才透传）
          ...(base?.maxOutputTokens || base?.maxTokens || base?.generationConfig?.maxOutputTokens
            ? { maxOutputTokens: base?.maxOutputTokens ?? base?.maxTokens ?? base?.generationConfig?.maxOutputTokens }
            : {}),
          ...(base?.stop || base?.generationConfig?.stopSequences
            ? { stopSequences: base?.stop ?? base?.generationConfig?.stopSequences }
            : {}),
          thinkingConfig: {
            // 仅当未设置或为 0 时，给出非零预算，避免 400 错误
            thinkingBudget:
              base?.generationConfig?.thinkingConfig?.thinkingBudget &&
              base?.generationConfig?.thinkingConfig?.thinkingBudget > 0
                ? base.generationConfig.thinkingConfig.thinkingBudget
                : 1024,
          },
        },
      };
      return mergeDeep(base, patch);
    },
  },
];

export class ParameterPolicyEngine {
  private static _builtin: ParameterRule[] = builtinRules.slice().sort((a, b) => (a.priority || 0) - (b.priority || 0));
  // 预留用户自定义规则通道（后续可从存储加载）
  private static _userRules: ParameterRule[] = [];

  /** 注册/替换用户规则集合（可用于未来的设置界面） */
  static setUserRules(rules: ParameterRule[]): void {
    ParameterPolicyEngine._userRules = (rules || []).slice().sort((a, b) => (a.priority || 0) - (b.priority || 0));
  }

  /** 按 provider/model 依次应用匹配的规则，后匹配可覆盖先前注入项（通过优先级调控顺序） */
  static apply(providerName: string, modelId: string, baseOptions: ParameterPatch = {}): ParameterPatch {
    const allRules = [...ParameterPolicyEngine._builtin, ...ParameterPolicyEngine._userRules];
    let merged: ParameterPatch = { ...(baseOptions || {}) };
    for (const rule of allRules) {
      const matchProvider = rule.provider ? rule.provider.test(providerName) : true;
      const matchModel = rule.model ? rule.model.test(modelId) : true;
      if (matchProvider && matchModel) {
        merged = rule.apply(merged) || merged;
      }
    }
    return merged;
  }
}

export type { ParameterRule };


