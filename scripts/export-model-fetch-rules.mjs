#!/usr/bin/env node
/**
 * 从 Tauri Store (model-fetch-debug.json) 导出 provider 的模型获取规则，
 * 并与现有的 src/config/modelFetchRules.ts 进行“按键合并”（增量覆盖）。
 *
 * - 仅覆盖调试存储中存在的 provider 规则键，其他既有规则保持不变；
 * - 便于多名协作者分别补充规则时避免相互覆盖丢失；
 * - 仅用于开发期导出，导出后建议人工校对并提交版本控制。
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

const ROOT = path.resolve(process.cwd());
const storePath = path.join(ROOT, 'src-tauri', 'target', 'debug', 'data', 'model-fetch-debug.json');
// 注意：Tauri Store 的实际物理位置与系统有关，上面路径可能不稳定。
// 为兼容常见情况，优先查找项目根目录下（如本地开发时复制出来）。
const localCopy = path.join(ROOT, 'model-fetch-debug.json');
const IDENTIFIER = 'com.kamjin.chatless';
// 推断各平台默认的 Tauri Store 目录
const HOME = os.homedir();
const winAppData = process.env.APPDATA || '';
const candidates = [
  localCopy,
  storePath,
  // Windows (%APPDATA% -> Roaming)
  winAppData ? path.join(winAppData, IDENTIFIER, 'model-fetch-debug.json') : null,
  // macOS
  HOME ? path.join(HOME, 'Library', 'Application Support', IDENTIFIER, 'model-fetch-debug.json') : null,
  // Linux
  HOME ? path.join(HOME, '.local', 'share', IDENTIFIER, 'model-fetch-debug.json') : null,
].filter(Boolean);

function tryReadJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return null; }
}

let data = {};
for (const p of candidates) {
  const obj = tryReadJSON(p);
  if (obj && typeof obj === 'object') { data = obj; break; }
}

const entries = Object.entries(data).filter(([k]) => k.endsWith('_fetch_rule'));
const rules = {};
for (const [key, value] of entries) {
  const name = key.replace(/_fetch_rule$/, '');
  const displayKey = String(name);
  rules[displayKey] = value;
}

// 读取现有的 TS 规则文件并解析出已存在的规则映射（若存在）
const dest = path.join(ROOT, 'src', 'config', 'modelFetchRules.ts');
let existing = {};
if (fs.existsSync(dest)) {
  try {
    const content = fs.readFileSync(dest, 'utf-8');
    // 提取由脚本生成的 JSON 对象文本
    const m = content.match(/export const MODEL_FETCH_RULES[^=]*=\s*([\s\S]*?);\s*$/m);
    if (m && m[1]) {
      // 优先尝试以 JS 方式解析，兼容注释与非引号键；失败再退回 JSON 解析
      try {
        // eslint-disable-next-line no-new-func
        existing = Function(`return (${m[1]})`)();
      } catch {
        existing = JSON.parse(m[1]);
      }
    }
  } catch {
    // 忽略解析失败，视为无现有规则
    existing = {};
  }
}

// 增量合并：仅覆盖调试存储中出现的键，其余键保持不变
const merged = { ...existing, ...rules };

const out = `/**
 * 由脚本自动导出生成。建议人工校对后提交。
 * 合并策略：仅覆盖本次导出中出现的 provider 规则键；未出现的键保持不变。
 */\n\nexport type ModelFetchRule = {\n  useV1?: boolean;\n  endpointSuffix?: string;\n  modelsArrayPath?: string;\n  idPath?: string;\n  labelPath?: string;\n  autoLabelFromId?: boolean;\n};\n\nexport const MODEL_FETCH_RULES: Record<string, ModelFetchRule> = ${JSON.stringify(merged, null, 2)};\n`;

fs.writeFileSync(dest, out, 'utf-8');
console.log(`✅ 导出完成（增量合并）: ${dest}`);

