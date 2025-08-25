export const LIST_TOOLS_TTL_MS = 60_000; // 1min 缓存，降低重复 listTools 开销
export const LIST_TOOLS_TIMEOUT_MS = 1_200; // 单次 listTools 超时，保障流畅
export const MAX_TOOL_SIGNATURES = 6;
export const MAX_TOOL_SUMMARY_PER_SERVER = 8;
export const MAX_TOOL_RECURSION_DEPTH = 2; // 默认 2 次，满足多步链路
export const CALL_TOOL_TIMEOUT_MS = 15000; // 单次工具调用超时
