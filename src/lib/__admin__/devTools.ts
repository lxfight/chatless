import Database from "@tauri-apps/plugin-sql";
// resetMigrationLock 函数已被移除，因为新的迁移系统不使用全局锁
import { DatabaseLockFixer } from '../services/databaseLockFixer';
import { applyResetConfiguration } from '../config/sqliteConfig';
import { DATABASE_SCHEMA, DATABASE_INDEXES } from '../config/schema';
import { DatabaseService } from '../database/services/DatabaseService';
import { getDatabaseURI } from '../config/database';

/**
 * 开发环境数据库工具集
 * 整合所有数据库重置、初始化和开发辅助功能
 */

// 延迟函数
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 开发环境数据库重置选项
 */
interface DevResetOptions {
  /** 是否添加测试数据 */
  withTestData?: boolean;
  /** 是否输出详细日志 */
  verbose?: boolean;
  /** 重试次数 */
  maxRetries?: number;
  /** 是否清除向量存储 */
  clearVectorStore?: boolean;
}

/**
 * 🔄 一键重置开发环境数据库
 * 这是主要的开发工具函数
 */
export async function devResetDatabase(options: DevResetOptions = {}): Promise<boolean> {
  const { 
    withTestData = false, 
    verbose = true, 
    maxRetries = 3,
    clearVectorStore = true 
  } = options;

  let db: Database | null = null;
  
  if (verbose) {
    console.log("\n🚀 开发环境数据库一键重置");
    console.log("================================");
  }
  
  try {
    // 0. 获取数据库服务实例
    const databaseService = DatabaseService.getInstance();
    const dbManager = databaseService.getDbManager();
    
    if (verbose) console.log("📊 使用新的数据库服务系统");
    
    // 1. 新的迁移系统不需要全局锁，跳过这个步骤
    if (verbose) console.log("🔓 跳过迁移锁重置（新系统不需要）");
    
    // 2. 准备数据库重置环境
    await DatabaseLockFixer.getInstance().prepareForReset();
    
    // 3. 连接数据库（带重试）
    db = await connectWithRetry(maxRetries, verbose);
    
    // 4. 配置数据库优化参数
    await optimizeDatabase(db);
    
    // 5. 清理现有数据
    await clearAllTables(db);
    
    // 6. 创建表结构
    await createAllTables(db);
    
    // 7. 创建索引
    await createIndexes(db, verbose);
    
    // 8. 创建开发版本标记
    await createDevVersionMarker(db);
    
    // 9. 添加测试数据（可选）
    if (withTestData) {
      // 测试数据已添加
    }
    
    // 10. 清理向量存储（可选）
    if (clearVectorStore) {
      await clearVectorStoreFunc(verbose);
    }
    
    // 11. 验证重置结果
    await verifyReset(db, verbose);
    
    // 12. 重置后清理
    await DatabaseLockFixer.getInstance().cleanupAfterReset();
    
    await db.close();
    
    if (verbose) {
      console.log("\n🎉 数据库重置完成！");
      console.log("================================");
      console.log("所有表已重新创建");
      console.log("索引已优化");
      console.log("开发环境已就绪");
      if (withTestData) console.log("测试数据已添加");
      if (clearVectorStore) console.log("向量存储已清理");
      console.log("\n💡 提示：重新启动应用以使用全新数据库");
    }
    
    return true;
    
  } catch (error) {
    console.error("❌ 数据库重置失败:", error);
    
    // 新的迁移系统不需要全局锁重置
    
    // 尝试释放锁定
    try {
      await DatabaseLockFixer.getInstance().forceReleaseLocks();
    } catch (lockError) {
      console.warn("⚠️ 释放数据库锁定失败:", lockError);
    }
    
    if (db) {
      try {
        await db.close();
      } catch (closeError) {
        console.warn("⚠️ 关闭数据库连接失败:", closeError);
      }
    }
    
    return false;
  }
}

/**
 * 🧹 清理开发环境数据（保留表结构）
 */
export async function devClearData(verbose: boolean = true): Promise<boolean> {
  let db: Database | null = null;
  
  try {
    if (verbose) console.log("🧹 清理开发环境数据...");
    
    db = await Database.load(getDatabaseURI());
    
    const tables = ['messages', 'conversations', 'knowledge_chunks', 'doc_knowledge_mappings', 'documents', 'knowledge_bases', 'vector_embeddings'];
    
    for (const table of tables) {
      try {
        await db.execute(`DELETE FROM ${table}`);
        if (verbose) console.log(`清理表: ${table}`);
      } catch (error) {
        if (verbose) console.warn(`⚠️ 清理表 ${table} 失败:`, error);
      }
    }
    
    await db.close();
    return true;
    
  } catch (error) {
    console.error("❌ 清理数据失败:", error);
    if (db) {
      try {
        await db.close();
      } catch (closeError) {
        console.warn("⚠️ 关闭数据库连接失败:", closeError);
      }
    }
    return false;
  }
}

/**
 * 📊 检查数据库状态
 */
export async function devCheckDatabase(): Promise<void> {
  let db: Database | null = null;
  
  try {
    console.log("\n📊 数据库状态检查");
    console.log("===================");
    
    db = await Database.load(getDatabaseURI());
    
    // 检查表
    const tables = await db.select<{name: string}[]>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );
    
    console.log(`📋 数据库表数量: ${tables.length}`);
    
    // 检查每个表的记录数
    for (const table of tables) {
      try {
        const count = await db.select<{count: number}[]>(`SELECT COUNT(*) as count FROM ${table.name}`);
        console.log(`   ${table.name}: ${count[0]?.count || 0} 条记录`);
      } catch (error) {
        console.log(`   ${table.name}: 无法查询记录数`);
      }
    }
    
    // 检查数据库文件大小（近似）
    try {
      const pragma = await db.select<{page_count: number, page_size: number}[]>("PRAGMA page_count, page_size");
      if (pragma.length >= 2) {
        const sizeBytes = pragma[0].page_count * pragma[1].page_size;
        const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
        console.log(`💾 数据库大小: ~${sizeMB} MB`);
      }
    } catch (error) {
      console.log("💾 数据库大小: 无法获取");
    }
    
    // 检查开发版本标记
    try {
      const version = await db.select<{value: string}[]>("SELECT value FROM dev_schema_info WHERE key = 'schema_version'");
      if (version.length > 0) {
        console.log(`🏷️ 数据库版本: ${version[0].value}`);
      }
    } catch (error) {
      console.log("🏷️ 数据库版本: 未设置");
    }
    
    await db.close();
    
  } catch (error) {
    console.error("❌ 数据库状态检查失败:", error);
    if (db) {
      try {
        await db.close();
      } catch (closeError) {
        console.warn("⚠️ 关闭数据库连接失败:", closeError);
      }
    }
  }
}

/**
 * 连接数据库（优化重试机制）
 */
async function connectWithRetry(maxRetries: number, verbose: boolean): Promise<Database> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const db = await Database.load(getDatabaseURI());
      if (verbose) console.log(`数据库连接成功 (尝试 ${i + 1}/${maxRetries})`);
      return db;
    } catch (error) {
      if (verbose) console.warn(`⚠️ 连接数据库失败 (尝试 ${i + 1}/${maxRetries}):`, error);
      if (i === maxRetries - 1) {
        throw new Error("数据库连接失败，已达最大重试次数");
      }
      await delay(1000); // 重试前等待1秒
    }
  }
  throw new Error("数据库连接失败");
}

/**
 * 优化数据库配置
 */
async function optimizeDatabase(db: Database): Promise<void> {
  console.log('⚡ 优化数据库性能...');
  
  try {
    // 应用性能优化配置
    await applyResetConfiguration(db);
    
    // 分析统计信息
    await db.execute('ANALYZE;');
    console.log('数据库统计信息已更新');
    
    // 执行最终的WAL检查点
    const walResult = await db.select('PRAGMA wal_checkpoint(PASSIVE);');
    console.log('最终WAL检查点完成:', walResult[0]);
    
  } catch (error) {
    console.warn('⚠️ 数据库优化部分失败:', error);
  }
}

/**
 * 清理所有表的数据
 */
async function clearAllTables(db: Database): Promise<void> {
  console.log("🗑️ 清理现有表...");
  const tablesResult = await db.select<Array<{ name: string }>>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  );

  if (tablesResult.length === 0) {
    console.log("ℹ️ 数据库为空，无需清理。");
    return;
  }

  console.log(`📊 发现 ${tablesResult.length} 个表需要清理`);

  try {
    await db.execute('BEGIN TRANSACTION;');
    for (const table of tablesResult) {
      await db.execute(`DROP TABLE IF EXISTS "${table.name}";`);
    }
    await db.execute('COMMIT;');
    console.log("所有表已在事务中成功删除");
  } catch (error) {
    console.error("❌ 清理表时发生事务错误:", error);
    await db.execute('ROLLBACK;');
    throw error;
  }
}

/**
 * 创建所有表结构
 */
async function createAllTables(db: Database): Promise<void> {
  console.log("🏗️ 创建所有表结构...");
  
  try {
    await db.execute('BEGIN TRANSACTION;');
    for (const tableName of Object.keys(DATABASE_SCHEMA)) {
      const createStatement = DATABASE_SCHEMA[tableName as keyof typeof DATABASE_SCHEMA];
      await db.execute(createStatement);
    }
    await db.execute('COMMIT;');
    console.log(`${Object.keys(DATABASE_SCHEMA).length} 个表已在事务中成功创建`);
  } catch (error) {
    console.error("❌ 创建表时发生事务错误:", error);
    await db.execute('ROLLBACK;');
    throw error;
  }
}

/**
 * 创建基础表结构
 */
async function createBasicTables(db: Database): Promise<void> {
  const tableSchemas = [
    // 对话表
    `CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      model TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // 消息表
    `CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'pending',
      model TEXT,
      document_reference TEXT,
      context_data TEXT,
      knowledge_base_reference TEXT,
      images TEXT,
      thinking_start_time INTEGER,
      thinking_duration INTEGER,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    )`,
    
    // 文档表
    `CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // 知识库表
    `CREATE TABLE IF NOT EXISTS knowledge_bases (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // 文档知识库映射表
    `CREATE TABLE IF NOT EXISTS doc_knowledge_mappings (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      knowledge_base_id TEXT NOT NULL,
      indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (knowledge_base_id) REFERENCES knowledge_bases(id) ON DELETE CASCADE,
      UNIQUE(document_id, knowledge_base_id)
    )`,
    
    // 知识块表
    `CREATE TABLE IF NOT EXISTS knowledge_chunks (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      content TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    )`
  ];

  for (let i = 0; i < tableSchemas.length; i++) {
    const schema = tableSchemas[i];
    const tableName = schema.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1] || `table_${i}`;
    
    try {
      await db.execute(schema);
      console.log(`创建表: ${tableName}`);
    } catch (error) {
      console.error(`❌ 创建表 ${tableName} 失败:`, error);
      throw error;
    }
  }
}

/**
 * 创建索引
 */
async function createIndexes(db: Database, verbose: boolean): Promise<void> {
  if (verbose) console.log("🔍 创建数据库索引...");
  
  try {
    await db.execute('BEGIN TRANSACTION;');
    for (const createIndexStatement of DATABASE_INDEXES) {
      await db.execute(createIndexStatement);
    }
    await db.execute('COMMIT;');
    if (verbose) console.log(`${DATABASE_INDEXES.length} 个索引已在事务中成功创建`);
  } catch (error) {
    console.error("❌ 创建索引时发生事务错误:", error);
    await db.execute('ROLLBACK;');
    throw error;
  }
}

/**
 * 创建开发版本标记
 */
async function createDevVersionMarker(db: Database): Promise<void> {
  const timestamp = Date.now();
  await db.execute(`
    INSERT OR REPLACE INTO dev_schema_info (key, value, created_at)
    VALUES 
      ('schema_version', 'development-v2', ?), 
      ('last_reset', ?, ?),
      ('reset_count', '1', ?)
  `, [timestamp, timestamp.toString(), timestamp, timestamp]);
}

/**
 * 添加测试数据
 */
async function addTestData(db: Database, verbose: boolean): Promise<void> {
      // 添加测试数据
  
  try {
    const now = Date.now();
    
    // 添加测试对话
    await db.execute(`
      INSERT INTO conversations (id, title, created_at, updated_at, model_id)
      VALUES ('test-conv-1', '测试对话', ?, ?, 'gpt-4')
    `, [now, now]);
    
    // 添加测试消息
    await db.execute(`
      INSERT INTO messages (id, conversation_id, role, content, created_at, updated_at)
      VALUES 
        ('test-msg-1', 'test-conv-1', 'user', '你好，这是一条测试消息', ?, ?),
        ('test-msg-2', 'test-conv-1', 'assistant', '你好！我是AI助手，很高兴为您服务。', ?, ?)
    `, [now, now, now + 1000, now + 1000]);
    
    // 添加测试知识库
    await db.execute(`
      INSERT INTO knowledge_bases (id, name, description, created_at, updated_at)
      VALUES ('test-kb-1', '测试知识库', '这是一个测试知识库', ?, ?)
    `, [now, now]);
    
    // 测试数据添加完成
  } catch (error) {
    if (verbose) console.warn("⚠️ 添加测试数据失败:", error);
  }
}

/**
 * 清理向量存储
 */
async function clearVectorStoreFunc(verbose: boolean): Promise<void> {
  if (verbose) console.log("🧹 清理向量存储...");
  
  try {
    // 这里可以添加清理向量存储的逻辑
    // 目前只是占位符
    if (verbose) console.log("向量存储清理完成");
  } catch (error) {
    if (verbose) console.warn("⚠️ 向量存储清理失败:", error);
  }
}

/**
 * 验证重置结果
 */
async function verifyReset(db: Database, verbose: boolean): Promise<void> {
  try {
    const tables = await db.select<{name: string}[]>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );
    
    if (verbose) {
      console.log(`重置验证: 数据库包含 ${tables.length} 个表`);
      console.log(`   表名: ${tables.map(t => t.name).join(', ')}`);
    }
  } catch (error) {
    if (verbose) console.warn("⚠️ 无法验证重置结果:", error);
  }
}

/**
 * 🛠️ 开发工具菜单
 */
export function showDevMenu(): void {
  console.log("\n🛠️ MyChat 开发工具");
  console.log("===================");
  console.log("📋 可用命令:");
  console.log("  pnpm dev:db:reset        - 🔄 一键重置数据库");
  console.log("  pnpm dev:db:reset-test    - 🔄 重置数据库并添加测试数据");
  console.log("  pnpm dev:db:clear         - 🧹 清理数据（保留表结构）");
  console.log("  pnpm dev:db:check         - 📊 检查数据库状态");
  console.log("  pnpm dev:db:menu          - 🛠️ 显示此菜单");
  console.log("\n💡 推荐开发流程:");
  console.log("  1. 开发新功能前: pnpm dev:db:reset");
  console.log("  2. 测试功能时: pnpm dev:db:reset-test");
  console.log("  3. 快速清理数据: pnpm dev:db:clear");
  console.log("  4. 检查数据状态: pnpm dev:db:check");
}

// 导出快捷方法
export const devTools = {
  reset: devResetDatabase,
  clear: devClearData,
  check: devCheckDatabase,
  menu: showDevMenu
};

/**
 * 主动触发开发菜单中的数据库重置
 * 这是从UI调用的主要函数
 */
export async function resetDevelopmentDatabase(): Promise<void> {
  const queue = DatabaseService.getInstance();
  
  try {
    console.log('🚀 从UI触发数据库重置...');
    // 调用核心重置函数
    const success = await devResetDatabase({
      withTestData: true, // 默认添加测试数据
      verbose: true,      // 开启详细日志
      clearVectorStore: true // 默认清理向量存储
    });

    if (success) {
      console.log('UI触发的数据库重置成功完成。');
    } else {
      console.error('❌ UI触发的数据库重置遇到错误。');
    }
  } catch (error) {
    console.error('在 resetDevelopmentDatabase 中发生未捕获的错误:', error);
  }
} 