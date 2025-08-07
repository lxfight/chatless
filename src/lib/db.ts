import Database from "@tauri-apps/plugin-sql";
import { canUseTauriAPI, getEnvironmentDetails } from './utils/environment';
import { DatabaseService } from './database/services/DatabaseService';
import { DATABASE_CONFIG } from './config/database';
import { startupMonitor } from './utils/startupPerformanceMonitor';

/**
 * 初始化数据库服务系统
 * 这是新的推荐初始化方法
 */
export async function initDatabaseService(): Promise<void> {
  // 检查环境
  if (!canUseTauriAPI()) {
    const envDetails = getEnvironmentDetails();
    const envType = envDetails.isTauri ? 'Tauri' : 'Browser';
    console.warn(`⚠️ [DB-INIT] 跳过数据库初始化，当前环境: ${envType} (Node: ${envDetails.nodeEnv})`);
    return;
  }

  console.log('🔧 [APP-START] 初始化数据库服务系统...');
  const startTime = Date.now();
  
  try {
    // 只使用一个阶段来监控整个数据库初始化过程
    startupMonitor.startPhase('数据库初始化');
    
    // 获取数据库服务实例并初始化
    const databaseService = DatabaseService.getInstance();
    await databaseService.initialize(DATABASE_CONFIG.MAIN_DATABASE);
    
    startupMonitor.endPhase('数据库初始化');
    
    const initTime = Date.now() - startTime;
    console.log(`[APP-START] 数据库服务系统初始化成功 (${initTime}ms)`);
  } catch (error) {
    startupMonitor.endPhase('数据库初始化');
    
    const initTime = Date.now() - startTime;
    console.error(`❌ [APP-START] 数据库服务系统初始化失败 (${initTime}ms):`, error);
    throw error;
  }
}

/**
 * 获取数据库服务实例
 * 推荐使用此方法获取数据库访问接口
 */
export function getDatabaseService() {
  return DatabaseService.getInstance();
}

// ============ Legacy API（向后兼容，将在未来版本中移除）============

/**
 * @deprecated 使用 getDatabaseService().getDbManager().getDatabase() 替代
 */
export async function getSafeDb(): Promise<Database> {
  console.warn('⚠️ [LEGACY] getSafeDb() 已弃用');
  
  if (!canUseTauriAPI()) {
    throw new Error('数据库操作仅在Tauri应用中可用');
  }

  return DatabaseService.getInstance().getDbManager().getDatabase();
}

/**
 * @deprecated 使用 initDatabaseService() 替代
 */
export async function initializeDatabase(): Promise<Database> {
  console.warn('⚠️ [LEGACY] initializeDatabase() 已弃用');
  await initDatabaseService();
  return await getSafeDb();
}

/**
 * @deprecated 使用 initDatabaseService() 替代
 */
export async function initDatabaseQueue(): Promise<void> {
  console.warn('⚠️ [LEGACY] initDatabaseQueue() 已弃用');
  return await initDatabaseService();
}

// 注意：数据库初始化现在由 TauriApp 组件控制，不再自动初始化 