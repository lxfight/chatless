import Database from "@tauri-apps/plugin-sql";
import { DatabaseStateRepair } from '../utils/databaseStateRepair';
import { runDatabaseMigration } from '../migrations/index';

/**
 * 数据库修复脚本
 * 用于诊断和修复数据库状态不一致问题
 */

export interface RepairOptions {
  forceReset?: boolean;
  targetVersion?: number;
  dryRun?: boolean;
}

export interface RepairResult {
  success: boolean;
  message: string;
  details?: string[];
  error?: string;
}

/**
 * 诊断数据库问题
 */
export async function diagnoseDatabaseIssues(db: Database): Promise<{
  hasIssues: boolean;
  issues: string[];
  suggestions: string[];
}> {
  const issues: string[] = [];
  const suggestions: string[] = [];

  try {
    console.log('🔍 开始诊断数据库问题...');

    // 检查表结构
    type TableRow = { name: string };
    const tables = (await db.select<TableRow>(`
      SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
    `)) as TableRow[];
    
    const tableNames = tables.map(t => t.name);
    console.log('📋 现有表:', tableNames);

    // 检查版本表状态
    const hasSchemaVersion = tableNames.includes('schema_version');
    const hasSchemaMigrations = tableNames.includes('schema_migrations');

    if (!hasSchemaVersion && !hasSchemaMigrations) {
      if (tableNames.length > 0) {
        issues.push('数据库有表但缺少版本记录表');
        suggestions.push('运行修复脚本重建版本信息');
      }
    }

    // 检查核心表
    const coreTablesV1 = ['conversations', 'messages'];
    const coreTablesV2 = ['documents', 'knowledge_bases', 'knowledge_chunks', 'doc_knowledge_mappings'];
    
    const missingV1 = coreTablesV1.filter(table => !tableNames.includes(table));
    const missingV2 = coreTablesV2.filter(table => !tableNames.includes(table));

    if (missingV1.length > 0) {
      issues.push(`缺少核心表(v1): ${missingV1.join(', ')}`);
      suggestions.push('运行数据库迁移创建缺少的表');
    }

    if (missingV2.length > 0 && missingV1.length === 0) {
      issues.push(`缺少知识库表(v2): ${missingV2.join(', ')}`);
      suggestions.push('运行数据库迁移升级到v2');
    }

    // 检查版本一致性
    if (hasSchemaVersion || hasSchemaMigrations) {
      const repair = new DatabaseStateRepair(db);
      const state = await repair.checkDatabaseState();
      
      if (state.shouldRepair) {
        issues.push(state.suggestedAction);
        suggestions.push('运行状态修复脚本');
      }
    }

    console.log(`🔍 诊断完成: ${issues.length} 个问题，${suggestions.length} 个建议`);

    return {
      hasIssues: issues.length > 0,
      issues,
      suggestions
    };

  } catch (error) {
    console.error('❌ 诊断过程中出错:', error);
    return {
      hasIssues: true,
      issues: ['诊断过程中出现错误'],
      suggestions: ['检查数据库连接和权限']
    };
  }
}

/**
 * 自动修复数据库问题
 */
export async function autoRepairDatabase(
  db: Database, 
  options: RepairOptions = {}
): Promise<RepairResult> {
  const { forceReset = false, targetVersion, dryRun = false } = options;

  try {
    console.log('🔧 开始自动修复数据库...');
    
    if (dryRun) {
      console.log('🔍 [DRY RUN] 模拟修复，不会实际执行');
    }

    const diagnosis = await diagnoseDatabaseIssues(db);
    
    if (!diagnosis.hasIssues) {
      return {
        success: true,
        message: '数据库状态正常，无需修复'
      };
    }

    const repairSteps: string[] = [];

    // Step 1: 状态修复
    console.log('🔧 Step 1: 修复数据库状态...');
    repairSteps.push('检查并修复数据库状态');
    
    if (!dryRun) {
      const repair = new DatabaseStateRepair(db);
      const state = await repair.checkDatabaseState();
      
      if (state.shouldRepair) {
        if (forceReset && targetVersion !== undefined) {
          await repair.forceSetVersion(targetVersion);
          repairSteps.push(`强制设置版本为 v${targetVersion}`);
        } else {
          await repair.repairDatabaseState();
          repairSteps.push('自动修复数据库版本状态');
        }
      }
    }

    // Step 2: 运行迁移
    console.log('🔧 Step 2: 运行数据库迁移...');
    repairSteps.push('运行数据库迁移');
    
    if (!dryRun) {
      await runDatabaseMigration(db);
      repairSteps.push('数据库迁移执行完成');
    }

    // Step 3: 验证修复结果
    console.log('🔧 Step 3: 验证修复结果...');
    const postRepairDiagnosis = await diagnoseDatabaseIssues(db);
    
    if (postRepairDiagnosis.hasIssues) {
      return {
        success: false,
        message: '修复后仍存在问题',
        details: repairSteps,
        error: postRepairDiagnosis.issues.join('; ')
      };
    }

    return {
      success: true,
      message: '数据库修复成功',
      details: repairSteps
    };

  } catch (error) {
    console.error('❌ 数据库修复失败:', error);
    return {
      success: false,
      message: '数据库修复失败',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 重置数据库到指定版本
 */
export async function resetDatabaseToVersion(
  db: Database, 
  version: number
): Promise<RepairResult> {
  try {
    console.log(`🔄 重置数据库到版本 v${version}...`);

    const repair = new DatabaseStateRepair(db);
    await repair.forceSetVersion(version);

    // 运行迁移确保表结构正确
    await runDatabaseMigration(db);

    return {
      success: true,
      message: `数据库已重置到版本 v${version}`,
      details: [
        `强制设置版本为 v${version}`,
        '运行数据库迁移',
        '版本重置完成'
      ]
    };

  } catch (error) {
    console.error('❌ 数据库重置失败:', error);
    return {
      success: false,
      message: '数据库重置失败',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 完全重建数据库
 * 正确流程：删除所有表 -> 从schema中初始化表
 */
export async function rebuildDatabase(db: Database): Promise<RepairResult> {
  try {
    console.log('🏗️ 开始重建数据库...');
    const steps: string[] = [];

    // Step 1: 获取所有表
    console.log('📋 获取现有表结构...');
    type TableRow = { name: string };
    const tables = (await db.select<TableRow>(`
      SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
    `)) as TableRow[];
    
    const userTables = tables.filter(t => !t.name.startsWith('sqlite_')).map(t => t.name);
    console.log(`   发现 ${userTables.length} 个用户表:`, userTables);
    steps.push(`发现 ${userTables.length} 个现有表`);

    // Step 2: 删除所有用户表
    console.log('🗑️ 删除所有现有表...');
    for (const tableName of userTables) {
      console.log(`   删除表: ${tableName}`);
      await db.execute(`DROP TABLE IF EXISTS "${tableName}"`);
    }
    steps.push('删除所有现有表');

    // Step 3: 验证删除结果
    const remainingTables = (await db.select<TableRow>(`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `)) as TableRow[];
    
    if (remainingTables.length > 0) {
      throw new Error(`删除表失败，仍有表存在: ${remainingTables.map(t => t.name).join(', ')}`);
    }
    
    console.log('所有表已删除');
    steps.push('验证表删除完成');

    // Step 4: 重新运行迁移，从头创建表结构
    console.log('🔧 从schema重新初始化表结构...');
    await runDatabaseMigration(db);
    steps.push('从schema重新创建所有表');

    // Step 5: 验证重建结果
    const newTables = (await db.select<TableRow>(`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name
    `)) as TableRow[];
    
    console.log(`数据库重建完成! 重新创建了 ${newTables.length} 个表:`);
    newTables.forEach(table => console.log(`   - ${table.name}`));
    steps.push(`重新创建了 ${newTables.length} 个表`);

    return {
      success: true,
      message: `数据库重建成功，重新创建了 ${newTables.length} 个表`,
      details: steps
    };

  } catch (error) {
    console.error('❌ 数据库重建失败:', error);
    return {
      success: false,
      message: '数据库重建失败',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 快速修复函数（用于紧急情况）
 */
export async function quickFix(db: Database): Promise<RepairResult> {
  console.log('⚡ 执行快速修复...');
  
  return await autoRepairDatabase(db, {
    forceReset: false,
    dryRun: false
  });
}

/**
 * 清空数据库数据（保留表结构）
 */
export async function clearDatabaseData(db: Database): Promise<RepairResult> {
  try {
    console.log('🧹 开始清空数据库数据...');
    const steps: string[] = [];

    // 获取所有用户表
    const tables = (await db.select<TableRow>(`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name
    `)) as TableRow[];

    console.log(`📋 发现 ${tables.length} 个表需要清空:`, tables.map(t => t.name));
    steps.push(`发现 ${tables.length} 个表`);

    // 关闭外键约束（避免删除顺序问题）
    await db.execute('PRAGMA foreign_keys = OFF');
    steps.push('临时关闭外键约束');

    let totalClearedRecords = 0;

    // 清空每个表的数据
    for (const table of tables) {
      try {
        // 获取记录数
        const countResult = await db.select(`SELECT COUNT(*) as count FROM "${table.name}"`);
        const recordCount = countResult[0]?.count || 0;

        if (recordCount > 0) {
          console.log(`   清空表 ${table.name} (${recordCount} 条记录)`);
          await db.execute(`DELETE FROM "${table.name}"`);
          totalClearedRecords += recordCount;
        } else {
          console.log(`   跳过空表 ${table.name}`);
        }
      } catch (error) {
        console.warn(`   清空表 ${table.name} 时出错:`, error);
        steps.push(`清空表 ${table.name} 失败: ${error}`);
      }
    }

    // 重新开启外键约束
    await db.execute('PRAGMA foreign_keys = ON');
    steps.push('重新开启外键约束');

    // 重置自增计数器
    await db.execute('DELETE FROM sqlite_sequence');
    steps.push('重置自增计数器');

    console.log(`数据清空完成! 总共清空了 ${totalClearedRecords} 条记录`);
    steps.push(`清空了 ${totalClearedRecords} 条记录`);

    return {
      success: true,
      message: `数据库数据已清空，共清理 ${totalClearedRecords} 条记录`,
      details: steps
    };

  } catch (error) {
    console.error('❌ 清空数据库数据失败:', error);
    return {
      success: false,
      message: '清空数据库数据失败',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 检查并修复数据库（安全模式）
 */
export async function safeRepair(db: Database): Promise<RepairResult> {
  console.log('🛡️ 执行安全修复...');
  
  // 先进行诊断
  const diagnosis = await diagnoseDatabaseIssues(db);
  
  if (!diagnosis.hasIssues) {
    return {
      success: true,
      message: '数据库状态正常，无需修复'
    };
  }

  // 只修复状态问题，不强制重置
  return await autoRepairDatabase(db, {
    forceReset: false,
    dryRun: false
  });
} 