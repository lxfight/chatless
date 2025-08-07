import Database from "@tauri-apps/plugin-sql";
import { getDatabaseService } from '../db';

/**
 * 数据库诊断和修复工具
 * 用于检测和修复数据库相关问题
 */
export class DatabaseDiagnostic {
  private db: Database | null = null;

  /**
   * 初始化诊断工具
   */
  async initialize(): Promise<void> {
    try {
      const dbService = getDatabaseService();
      this.db = dbService.getDbManager().getDatabase();
      console.log('数据库诊断工具初始化成功');
    } catch (error) {
      console.error('❌ 数据库诊断工具初始化失败:', error);
      throw error;
    }
  }

  /**
   * 检查数据库表结构
   */
  async checkTableStructure(): Promise<void> {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    console.log('🔍 检查数据库表结构...');

    // 检查 conversations 表
    const conversationsSchema = await this.db.select("PRAGMA table_info(conversations)") as Array<{
      name: string;
      type: string;
      notnull: number;
      dflt_value: any;
      pk: number;
    }>;

    console.log('📋 Conversations 表结构:');
    conversationsSchema.forEach(col => {
      console.log(`  - ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
    });

    // 检查 messages 表
    const messagesSchema = await this.db.select("PRAGMA table_info(messages)") as Array<{
      name: string;
      type: string;
      notnull: number;
      dflt_value: any;
      pk: number;
    }>;

    console.log('📋 Messages 表结构:');
    messagesSchema.forEach(col => {
      console.log(`  - ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
    });

    // 检查外键关系
    const foreignKeys = await this.db.select("PRAGMA foreign_key_list(messages)") as Array<{
      table: string;
      from: string;
      to: string;
    }>;

    console.log('🔗 Messages 表外键关系:');
    foreignKeys.forEach(fk => {
      console.log(`  - ${fk.from} -> ${fk.table}.${fk.to}`);
    });
  }

  /**
   * 检查数据完整性
   */
  async checkDataIntegrity(): Promise<void> {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    console.log('🔍 检查数据完整性...');

    // 检查会话数量
    const conversationCount = await this.db.select("SELECT COUNT(*) as count FROM conversations");
    console.log(`📊 总会话数: ${(conversationCount as any)[0]?.count || 0}`);

    // 检查消息数量
    const messageCount = await this.db.select("SELECT COUNT(*) as count FROM messages");
    console.log(`📊 总消息数: ${(messageCount as any)[0]?.count || 0}`);

    // 检查孤立消息（没有对应会话的消息）
    const orphanMessages = await this.db.select(`
      SELECT COUNT(*) as count 
      FROM messages 
      WHERE conversation_id NOT IN (SELECT id FROM conversations)
    `);
    console.log(`⚠️ 孤立消息数: ${(orphanMessages as any)[0]?.count || 0}`);

    // 检查知识库数量
    try {
      const knowledgeBaseCount = await this.db.select("SELECT COUNT(*) as count FROM knowledge_bases");
      console.log(`📊 总知识库数: ${(knowledgeBaseCount as any)[0]?.count || 0}`);
    } catch (error) {
      console.log('⚠️ 知识库表不存在或有问题');
    }
  }

  /**
   * 修复孤立消息
   */
  async fixOrphanMessages(): Promise<void> {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    console.log('🔧 修复孤立消息...');

    const orphanMessages = await this.db.select(`
      SELECT * 
      FROM messages 
      WHERE conversation_id NOT IN (SELECT id FROM conversations)
    `);

    if ((orphanMessages as any[]).length === 0) {
      console.log('没有发现孤立消息');
      return;
    }

    console.log(`🔧 发现 ${(orphanMessages as any[]).length} 条孤立消息，开始修复...`);

    
    // 删除孤立消息
    await this.db.execute(`
      DELETE FROM messages 
      WHERE conversation_id NOT IN (SELECT id FROM conversations)
    `);

    console.log('孤立消息已清理');
  }

  /**
   * 修复数据库结构问题
   */
  async fixDatabaseStructure(): Promise<void> {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    console.log('🔧 检查并修复数据库结构...');

    // 检查 messages 表是否有 knowledge_base_reference 字段
    const messagesSchema = await this.db.select("PRAGMA table_info(messages)") as Array<{
      name: string;
    }>;

    const hasKnowledgeBaseRef = messagesSchema.some(col => col.name === 'knowledge_base_reference');
    if (!hasKnowledgeBaseRef) {
      console.log('🔧 添加 knowledge_base_reference 字段...');
      await this.db.execute("ALTER TABLE messages ADD COLUMN knowledge_base_reference TEXT");
      console.log('knowledge_base_reference 字段已添加');
    } else {
      console.log('knowledge_base_reference 字段已存在');
    }

    // 检查知识库表是否存在
    try {
      await this.db.select("SELECT 1 FROM knowledge_bases LIMIT 1");
      console.log('knowledge_bases 表已存在');
    } catch (error) {
      console.log('🔧 创建 knowledge_bases 表...');
      await this.db.execute(`
        CREATE TABLE IF NOT EXISTS knowledge_bases (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          icon TEXT DEFAULT 'database',
          is_encrypted BOOLEAN DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);
      console.log('knowledge_bases 表已创建');
    }
  }

  /**
   * 检查外键约束和数据一致性
   */
  async checkForeignKeyConstraints(): Promise<void> {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    console.log('🔍 检查外键约束和数据一致性...');

    try {
      // 检查文档表
      const documents = await this.db.select("SELECT id, title FROM documents LIMIT 10") as Array<{
        id: string;
        title: string;
      }>;
      console.log(`📄 documents 表中有 ${documents.length} 个文档`);
      if (documents.length > 0) {
        console.log(`   样例文档ID: ${documents[0].id} (${documents[0].title})`);
      }

      // 检查知识库表
      const knowledgeBases = await this.db.select("SELECT id, name FROM knowledge_bases LIMIT 10") as Array<{
        id: string;
        name: string;
      }>;
      console.log(`📚 knowledge_bases 表中有 ${knowledgeBases.length} 个知识库`);
      if (knowledgeBases.length > 0) {
        console.log(`   样例知识库ID: ${knowledgeBases[0].id} (${knowledgeBases[0].name})`);
      }

      // 检查映射表
      const mappings = await this.db.select("SELECT * FROM doc_knowledge_mappings LIMIT 10") as Array<{
        id: string;
        document_id: string;
        knowledge_base_id: string;
        status: string;
      }>;
      console.log(`🔗 doc_knowledge_mappings 表中有 ${mappings.length} 个映射`);

      // 检查映射表中的外键是否有效
      if (mappings.length > 0) {
        for (const mapping of mappings) {
          // 检查document_id是否存在
          const docExists = await this.db.select(
            "SELECT 1 FROM documents WHERE id = ?", 
            [mapping.document_id]
          ) as Array<any>;
          
          // 检查knowledge_base_id是否存在
          const kbExists = await this.db.select(
            "SELECT 1 FROM knowledge_bases WHERE id = ?", 
            [mapping.knowledge_base_id]
          ) as Array<any>;
          
          if (docExists.length === 0) {
            console.error(`❌ 映射 ${mapping.id} 引用的文档 ${mapping.document_id} 不存在`);
          }
          
          if (kbExists.length === 0) {
            console.error(`❌ 映射 ${mapping.id} 引用的知识库 ${mapping.knowledge_base_id} 不存在`);
          }
        }
      }

      // 检查外键约束设置
      const foreignKeys = await this.db.select("PRAGMA foreign_key_list(doc_knowledge_mappings)") as Array<{
        id: number;
        seq: number;
        table: string;
        from: string;
        to: string;
        on_update: string;
        on_delete: string;
        match: string;
      }>;
      
      console.log('🔗 doc_knowledge_mappings 表的外键约束:');
      foreignKeys.forEach(fk => {
        console.log(`   ${fk.from} -> ${fk.table}.${fk.to} (DELETE: ${fk.on_delete})`);
      });

      // 检查外键约束是否启用
      const fkEnabled = await this.db.select("PRAGMA foreign_keys") as Array<{ foreign_keys: number }>;
      console.log(`🔒 外键约束状态: ${fkEnabled[0]?.foreign_keys ? '启用' : '禁用'}`);

    } catch (error) {
      console.error('❌ 检查外键约束失败:', error);
      throw error;
    }
  }

  /**
   * 修复外键约束问题
   */
  async fixForeignKeyConstraints(): Promise<void> {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    console.log('🔧 开始修复外键约束问题...');

    try {
      // 检查并删除无效的映射记录
      const invalidMappings = await this.db.select(`
        SELECT dkm.id, dkm.document_id, dkm.knowledge_base_id
        FROM doc_knowledge_mappings dkm
        LEFT JOIN documents d ON d.id = dkm.document_id
        LEFT JOIN knowledge_bases kb ON kb.id = dkm.knowledge_base_id
        WHERE d.id IS NULL OR kb.id IS NULL
      `) as Array<{
        id: string;
        document_id: string;
        knowledge_base_id: string;
      }>;

      if (invalidMappings.length > 0) {
        console.log(`🗑️ 发现 ${invalidMappings.length} 个无效的映射记录，准备删除:`);
        
        for (const mapping of invalidMappings) {
          console.log(`   删除映射: ${mapping.id} (doc: ${mapping.document_id}, kb: ${mapping.knowledge_base_id})`);
          await this.db.execute(
            "DELETE FROM doc_knowledge_mappings WHERE id = ?",
            [mapping.id]
          );
        }
        
        console.log('无效映射记录清理完成');
      } else {
        console.log('未发现无效的映射记录');
      }

      // 检查知识片段的外键约束
      const invalidChunks = await this.db.select(`
        SELECT kc.id, kc.document_id, kc.knowledge_base_id
        FROM knowledge_chunks kc
        LEFT JOIN documents d ON d.id = kc.document_id
        LEFT JOIN knowledge_bases kb ON kb.id = kc.knowledge_base_id
        WHERE d.id IS NULL OR kb.id IS NULL
      `) as Array<{
        id: string;
        document_id: string;
        knowledge_base_id: string;
      }>;

      if (invalidChunks.length > 0) {
        console.log(`🗑️ 发现 ${invalidChunks.length} 个无效的知识片段，准备删除:`);
        
        for (const chunk of invalidChunks) {
          console.log(`   删除知识片段: ${chunk.id} (doc: ${chunk.document_id}, kb: ${chunk.knowledge_base_id})`);
          await this.db.execute(
            "DELETE FROM knowledge_chunks WHERE id = ?",
            [chunk.id]
          );
        }
        
        console.log('无效知识片段清理完成');
      } else {
        console.log('未发现无效的知识片段');
      }

    } catch (error) {
      console.error('❌ 修复外键约束失败:', error);
      throw error;
    }
  }

  /**
   * 完整的数据库修复流程
   */
  async fullRepair(): Promise<void> {
    try {
      console.log('🔧 开始完整的数据库修复流程...');
      
      await this.initialize();
      await this.checkTableStructure();
      await this.checkForeignKeyConstraints();
      await this.fixForeignKeyConstraints();
      await this.checkForeignKeyConstraints(); // 再次检查确认修复成功
      
      console.log('完整的数据库修复流程完成');
    } catch (error) {
      console.error('❌ 数据库修复失败:', error);
      throw error;
    }
  }
}
