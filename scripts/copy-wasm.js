import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 源目录和目标目录
const sourceDir = path.join(__dirname, '../node_modules/onnxruntime-web/dist');
const targetDir = path.join(__dirname, '../public/wasm');

// 确保目标目录存在
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
  console.log('Created wasm directory:', targetDir);
}

// 要复制的文件扩展名
const extensionsToCopy = ['.wasm', '.mjs'];

try {
  const files = fs.readdirSync(sourceDir);
  let copiedCount = 0;

  files.forEach(file => {
    const ext = path.extname(file);
    if (extensionsToCopy.includes(ext)) {
      const sourcePath = path.join(sourceDir, file);
      const targetPath = path.join(targetDir, file);
      
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`Copied: ${file}`);
      copiedCount++;
    }
  });

  console.log(`\nTotal files copied: ${copiedCount}`);
  console.log('ONNX Runtime WASM files copied successfully!');
  
} catch (error) {
  console.error('Error copying WASM files:', error);
  process.exit(1);
} 