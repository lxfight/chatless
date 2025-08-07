#!/usr/bin/env tsx

import { devCheckDatabase } from '../lib/__admin__/devTools';

/**
 * 开发环境数据库状态检查脚本
 * 使用方法: pnpm dev:db:check
 */

console.log("📊 启动数据库状态检查...");

devCheckDatabase()
.then(() => {
  console.log("\n数据库状态检查完成！");
  process.exit(0);
})
.catch((error) => {
  console.error("\n❌ 脚本执行失败:", error);
  process.exit(1);
}); 