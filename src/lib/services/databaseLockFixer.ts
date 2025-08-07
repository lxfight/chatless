import Database from '@tauri-apps/plugin-sql';
import { invoke } from '@tauri-apps/api/core';

interface DatabaseMetrics {
  lockWaitTime: number;
  transactionDuration: number;
  queryCount: number;
  errorRate: number;
  walSize: number;
  shmExists: boolean;
}

interface LockDiagnostics {
  hasActiveSessions: boolean;
  walFileSize: number;
  shmFileExists: boolean;
  busyConnections: number;
  lastCheckpointTime: number;
}

interface WALCheckpointResult {
  busy: number;
  log: number;
  checkpointed: number;
}

interface PragmaResult {
  [key: string]: any;
}

/**
 * 数据库锁定修复工具
 * 专门用于解决SQLite数据库锁定问题
 */
export class DatabaseLockFixer {
  private static instance: DatabaseLockFixer;
  private db: Database | null = null;
  private isFixing = false;
  private lockTimeout = 5000; // 5 seconds as recommended

  static getInstance(): DatabaseLockFixer {
    if (!DatabaseLockFixer.instance) {
      DatabaseLockFixer.instance = new DatabaseLockFixer();
    }
    return DatabaseLockFixer.instance;
  }

  /**
   * 强制释放数据库锁定
   */
  async forceReleaseLocks(): Promise<void> {
    console.log('🔧 开始强制释放数据库锁定...');
    
    if (this.isFixing) {
      console.log('⚠️ 锁修复正在进行中，跳过');
      return;
    }

    this.isFixing = true;

    try {
      await this.ensureConnection();

      // 1. 诊断当前状态
      const diagnostics = await this.diagnoseLockIssues();
      console.log('🔍 锁诊断结果:', diagnostics);

      // 2. 强制结束事务
      await this.forceEndTransactions();

      // 3. 多层级的检查点策略
      await this.multiLevelCheckpoint();

      // 4. 应用强制解锁配置
      await this.applyForceUnlockConfig();

      // 5. 验证解锁结果
      await this.verifyUnlockSuccess();

      console.log('🎉 数据库锁定释放完成');
    } catch (error) {
      console.error('❌ 强制释放锁定失败:', error);
      throw error;
    } finally {
      this.isFixing = false;
    }
  }

  /**
   * 检查数据库是否被锁定
   */
  async isDatabaseLocked(): Promise<boolean> {
    try {
      await this.ensureConnection();
      
      // 尝试执行立即事务来检测锁定
      await this.db!.execute('BEGIN IMMEDIATE TRANSACTION');
      await this.db!.execute('ROLLBACK');
      return false;
    } catch (error) {
      const errorMessage = String(error).toLowerCase();
      return errorMessage.includes('locked') || errorMessage.includes('busy');
    }
  }

  /**
   * 检查并修复数据库状态
   */
  async checkAndFixDatabaseState(): Promise<{
    wasLocked: boolean;
    fixed: boolean;
    error?: string;
  }> {
    try {
      const wasLocked = await this.isDatabaseLocked();
      
      if (wasLocked) {
        console.log('🔧 检测到数据库锁定，尝试修复...');
        await this.forceReleaseLocks();
        
        // 验证修复结果
        const stillLocked = await this.isDatabaseLocked();
        return {
          wasLocked: true,
          fixed: !stillLocked
        };
      }
      
      return {
        wasLocked: false,
        fixed: true
      };
    } catch (error) {
      return {
        wasLocked: true,
        fixed: false,
        error: String(error)
      };
    }
  }

  /**
   * 准备数据库进行重置操作 - 最优化配置
   */
  async prepareForReset(): Promise<void> {
    console.log('🔧 准备数据库重置环境...');
    
    try {
      await this.ensureConnection();
      
      // 1. 强制结束所有挂起的事务
      await this.forceEndTransactions();
      
      // 2. 执行 RESTART 类型的检查点（最激进）
      await this.aggressiveCheckpoint();
      
      // 3. 设置重置专用配置
      await this.applyResetConfiguration();
      
      // 4. 验证锁状态
      await this.verifyLockStatus();
      
      console.log('数据库重置环境准备完成');
    } catch (error) {
      console.error('❌ 重置环境准备失败:', error);
      throw error;
    }
  }

  /**
   * 重置完成后的清理工作
   */
  async cleanupAfterReset(): Promise<void> {
    console.log('🧹 开始重置后清理...');
    
    try {
      await this.ensureConnection();
      
      // 1. 恢复正常的WAL检查点设置
      await this.db!.execute('PRAGMA wal_autocheckpoint = 1000;');
      
      // 2. 恢复外键约束
      await this.db!.execute('PRAGMA foreign_keys = ON;');
      
      // 3. 执行最终的检查点和优化
      await this.performOptimization();
      
      console.log('重置后清理完成');
    } catch (error) {
      console.error('❌ 重置后清理失败:', error);
    }
  }

  /**
   * 诊断数据库锁问题
   */
  async diagnoseLockIssues(): Promise<LockDiagnostics> {
    try {
      await this.ensureConnection();
      
      const diagnostics: LockDiagnostics = {
        hasActiveSessions: false,
        walFileSize: 0,
        shmFileExists: false,
        busyConnections: 0,
        lastCheckpointTime: Date.now()
      };

      // 检查WAL文件大小
      try {
        const walInfo = await this.db!.select('PRAGMA wal_checkpoint;') as WALCheckpointResult[];
        if (walInfo[0]) {
          diagnostics.walFileSize = walInfo[0].log || 0;
          diagnostics.hasActiveSessions = walInfo[0].busy > 0;
        }
      } catch (error) {
        console.warn('WAL信息获取失败:', error);
      }

      return diagnostics;
    } catch (error) {
      console.error('锁诊断失败:', error);
      return {
        hasActiveSessions: true,
        walFileSize: -1,
        shmFileExists: false,
        busyConnections: -1,
        lastCheckpointTime: 0
      };
    }
  }

  /**
   * 强制结束所有挂起的事务
   */
  private async forceEndTransactions(): Promise<void> {
    if (!this.db) return;

    try {
      // 尝试提交任何挂起的事务
      try {
        await this.db.execute('COMMIT;');
        console.log('提交了挂起的事务');
      } catch (error) {
        console.log('ℹ️ 没有挂起的事务需要提交');
      }

      // 尝试回滚任何挂起的事务
      try {
        await this.db.execute('ROLLBACK;');
        console.log('回滚了挂起的事务');
      } catch (error) {
        console.log('ℹ️ 没有挂起的事务需要回滚');
      }

      // 结束任何 DEFERRED 事务
      try {
        await this.db.execute('END;');
        console.log('结束了延迟事务');
      } catch (error) {
        console.log('ℹ️ 没有延迟事务需要结束');
      }
    } catch (error) {
      console.warn('⚠️ 强制结束事务时出现错误:', error);
    }
  }

  /**
   * 执行激进的WAL检查点
   */
  private async aggressiveCheckpoint(): Promise<void> {
    if (!this.db) return;

    try {
      // 执行 RESTART 检查点 - 最激进的模式
      const result = await this.db.select('PRAGMA wal_checkpoint(RESTART);') as WALCheckpointResult[];
      console.log('RESTART检查点执行完成:', result[0]);

      // 如果RESTART失败，尝试TRUNCATE
      if (result[0]?.busy > 0) {
        const truncateResult = await this.db.select('PRAGMA wal_checkpoint(TRUNCATE);') as WALCheckpointResult[];
        console.log('TRUNCATE检查点执行完成:', truncateResult[0]);
      }
    } catch (error) {
      console.warn('⚠️ 激进检查点执行失败:', error);
      
      // 退而求其次，使用FULL检查点
      try {
        const result = await this.db.select('PRAGMA wal_checkpoint(FULL);') as WALCheckpointResult[];
        console.log('FULL检查点执行完成:', result[0]);
      } catch (fallbackError) {
        console.warn('⚠️ FULL检查点也失败:', fallbackError);
      }
    }
  }

  /**
   * 应用重置专用的数据库配置
   */
  private async applyResetConfiguration(): Promise<void> {
    if (!this.db) return;

    const resetConfig = [
      // 最短的锁等待时间 - 快速失败而不是长时间等待
      `PRAGMA busy_timeout = ${this.lockTimeout};`,
      
      // 确保NORMAL锁模式 - 避免EXCLUSIVE锁
      'PRAGMA locking_mode = NORMAL;',
      
      // 设置为NORMAL同步模式 - WAL模式推荐
      'PRAGMA synchronous = NORMAL;',
      
      // 优化缓存大小 - 重置操作专用
      'PRAGMA cache_size = -16000;', // 16MB
      
      // WAL自动检查点阈值设为0 - 立即检查点
      'PRAGMA wal_autocheckpoint = 0;',
      
      // 临时存储在内存中 - 加快重置速度
      'PRAGMA temp_store = MEMORY;',
      
      // 禁用外键约束检查 - 重置期间
      'PRAGMA foreign_keys = OFF;'
    ];

    for (const pragma of resetConfig) {
      try {
        await this.db.execute(pragma);
      } catch (error) {
        console.warn(`⚠️ 配置应用失败: ${pragma}`, error);
      }
    }

    console.log('重置配置应用完成');
  }

  /**
   * 验证数据库锁状态
   */
  private async verifyLockStatus(): Promise<void> {
    if (!this.db) return;

    try {
      // 检查WAL模式状态
      const journalMode = await this.db.select('PRAGMA journal_mode;') as PragmaResult[];
      console.log('📊 日志模式:', journalMode[0]);

      // 检查锁模式
      const lockingMode = await this.db.select('PRAGMA locking_mode;') as PragmaResult[];
      console.log('🔒 锁模式:', lockingMode[0]);

      // 检查忙等待超时
      const busyTimeout = await this.db.select('PRAGMA busy_timeout;') as PragmaResult[];
      console.log('⏱️ 忙等待超时:', busyTimeout[0]);

      // 测试数据库可写性
      await this.db.execute('BEGIN IMMEDIATE; ROLLBACK;');
      console.log('数据库写锁测试通过');

    } catch (error) {
      console.error('❌ 锁状态验证失败:', error);
      throw new Error(`数据库锁状态异常: ${error}`);
    }
  }

  /**
   * 多层级检查点策略
   */
  private async multiLevelCheckpoint(): Promise<void> {
    const strategies = [
      { name: 'PASSIVE', sql: 'PRAGMA wal_checkpoint(PASSIVE);' },
      { name: 'FULL', sql: 'PRAGMA wal_checkpoint(FULL);' },
      { name: 'RESTART', sql: 'PRAGMA wal_checkpoint(RESTART);' },
      { name: 'TRUNCATE', sql: 'PRAGMA wal_checkpoint(TRUNCATE);' }
    ];

    for (const strategy of strategies) {
      try {
        const result = await this.db!.select(strategy.sql) as WALCheckpointResult[];
        console.log(`${strategy.name}检查点执行完成:`, result[0]);
        
        // 如果检查点成功且没有繁忙连接，停止尝试
        if (result[0] && result[0].busy === 0) {
          console.log(`🎯 ${strategy.name}检查点完全成功`);
          break;
        }
      } catch (error) {
        console.warn(`⚠️ ${strategy.name}检查点失败:`, error);
        
        // 如果是最后一个策略还失败，记录但继续
        if (strategy.name === 'TRUNCATE') {
          console.error('❌ 所有检查点策略都失败');
        }
      }
    }
  }

  /**
   * 应用强制解锁配置
   */
  private async applyForceUnlockConfig(): Promise<void> {
    const unlockConfig = [
      'PRAGMA busy_timeout = 1000;', // 1秒快速超时
      'PRAGMA locking_mode = NORMAL;',
      'PRAGMA synchronous = NORMAL;',
      'PRAGMA journal_mode = WAL;' // 确保WAL模式
    ];

    for (const pragma of unlockConfig) {
      try {
        await this.db!.execute(pragma);
      } catch (error) {
        console.warn(`⚠️ 解锁配置失败: ${pragma}`, error);
      }
    }
  }

  /**
   * 验证解锁成功
   */
  private async verifyUnlockSuccess(): Promise<void> {
    try {
      // 尝试执行一个快速的写操作测试
      await this.db!.execute('BEGIN IMMEDIATE; ROLLBACK;');
      console.log('数据库解锁验证成功');
    } catch (error) {
      console.error('❌ 数据库仍然被锁定:', error);
      throw new Error('数据库解锁失败，仍然被锁定');
    }
  }

  /**
   * 确保数据库连接存在
   */
  private async ensureConnection(): Promise<void> {
    if (!this.db) {
      this.db = await Database.load('sqlite:mychat.db');
    }
  }

  /**
   * 执行数据库优化
   */
  private async performOptimization(): Promise<void> {
    try {
      // 分析统计信息
      await this.db!.execute('ANALYZE;');
      console.log('数据库统计信息已更新');

      // 执行最终检查点
      const result = await this.db!.select('PRAGMA wal_checkpoint(PASSIVE);') as WALCheckpointResult[];
      console.log('最终检查点完成:', result[0]);

    } catch (error) {
      console.warn('⚠️ 数据库优化失败:', error);
    }
  }

  /**
   * 获取数据库性能指标
   */
  async getDatabaseMetrics(): Promise<DatabaseMetrics> {
    try {
      await this.ensureConnection();
      
      const metrics: DatabaseMetrics = {
        lockWaitTime: 0,
        transactionDuration: 0,
        queryCount: 0,
        errorRate: 0,
        walSize: 0,
        shmExists: false
      };

      // 获取WAL信息
      try {
        const walInfo = await this.db!.select('PRAGMA wal_checkpoint;') as WALCheckpointResult[];
        if (walInfo[0]) {
          metrics.walSize = walInfo[0].log || 0;
        }
      } catch (error) {
        console.warn('获取WAL指标失败:', error);
      }

      return metrics;
    } catch (error) {
      console.error('获取数据库指标失败:', error);
      return {
        lockWaitTime: -1,
        transactionDuration: -1,
        queryCount: -1,
        errorRate: -1,
        walSize: -1,
        shmExists: false
      };
    }
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    if (this.db) {
      try {
        await this.db.close();
        this.db = null;
        console.log('数据库连接已关闭');
      } catch (error) {
        console.error('❌ 关闭数据库连接失败:', error);
      }
    }
  }
}

/**
 * 快速修复函数，可以在控制台调用
 */
export async function quickFixDatabaseLocks(): Promise<void> {
  try {
    await DatabaseLockFixer.getInstance().forceReleaseLocks();
    console.log('🎉 数据库锁定问题修复完成！');
  } catch (error) {
    console.error('❌ 数据库锁定修复失败:', error);
    throw error;
  }
}
