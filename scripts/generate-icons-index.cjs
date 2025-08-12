#!/usr/bin/env node
/*
  生成 public/llm-provider-icon/_index.json
  内容为该目录下的所有文件名（不含子目录），用于启动时快速建立“存在表”。
*/
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const ICON_DIR = path.join(ROOT, 'public', 'llm-provider-icon');
const OUT_FILE = path.join(ICON_DIR, '_index.json');

function main() {
  try {
    if (!fs.existsSync(ICON_DIR)) {
      console.warn('[generate-icons-index] dir not found:', ICON_DIR);
      return;
    }
    const files = fs.readdirSync(ICON_DIR).filter((f) => fs.statSync(path.join(ICON_DIR, f)).isFile());
    const data = { files };
    fs.writeFileSync(OUT_FILE, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`[generate-icons-index] wrote ${files.length} entries to ${path.relative(ROOT, OUT_FILE)}`);
  } catch (e) {
    console.error('[generate-icons-index] failed:', e);
    process.exitCode = 1;
  }
}

main();

