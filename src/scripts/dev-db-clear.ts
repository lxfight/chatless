#!/usr/bin/env tsx

import { devClearData } from '../lib/__admin__/devTools';

/**
 * 开发环境数据清理脚本（保留表结构）
 * 使用方法: pnpm dev:db:clear
 */

console.log("🧹 启动开发环境数据清理...");

devClearData(true)
.then((success) => {
  if (success) {
    console.log("\n数据清理成功完成！");
    console.log("💡 表结构已保留，只清理了数据");
    process.exit(0);
  } else {
    console.log("\n❌ 数据清理失败！");
    process.exit(1);
  }
})
.catch((error) => {
  console.error("\n❌ 脚本执行失败:", error);
  process.exit(1);
}); 