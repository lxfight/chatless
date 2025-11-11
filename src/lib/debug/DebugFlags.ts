export type DebugCategory = 'events' | 'render' | 'store' | 'ui';

type RuntimeFlags = Partial<Record<DebugCategory, boolean>>;

// 代码级默认开关（不再依赖 window 控制）
const DEFAULT_FLAGS: Record<DebugCategory, boolean> = {
  events: true,   // 结构化事件（thinking/content/tool_call 摘要）
  store: true,    // segments/FSM 变更摘要
  ui: true,       // UI 组合段统计
  render: false,  // 保留为可选
};

let runtimeFlags: RuntimeFlags = {};

export function setRuntimeDebugFlags(flags: RuntimeFlags): void {
  // 允许在代码层（或测试注入）覆盖默认值
  runtimeFlags = { ...runtimeFlags, ...flags };
}

export function isDebugEnabled(category: DebugCategory): boolean {
  if (category in runtimeFlags) return !!runtimeFlags[category as DebugCategory];
  return DEFAULT_FLAGS[category];
}


