/**
 * SQLite 配置管理
 * 统一管理SQLite的最佳实践配置
 */

import Database from '@tauri-apps/plugin-sql';

export interface SQLiteConfig {
  /** busy_timeout 超时时间（毫秒） */
  busyTimeout: number;
  
  /** 日志模式 */
  journalMode: 'DELETE' | 'TRUNCATE' | 'PERSIST' | 'MEMORY' | 'WAL' | 'OFF';
  
  /** 同步模式 */
  synchronous: 'OFF' | 'NORMAL' | 'FULL' | 'EXTRA';
  
  /** 锁定模式 */
  lockingMode: 'NORMAL' | 'EXCLUSIVE';
  
  /** 缓存大小（负数表示KB，正数表示页数） */
  cacheSize: number;
  
  /** 内存映射大小（字节） */
  mmapSize: number;
  
  /** 临时存储位置 */
  tempStore: 'DEFAULT' | 'FILE' | 'MEMORY';
  
  /** WAL自动检查点间隔 */
  walAutocheckpoint: number;
  
  /** 日志大小限制（字节） */
  journalSizeLimit: number;
  
  /** 是否启用外键约束 */
  foreignKeys: boolean;
}

/**
 * 不同场景的SQLite配置预设
 */
export const SQLiteConfigs = {
  /** 生产环境配置 - 平衡性能和安全性 */
  production: {
    busyTimeout: 5000,
    journalMode: 'WAL',
    synchronous: 'NORMAL',
    lockingMode: 'NORMAL',
    cacheSize: -16000,  // 16MB
    mmapSize: 268435456, // 256MB
    tempStore: 'MEMORY',
    walAutocheckpoint: 1000,
    journalSizeLimit: 67108864, // 64MB
    foreignKeys: true
  } as SQLiteConfig,

  /** 开发环境配置 - 快速重置和调试 */
  development: {
    busyTimeout: 3000,  // 更短的超时，快速发现问题
    journalMode: 'WAL',
    synchronous: 'NORMAL',
    lockingMode: 'NORMAL',
    cacheSize: -8000,   // 8MB，节省内存
    mmapSize: 134217728, // 128MB
    tempStore: 'MEMORY',
    walAutocheckpoint: 500,
    journalSizeLimit: 33554432, // 32MB
    foreignKeys: true
  } as SQLiteConfig,

  /** 重置专用配置 - 优化删除和创建操作 */
  reset: {
    busyTimeout: 5000,
    journalMode: 'WAL',
    synchronous: 'NORMAL',
    lockingMode: 'NORMAL',
    cacheSize: -4000,   // 4MB，减少内存使用
    mmapSize: 67108864, // 64MB
    tempStore: 'MEMORY',
    walAutocheckpoint: 100, // 更频繁的检查点
    journalSizeLimit: 16777216, // 16MB
    foreignKeys: false  // 重置时暂时关闭外键约束
  } as SQLiteConfig,

  /** 高性能配置 - 大量数据处理 */
  performance: {
    busyTimeout: 10000,
    journalMode: 'WAL',
    synchronous: 'NORMAL',
    lockingMode: 'NORMAL',
    cacheSize: -32000,  // 32MB
    mmapSize: 536870912, // 512MB
    tempStore: 'MEMORY',
    walAutocheckpoint: 2000,
    journalSizeLimit: 134217728, // 128MB
    foreignKeys: true
  } as SQLiteConfig,

  /** 内存优化配置 - 节省内存使用 */
  memoryOptimized: {
    busyTimeout: 3000,
    journalMode: 'WAL',
    synchronous: 'NORMAL',
    lockingMode: 'NORMAL',
    cacheSize: -2000,   // 2MB
    mmapSize: 33554432, // 32MB
    tempStore: 'MEMORY',
    walAutocheckpoint: 200,
    journalSizeLimit: 8388608, // 8MB
    foreignKeys: true
  } as SQLiteConfig
} as const;

/**
 * 根据配置生成PRAGMA语句数组
 */
export function generatePragmaStatements(config: SQLiteConfig): string[] {
  return [
    `PRAGMA busy_timeout = ${config.busyTimeout}`,
    `PRAGMA journal_mode = ${config.journalMode}`,
    `PRAGMA synchronous = ${config.synchronous}`,
    `PRAGMA locking_mode = ${config.lockingMode}`,
    `PRAGMA cache_size = ${config.cacheSize}`,
    `PRAGMA mmap_size = ${config.mmapSize}`,
    `PRAGMA temp_store = ${config.tempStore}`,
    `PRAGMA wal_autocheckpoint = ${config.walAutocheckpoint}`,
    `PRAGMA journal_size_limit = ${config.journalSizeLimit}`,
    `PRAGMA foreign_keys = ${config.foreignKeys ? 'ON' : 'OFF'}`
  ];
}

/**
 * 应用SQLite配置到数据库连接
 */
export async function applySQLiteConfig(
  db: any, 
  config: SQLiteConfig, 
  verbose: boolean = false
): Promise<void> {
  const pragmas = generatePragmaStatements(config);
  
  if (verbose) {
    console.log(`🔧 应用SQLite配置 (busy_timeout: ${config.busyTimeout}ms, cache: ${Math.abs(config.cacheSize)/1000}MB)...`);
  }
  
  for (const pragma of pragmas) {
    try {
      await db.execute(pragma);
      if (verbose) {
        console.log(`  ${pragma}`);
      }
    } catch (error) {
      if (verbose) {
        console.warn(`  ⚠️ ${pragma} 失败:`, error);
      }
    }
  }
  
  if (verbose) {
    console.log("SQLite配置应用完成");
  }
}

/**
 * 验证当前SQLite配置
 */
export async function validateSQLiteConfig(
  db: any,
  expectedConfig: SQLiteConfig
): Promise<{
  isValid: boolean;
  issues: string[];
  currentConfig: Partial<SQLiteConfig>;
}> {
  const issues: string[] = [];
  const currentConfig: Partial<SQLiteConfig> = {};
  
  try {
    // 检查各项配置
    const checks = [
      { pragma: 'PRAGMA busy_timeout', key: 'busyTimeout', expected: expectedConfig.busyTimeout },
      { pragma: 'PRAGMA journal_mode', key: 'journalMode', expected: expectedConfig.journalMode.toLowerCase() },
      { pragma: 'PRAGMA synchronous', key: 'synchronous', expected: expectedConfig.synchronous.toLowerCase() },
      { pragma: 'PRAGMA locking_mode', key: 'lockingMode', expected: expectedConfig.lockingMode.toLowerCase() },
      { pragma: 'PRAGMA cache_size', key: 'cacheSize', expected: expectedConfig.cacheSize },
      { pragma: 'PRAGMA foreign_keys', key: 'foreignKeys', expected: expectedConfig.foreignKeys ? 1 : 0 }
    ];
    
    for (const check of checks) {
      try {
        const result = await db.select(check.pragma) as any[];
        const currentValue = result[0] ? Object.values(result[0])[0] : null;
        
        (currentConfig as any)[check.key] = currentValue;
        
        if (currentValue !== check.expected) {
          issues.push(`${check.key}: 期望 ${check.expected}, 实际 ${currentValue}`);
        }
      } catch (error) {
        issues.push(`检查 ${check.key} 失败: ${error}`);
      }
    }
    
    const isValid = issues.length === 0;
    return { isValid, issues, currentConfig };
    
  } catch (error) {
    issues.push(`配置验证失败: ${error}`);
    return { isValid: false, issues, currentConfig };
  }
}

/**
 * 获取当前环境推荐的配置
 */
export function getRecommendedConfig(environment?: string): SQLiteConfig {
  const env = environment || process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return SQLiteConfigs.production;
    case 'development':
    case 'dev':
      return SQLiteConfigs.development;
    case 'test':
      return SQLiteConfigs.memoryOptimized;
    default:
      return SQLiteConfigs.development;
  }
}

/**
 * 为数据库重置操作应用特定的PRAGMA配置
 * 这些配置旨在加快DML（如DELETE, DROP）操作
 * @param db 数据库实例
 */
export async function applyResetConfiguration(db: Database): Promise<void> {
  await db.execute(`
    PRAGMA foreign_keys = OFF;
    PRAGMA journal_mode = MEMORY;
    PRAGMA synchronous = OFF;
  `);
  console.log('应用了重置专用配置');
}

/**
 * 应用最优的运行时PRAGMA配置
 * 这些配置旨在提高应用的日常读写性能和稳定性
 * @param db 数据库实例
 */
export async function applyOptimalPragmas(db: Database): Promise<void> {
  await db.execute(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
  `);
  // console.log('应用了最优运行时配置'); // 在常规操作中可以保持静默
}

/**
 * 诊断SQLite性能配置
 */
export async function diagnoseSQLitePerformance(db: any): Promise<{
  score: number;
  recommendations: string[];
  currentSettings: Record<string, any>;
}> {
  const recommendations: string[] = [];
  const currentSettings: Record<string, any> = {};
  let score = 100;
  
  try {
    // 获取当前设置
    const settings = [
      'PRAGMA busy_timeout',
      'PRAGMA journal_mode', 
      'PRAGMA synchronous',
      'PRAGMA cache_size',
      'PRAGMA locking_mode',
      'PRAGMA foreign_keys'
    ];
    
    for (const setting of settings) {
      try {
        const result = await db.select(setting) as any[];
        const key = setting.replace('PRAGMA ', '');
        currentSettings[key] = result[0] ? Object.values(result[0])[0] : null;
      } catch (error) {
        recommendations.push(`无法读取 ${setting} 设置`);
        score -= 10;
      }
    }
    
    // 性能评估
    if (currentSettings['journal_mode'] !== 'wal') {
      recommendations.push('建议启用WAL模式以提高并发性能');
      score -= 20;
    }
    
    if (currentSettings['busy_timeout'] > 10000) {
      recommendations.push('busy_timeout过长可能导致长时间等待');
      score -= 10;
    }
    
    if (currentSettings['locking_mode'] === 'exclusive') {
      recommendations.push('EXCLUSIVE锁定模式会阻止并发访问');
      score -= 15;
    }
    
    const cacheSize = currentSettings['cache_size'];
    if (cacheSize > 0 && cacheSize < 1000) {
      recommendations.push('缓存大小过小，建议增加到至少8MB');
      score -= 10;
    }
    
    return { score: Math.max(0, score), recommendations, currentSettings };
    
  } catch (error) {
    recommendations.push(`性能诊断失败: ${error}`);
    return { score: 0, recommendations, currentSettings };
  }
} 