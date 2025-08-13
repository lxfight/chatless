/**
 * 统一数据库API
 * 这是数据库系统的主入口文件，提供了统一的API接口
 */

// 数据库核心模块
export { DatabaseManager, defaultDatabaseConfig } from './core/DatabaseManager';
export { DatabaseService } from './services/DatabaseService';

// 错误处理
export { 
  DatabaseError, 
  DatabaseErrorType, 
  DatabaseErrorAnalyzer 
} from './errors/DatabaseErrors';

// Repository模式
export { BaseRepository } from './repositories/BaseRepository';
export { ConversationRepository } from './repositories/ConversationRepository';
export { DocumentRepository } from './repositories/DocumentRepository';
export { KnowledgeBaseRepository } from './repositories/KnowledgeBaseRepository';
export { MessageRepository } from './repositories/MessageRepository';
export { PromptRepository } from './repositories/PromptRepository';

// 配置
export type { DatabaseConfig } from './core/DatabaseManager';

// 类型定义
export type { DatabaseTransaction } from './core/DatabaseManager';
export type { 
  QueryCondition,
  SortCondition,
  PaginationParams,
  PaginatedResult 
} from './repositories/BaseRepository';

/**
 * 创建标准的数据库实例
 * 这是推荐的创建数据库连接的方式
 */
export async function createDatabase(config?: Partial<import('./core/DatabaseManager').DatabaseConfig>): Promise<import('./core/DatabaseManager').DatabaseManager> {
  const { DatabaseManager, defaultDatabaseConfig } = await import('./core/DatabaseManager');
  
  const finalConfig = {
    ...defaultDatabaseConfig,
    ...config
  };

  const dbManager = new DatabaseManager(finalConfig);
  await dbManager.initialize();
  
  return dbManager;
}

import { getDefaultDatabaseConfig } from '../config/database';

/**
 * 快速数据库连接函数
 * 使用默认配置快速连接数据库
 */
export async function quickConnect(dbPath?: string): Promise<import('./core/DatabaseManager').DatabaseManager> {
  return createDatabase(getDefaultDatabaseConfig(dbPath));
}

/**
 * 数据库健康检查函数
 * 检查数据库连接和基本功能
 */
export async function healthCheck(dbManager: import('./core/DatabaseManager').DatabaseManager): Promise<{
  isHealthy: boolean;
  status: any;
  migrationStatus: any;
  errors: string[];
}> {
  const errors: string[] = [];
  
  try {
    // 检查数据库状态
    const status = await dbManager.getStatus();
    
    // 检查迁移状态
    const migrationManager = dbManager.getMigrationManager();
    const migrationStatus = await migrationManager.getStatus();
    
    // 基本健康检查：验证迁移状态
    if (migrationStatus.pendingMigrations > 0) {
      errors.push(`有 ${migrationStatus.pendingMigrations} 个待处理的迁移`);
    }

    return {
      isHealthy: errors.length === 0,
      status,
      migrationStatus,
      errors
    };
  } catch (error) {
    errors.push(`健康检查失败: ${error instanceof Error ? error.message : '未知错误'}`);
    
    return {
      isHealthy: false,
      status: null,
      migrationStatus: null,
      errors
    };
  }
}

/**
 * 数据库修复函数
 * 尝试自动修复常见的数据库问题
 */
export async function repairDatabase(dbManager: import('./core/DatabaseManager').DatabaseManager): Promise<{
  success: boolean;
  message: string;
  actionsPerformed: string[];
}> {
  const actionsPerformed: string[] = [];

  try {
    // 1. 检查并修复迁移状态
    const migrationManager = dbManager.getMigrationManager();
    const migrationStatus = await migrationManager.getStatus();
    
    // 新系统不需要检查旧版本系统类型

    // 2. 运行迁移
    if (migrationStatus.pendingMigrations > 0) {
      await migrationManager.migrate();
      actionsPerformed.push(`执行了 ${migrationStatus.pendingMigrations} 个待处理迁移`);
    }

    // 3. 验证迁移完成
    const finalStatus = await migrationManager.getStatus();
    if (finalStatus.pendingMigrations === 0) {
      actionsPerformed.push('所有迁移已成功执行');
    }

    return {
      success: true,
      message: '数据库修复完成',
      actionsPerformed
    };
  } catch (error) {
    actionsPerformed.push(`修复失败: ${error instanceof Error ? error.message : '未知错误'}`);
    
    return {
      success: false,
      message: '数据库修复失败',
      actionsPerformed
    };
  }
} 