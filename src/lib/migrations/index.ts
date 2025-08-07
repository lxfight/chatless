import Database from "@tauri-apps/plugin-sql";
import { MigrationEngine } from './engine';
import { migrationRegistry } from './registry';
import { MigrationResult } from './types';

/**
 * 数据库迁移系统主入口
 * 提供简洁的迁移API
 */
export class DatabaseMigrator {
  private engine: MigrationEngine;

  constructor(database: Database) {
    this.engine = new MigrationEngine(database);
  }

  /**
   * 初始化迁移系统
   */
  async initialize(): Promise<void> {
    await this.engine.initialize();
  }

  /**
   * 执行迁移到最新版本
   */
  async migrate(): Promise<MigrationResult[]> {
    await this.initialize();
    
    const validation = migrationRegistry.validate();
    if (!validation.valid) {
      console.error('❌ 迁移脚本验证失败:');
      validation.errors.forEach(error => console.error(`  - ${error}`));
      throw new Error('迁移脚本验证失败');
    }

    const migrations = migrationRegistry.getAllMigrations();
    return await this.engine.migrateUp(migrations);
  }

  /**
   * 迁移到指定版本
   */
  async migrateTo(targetVersion: number): Promise<MigrationResult[]> {
    await this.initialize();
    
    const currentVersion = await this.engine.getCurrentVersion();
    const migrations = migrationRegistry.getAllMigrations();

    if (targetVersion > currentVersion) {
      // 向前迁移
      return await this.engine.migrateUp(migrations, targetVersion);
    } else if (targetVersion < currentVersion) {
      // 向后回滚
      return await this.engine.migrateDown(migrations, targetVersion);
    } else {
      console.log('数据库已是目标版本');
      return [];
    }
  }

  /**
   * 回滚到指定版本
   */
  async rollbackTo(targetVersion: number): Promise<MigrationResult[]> {
    await this.initialize();
    
    const migrations = migrationRegistry.getAllMigrations();
    return await this.engine.migrateDown(migrations, targetVersion);
  }

  /**
   * 获取当前数据库版本
   */
  async getCurrentVersion(): Promise<number> {
    await this.initialize();
    return await this.engine.getCurrentVersion();
  }

  /**
   * 获取迁移状态信息
   */
  async getStatus(): Promise<{
    currentVersion: number;
    latestVersion: number;
    pendingMigrations: number;
    executedMigrations: any[];
  }> {
    await this.initialize();
    
    const currentVersion = await this.engine.getCurrentVersion();
    const latestVersion = migrationRegistry.getLatestVersion();
    const executedMigrations = await this.engine.getExecutedMigrations();
    
    return {
      currentVersion,
      latestVersion,
      pendingMigrations: Math.max(0, latestVersion - currentVersion),
      executedMigrations
    };
  }

  /**
   * 列出所有迁移脚本
   */
  listMigrations(): void {
    migrationRegistry.listMigrations();
  }

  /**
   * 验证迁移脚本
   */
  validateMigrations(): { valid: boolean; errors: string[] } {
    return migrationRegistry.validate();
  }
}

/**
 * 便捷函数：执行数据库迁移
 */
export async function runDatabaseMigration(db: Database): Promise<void> {
  const migrator = new DatabaseMigrator(db);
  
  try {
    // 显示当前状态
    const status = await migrator.getStatus();
    console.log(`📊 数据库状态:`);
    console.log(`  当前版本: v${status.currentVersion}`);
    // 最新版本信息
    console.log(`  待执行迁移: ${status.pendingMigrations} 个`);
    
    if (status.pendingMigrations === 0) {
      console.log('数据库已是最新版本');
      return;
    }

    // 执行迁移
    const results = await migrator.migrate();
    
    // 显示结果
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    if (failCount === 0) {
      console.log(`🎉 迁移完成! 成功执行 ${successCount} 个迁移`);
    } else {
      console.error(`❌ 迁移部分失败: ${successCount} 成功, ${failCount} 失败`);
      throw new Error('数据库迁移失败');
    }
  } catch (error) {
    console.error('❌ 数据库迁移失败:', error);
    throw error;
  }
}

// 导出类型和工具
export * from './types';
export { MigrationEngine } from './engine';
export { migrationRegistry } from './registry';
export { sqlGenerator } from './sqlGenerator'; 