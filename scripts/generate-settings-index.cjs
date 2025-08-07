const fs = require('fs');
const path = require('path');

// 源 JSON 配置
const sourcePath = path.resolve(__dirname, '../src/config/settingsIndex.json');
// 目标 TS 文件
const targetPath = path.resolve(__dirname, '../src/config/settingsIndex.ts');

if (!fs.existsSync(sourcePath)) {
  console.error('❌ 未找到 settingsIndex.json, 请先创建或检查路径');
  process.exit(1);
}

const raw = fs.readFileSync(sourcePath, 'utf-8');
let data;
try {
  data = JSON.parse(raw);
} catch (err) {
  console.error('❌ settingsIndex.json 解析失败:', err);
  process.exit(1);
}

const header = `// 自动生成文件，请勿手动修改。\n// 由 scripts/generate-settings-index.cjs 根据 src/config/settingsIndex.json 生成。\n\nexport interface SettingEntry {\n  id: string;\n  tab: string;\n  i18nKey: string;\n  anchor: string;\n  keywords?: string[];\n}\n\nexport const settingsIndex: SettingEntry[] = `;

const content = header + JSON.stringify(data, null, 2) + ' as const;\n';

fs.writeFileSync(targetPath, content, 'utf-8');
console.log('生成 settingsIndex.ts 成功'); 