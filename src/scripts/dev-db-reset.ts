#!/usr/bin/env tsx

import { devResetDatabase } from '../lib/__admin__/devTools';

/**
 * 开发环境数据库一键重置脚本
 * 使用方法: pnpm dev:db:reset
 */

console.log("🚀 启动开发环境数据库重置...");

devResetDatabase({ 
  withTestData: false, 
  verbose: true 
})
.then((success) => {
  if (success) {
    console.log("\n数据库重置成功完成！");
    console.log("💡 现在可以重新启动应用使用全新数据库");
    process.exit(0);
  } else {
    console.log("\n❌ 数据库重置失败！");
    process.exit(1);
  }
})
.catch((error) => {
  console.error("\n❌ 脚本执行失败:", error);
  process.exit(1);
}); 