/**
 * 数据库配置常量
 * 统一管理所有数据库相关配置，避免硬编码
 */

/**
 * 数据库文件名配置
 */
export const DATABASE_CONFIG = {
  /**
   * 主数据库文件名
   * 存储所有业务数据：对话、消息、知识库、文档等
   */
  MAIN_DATABASE: 'mychat.db',
  
  /**
   * 数据库连接超时时间（毫秒）
   */
  CONNECTION_TIMEOUT: 60000, // 增加到60秒
  
  /**
   * 最大重试次数
   */
  MAX_RETRIES: 3,
  
  /**
   * 是否启用 WAL 模式（Write-Ahead Logging）
   * 提高并发性能，推荐启用
   */
  ENABLE_WAL: true,
  
  /**
   * 是否启用外键约束
   * 确保数据完整性，推荐启用
   */
  ENABLE_FOREIGN_KEYS: true,
  
  /**
   * 是否启用日志模式
   */
  ENABLE_JOURNAL_MODE: true,
} as const;

/**
 * 数据库表配置
 * 定义各个功能模块使用的表名
 */
export const DATABASE_TABLES = {
  // 核心聊天功能
  CONVERSATIONS: 'conversations',
  MESSAGES: 'messages',
  
  // 知识库功能
  KNOWLEDGE_BASES: 'knowledge_bases',
  DOCUMENTS: 'documents',
  KNOWLEDGE_CHUNKS: 'knowledge_chunks',
  DOC_KNOWLEDGE_MAPPINGS: 'doc_knowledge_mappings',
  
  // 向量存储
  VECTOR_EMBEDDINGS: 'vector_embeddings',
  
  // 系统表
  SCHEMA_VERSION: 'schema_version',
  SCHEMA_MIGRATIONS: 'schema_migrations',
} as const;

/**
 * 获取数据库连接URI
 */
export function getDatabaseURI(dbName: string = DATABASE_CONFIG.MAIN_DATABASE): string {
  return `sqlite:${dbName}`;
}

/**
 * 获取完整的数据库配置
 */
export function getDefaultDatabaseConfig(dbPath?: string) {
  return {
    dbPath: dbPath || DATABASE_CONFIG.MAIN_DATABASE,
    timeout: DATABASE_CONFIG.CONNECTION_TIMEOUT,
    maxRetries: DATABASE_CONFIG.MAX_RETRIES,
    enableWAL: DATABASE_CONFIG.ENABLE_WAL,
    enableForeignKeys: DATABASE_CONFIG.ENABLE_FOREIGN_KEYS,
    enableJournalMode: DATABASE_CONFIG.ENABLE_JOURNAL_MODE,
  };
}

/**
 * 数据库架构设计说明
 * 
 * ## 单数据库设计原则
 * 
 * 本应用采用单数据库设计，所有数据都存储在 mychat.db 中，原因如下：
 * 
 * ### 优势：
 * 1. **简化管理**：只需要管理一个数据库文件，备份、迁移、维护都更简单
 * 2. **ACID事务**：跨表操作可以在同一个事务中进行，保证数据一致性
 * 3. **性能优化**：SQLite在单文件模式下性能最佳，避免多连接开销
 * 4. **关联查询**：可以高效进行跨模块的关联查询（如对话-知识库关联）
 * 5. **部署简单**：只需要分发一个数据库文件
 * 
 * ### 数据模块划分：
 * - **聊天模块**：conversations, messages
 * - **知识库模块**：knowledge_bases, documents, knowledge_chunks, doc_knowledge_mappings
 * - **向量搜索**：vector_embeddings
 * - **系统管理**：schema_version, schema_migrations
 * 
 * ### 何时考虑多数据库：
 * 1. 数据库文件大小超过 10GB
 * 2. 需要独立的权限控制
 * 3. 有明确的数据隔离需求
 * 4. 性能瓶颈无法通过索引优化解决
 * 
 * ### 当前规模评估：
 * - 预计用户对话数：< 10万条
 * - 预计知识库文档：< 1万个
 * - 预计向量数据：< 100万条
 * - 总存储空间：< 2GB
 * 
 * 在此规模下，单数据库设计是最优选择。
 */ 