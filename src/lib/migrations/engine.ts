import Database from "@tauri-apps/plugin-sql";
import {
  Migration,
  MigrationOperation,
  MigrationResult,
  MigrationState
} from './types';
import { sqlGenerator } from './sqlGenerator';

/**
 * 迁移引擎
 * 负责执行数据库迁移操作
 */
export class MigrationEngine {
  private db: Database;
  private migrationTableName = 'schema_migrations';

  constructor(database: Database) {
    this.db = database;
  }

  /**
   * 初始化迁移系统
   */
  async initialize(): Promise<void> {
    await this.createMigrationTable();
  }

  /**
   * 创建迁移记录表
   */
  private async createMigrationTable(): Promise<void> {
    // 检查是否存在旧的版本表结构
    const oldSchemaVersionExists = await this.checkOldSchemaVersionTable();
    
    if (oldSchemaVersionExists) {
      console.log('🔄 检测到旧版本表结构，正在迁移...');
      await this.migrateOldSchemaVersionTable();
    }

    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS ${this.migrationTableName} (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        executed_at INTEGER NOT NULL,
        execution_time INTEGER NOT NULL,
        checksum TEXT NOT NULL
      )
    `);
  }

  /**
   * 检查是否存在旧的schema_version表
   */
  private async checkOldSchemaVersionTable(): Promise<boolean> {
    try {
      // 检查是否存在名为 schema_version 的旧表，但结构不同
      const result = await this.db.select(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='schema_version'
      `) as Array<{name: string}>;
      
      if (result.length === 0) {
        return false;
      }

      // 检查表结构是否为旧格式（没有created_at字段）
      const columns = await this.db.select(`PRAGMA table_info(schema_version)`) as Array<{name: string}>;
      const hasCreatedAt = columns.some((col) => col.name === 'created_at');
      const hasName = columns.some((col) => col.name === 'name');
      
      // 如果没有created_at或name字段，说明是旧表结构
      return !hasCreatedAt || !hasName;
    } catch (error) {
      return false;
    }
  }

  /**
   * 迁移旧的schema_version表到新格式
   */
  private async migrateOldSchemaVersionTable(): Promise<void> {
    try {
      await this.db.execute("BEGIN TRANSACTION");

      // 获取旧表中的版本数据
      let oldVersions: number[] = [];
      try {
        const result = await this.db.select("SELECT version FROM schema_version ORDER BY version");
        oldVersions = (result as any[]).map(row => row.version);
      } catch (error) {
        // 如果查询失败，可能是旧表结构不同，尝试其他方式
        console.log('  尝试其他方式获取旧版本数据...');
      }

      // 重命名旧表
      await this.db.execute("ALTER TABLE schema_version RENAME TO schema_version_old");

      // 创建新的schema_migrations表
      await this.db.execute(`
        CREATE TABLE ${this.migrationTableName} (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          executed_at INTEGER NOT NULL,
          execution_time INTEGER NOT NULL,
          checksum TEXT NOT NULL
        )
      `);

      // 如果有旧版本数据，迁移到新表
      if (oldVersions.length > 0) {
        const currentTime = Date.now();
        for (const version of oldVersions) {
          await this.db.execute(`
            INSERT INTO ${this.migrationTableName} (version, name, executed_at, execution_time, checksum)
            VALUES (?, ?, ?, ?, ?)
          `, [
            version, 
            `legacy_migration_v${version}`, 
            currentTime, 
            0, 
            'legacy'
          ]);
        }
        console.log(`  已迁移 ${oldVersions.length} 个旧版本记录`);
      }

      // 删除旧表
      await this.db.execute("DROP TABLE schema_version_old");

      await this.db.execute("COMMIT");
      console.log('  版本表迁移完成');
    } catch (error) {
      await this.db.execute("ROLLBACK");
      console.error('  ❌ 版本表迁移失败:', error);
      throw error;
    }
  }

  /**
   * 获取已执行的迁移版本
   */
  async getExecutedMigrations(): Promise<MigrationState[]> {
    const result = await this.db.select(`
      SELECT version, name, executed_at, execution_time, checksum 
      FROM ${this.migrationTableName} 
      ORDER BY version
    `) as Array<{
      version: number;
      name: string;
      executed_at: number;
      execution_time: number;
      checksum: string;
    }>;
    
    return result.map(row => ({
      version: row.version,
      name: row.name,
      executedAt: row.executed_at,
      executionTime: row.execution_time,
      checksum: row.checksum
    }));
  }

  /**
   * 获取当前数据库版本
   */
  async getCurrentVersion(): Promise<number> {
    const migrations = await this.getExecutedMigrations();
    return migrations.length > 0 ? Math.max(...migrations.map(m => m.version)) : 0;
  }

  /**
   * 执行迁移（向前）
   */
  async migrateUp(migrations: Migration[], targetVersion?: number): Promise<MigrationResult[]> {
    const currentVersion = await this.getCurrentVersion();
    const executedMigrations = await this.getExecutedMigrations();
    const executedVersions = new Set(executedMigrations.map(m => m.version));

    // 过滤需要执行的迁移
    const migrationsToRun = migrations
      .filter(m => m.version > currentVersion && !executedVersions.has(m.version))
      .filter(m => targetVersion === undefined || m.version <= targetVersion)
      .sort((a, b) => a.version - b.version);

    console.log(`🚀 开始执行数据库迁移，当前版本: v${currentVersion}`);
    console.log(`📋 计划执行 ${migrationsToRun.length} 个迁移`);

    const results: MigrationResult[] = [];

    for (const migration of migrationsToRun) {
      console.log(`🔄 执行迁移 v${migration.version}: ${migration.name}`);
      const result = await this.executeMigration(migration, 'up');
      results.push(result);

      if (!result.success) {
        console.error(`❌ 迁移 v${migration.version} 失败: ${result.error}`);
        break;
      }
    }

    return results;
  }

  /**
   * 回滚迁移（向后）
   */
  async migrateDown(migrations: Migration[], targetVersion: number): Promise<MigrationResult[]> {
    const currentVersion = await this.getCurrentVersion();
    const executedMigrations = await this.getExecutedMigrations();

    // 过滤需要回滚的迁移
    const migrationsToRollback = migrations
      .filter(m => m.version > targetVersion && m.version <= currentVersion)
      .filter(m => executedMigrations.some(em => em.version === m.version))
      .sort((a, b) => b.version - a.version); // 降序执行回滚

    console.log(`⬇️ 开始回滚数据库，目标版本: v${targetVersion}`);
    console.log(`📋 计划回滚 ${migrationsToRollback.length} 个迁移`);

    const results: MigrationResult[] = [];

    for (const migration of migrationsToRollback) {
      if (!migration.down) {
        const error = `迁移 v${migration.version} 没有定义回滚操作`;
        console.error(`❌ ${error}`);
        results.push({
          version: migration.version,
          success: false,
          error,
          executionTime: 0
        });
        break;
      }

      console.log(`⬇️ 回滚迁移 v${migration.version}: ${migration.name}`);
      const result = await this.executeMigration(migration, 'down');
      results.push(result);

      if (!result.success) {
        console.error(`❌ 回滚 v${migration.version} 失败: ${result.error}`);
        break;
      }
    }

    return results;
  }

  /**
   * 执行单个迁移
   */
  private async executeMigration(
    migration: Migration, 
    direction: 'up' | 'down'
  ): Promise<MigrationResult> {
    const startTime = Date.now();
    
    try {
      await this.db.execute("BEGIN TRANSACTION");

      const operations = direction === 'up' ? migration.up : migration.down!;
      
      for (const operation of operations) {
        await this.executeOperation(operation);
      }

      if (direction === 'up') {
        // 记录迁移执行状态
        const checksum = this.calculateChecksum(migration);
        await this.recordMigration(migration, startTime, checksum);
      } else {
        // 删除迁移记录
        await this.removeMigrationRecord(migration.version);
      }

      await this.db.execute("COMMIT");

      const executionTime = Date.now() - startTime;
      console.log(`迁移 v${migration.version} ${direction === 'up' ? '执行' : '回滚'}成功 (${executionTime}ms)`);

      return {
        version: migration.version,
        success: true,
        executionTime
      };
    } catch (error) {
      await this.db.execute("ROLLBACK");
      
      return {
        version: migration.version,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * 执行迁移操作
   */
  private async executeOperation(operation: MigrationOperation): Promise<void> {
    switch (operation.type) {
      case 'createTable':
        // 检查表是否已存在
        const tableExists = await this.checkTableExists(operation.table.name);
        
        if (tableExists) {
          console.log(`  ⚠️ 表 ${operation.table.name} 已存在，跳过创建`);
        } else {
          const createSQL = sqlGenerator.generateCreateTable(operation.table, true);
          await this.db.execute(createSQL);
          console.log(`  创建表 ${operation.table.name}`);
        }
        
        // 创建索引（幂等性）
        if (operation.table.indexes) {
          for (const index of operation.table.indexes) {
            const indexSQL = sqlGenerator.generateCreateIndex(operation.table.name, index, true);
            await this.db.execute(indexSQL);
            console.log(`  创建索引 ${index.name}`);
          }
        }
        break;

      case 'alterTable':
        const alterSQLs = sqlGenerator.generateAlterTable(operation.tableName, operation.operations);
        for (const sql of alterSQLs) {
          await this.db.execute(sql);
        }
        break;

      case 'dropTable':
        const dropSQL = sqlGenerator.generateDropTable(operation.tableName);
        await this.db.execute(dropSQL);
        break;

      case 'createIndex':
        const createIndexSQL = sqlGenerator.generateCreateIndex(operation.tableName, operation.index);
        await this.db.execute(createIndexSQL);
        break;

      case 'dropIndex':
        const dropIndexSQL = sqlGenerator.generateDropIndex(operation.indexName);
        await this.db.execute(dropIndexSQL);
        break;

      case 'rawSQL':
        await this.db.execute(operation.sql, operation.params);
        break;

      case 'dataMigration':
        console.log(`  📊 执行数据迁移: ${operation.description}`);
        await operation.up(this.db);
        break;

      default:
        throw new Error(`Unknown migration operation: ${(operation as any).type}`);
    }
  }

  /**
   * 记录迁移执行状态
   */
  private async recordMigration(migration: Migration, startTime: number, checksum: string): Promise<void> {
    const executionTime = Date.now() - startTime;
    await this.db.execute(`
      INSERT INTO ${this.migrationTableName} (version, name, executed_at, execution_time, checksum)
      VALUES (?, ?, ?, ?, ?)
    `, [migration.version, migration.name, Date.now(), executionTime, checksum]);
  }

  /**
   * 删除迁移记录
   */
  private async removeMigrationRecord(version: number): Promise<void> {
    await this.db.execute(`
      DELETE FROM ${this.migrationTableName} WHERE version = ?
    `, [version]);
  }

  /**
   * 计算迁移校验和
   */
  private calculateChecksum(migration: Migration): string {
    const content = JSON.stringify({
      version: migration.version,
      name: migration.name,
      description: migration.description,
      up: migration.up,
      down: migration.down
    });
    
    // 简单的校验和计算
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return hash.toString(16);
  }

  /**
   * 检查表是否存在
   */
  private async checkTableExists(tableName: string): Promise<boolean> {
    try {
      const result = await this.db.select(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name=?
      `, [tableName]) as Array<{name: string}>;
      
      return result.length > 0;
    } catch (error) {
      console.warn(`检查表 ${tableName} 是否存在时出错:`, error);
      return false;
    }
  }
} 