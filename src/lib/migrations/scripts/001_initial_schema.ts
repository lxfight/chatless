import { Migration } from '../types';

/**
 * 初始数据库结构迁移
 * 版本: 1
 * 描述: 创建基础表结构 - conversations, messages, documents 等
 */
export const migration_001: Migration = {
  version: 1,
  name: 'initial_schema',
  description: '创建基础表结构 - conversations, messages, documents 等',
  
  up: [
    // 创建 conversations 表
    {
      type: 'createTable',
      table: {
        name: 'conversations',
        columns: [
          { name: 'id', type: 'TEXT', primaryKey: true },
          { name: 'title', type: 'TEXT', notNull: true },
          { name: 'created_at', type: 'INTEGER', notNull: true },
          { name: 'updated_at', type: 'INTEGER', notNull: true },
          { name: 'model_id', type: 'TEXT', notNull: true },
          { name: 'is_important', type: 'BOOLEAN', defaultValue: 0 },
          { name: 'is_favorite', type: 'BOOLEAN', defaultValue: 0 }
        ]
      }
    },

    // 创建 messages 表
    {
      type: 'createTable',
      table: {
        name: 'messages',
        columns: [
          { name: 'id', type: 'TEXT', primaryKey: true },
          { name: 'conversation_id', type: 'TEXT', notNull: true },
          { name: 'role', type: 'TEXT', notNull: true, check: "role IN ('user', 'assistant')" },
          { name: 'content', type: 'TEXT', notNull: true },
          { name: 'created_at', type: 'INTEGER', notNull: true },
          { name: 'updated_at', type: 'INTEGER', notNull: true },
          { name: 'status', type: 'TEXT', notNull: true, defaultValue: 'pending' },
          { name: 'model', type: 'TEXT' },
          { name: 'document_reference', type: 'TEXT' },
          { name: 'context_data', type: 'TEXT' },
          { name: 'knowledge_base_reference', type: 'TEXT' },
          { name: 'images', type: 'TEXT' },
          { name: 'thinking_start_time', type: 'INTEGER' },
          { name: 'thinking_duration', type: 'INTEGER' }
        ],
        foreignKeys: [
          {
            column: 'conversation_id',
            referencedTable: 'conversations',
            referencedColumn: 'id',
            onDelete: 'CASCADE'
          }
        ]
      }
    },

    // 创建 documents 表
    {
      type: 'createTable',
      table: {
        name: 'documents',
        columns: [
          { name: 'id', type: 'TEXT', primaryKey: true },
          { name: 'title', type: 'TEXT', notNull: true },
          { name: 'file_path', type: 'TEXT', notNull: true },
          { name: 'file_type', type: 'TEXT', notNull: true },
          { name: 'file_size', type: 'INTEGER', notNull: true },
          { name: 'created_at', type: 'INTEGER', notNull: true },
          { name: 'updated_at', type: 'INTEGER', notNull: true },
          { name: 'tags', type: 'TEXT' },
          { name: 'folder_path', type: 'TEXT' },
          { name: 'is_indexed', type: 'BOOLEAN', defaultValue: 0 }
        ]
      }
    },

    // 创建 knowledge_bases 表
    {
      type: 'createTable',
      table: {
        name: 'knowledge_bases',
        columns: [
          { name: 'id', type: 'TEXT', primaryKey: true },
          { name: 'name', type: 'TEXT', notNull: true },
          { name: 'description', type: 'TEXT' },
          { name: 'icon', type: 'TEXT', defaultValue: 'database' },
          { name: 'is_encrypted', type: 'BOOLEAN', defaultValue: 0 },
          { name: 'created_at', type: 'INTEGER', notNull: true },
          { name: 'updated_at', type: 'INTEGER', notNull: true }
        ]
      }
    },

    // 创建 knowledge_chunks 表
    {
      type: 'createTable',
      table: {
        name: 'knowledge_chunks',
        columns: [
          { name: 'id', type: 'TEXT', primaryKey: true },
          { name: 'knowledge_base_id', type: 'TEXT', notNull: true },
          { name: 'document_id', type: 'TEXT', notNull: true },
          { name: 'content', type: 'TEXT', notNull: true },
          { name: 'chunk_index', type: 'INTEGER', notNull: true },
          { name: 'content_hash', type: 'TEXT', notNull: true },
          { name: 'embedding', type: 'BLOB' },
          { name: 'metadata', type: 'TEXT' },
          { name: 'created_at', type: 'INTEGER', notNull: true }
        ],
        foreignKeys: [
          {
            column: 'knowledge_base_id',
            referencedTable: 'knowledge_bases',
            referencedColumn: 'id',
            onDelete: 'CASCADE'
          },
          {
            column: 'document_id',
            referencedTable: 'documents',
            referencedColumn: 'id',
            onDelete: 'CASCADE'
          }
        ]
      }
    },

    // 创建 doc_knowledge_mappings 表
    {
      type: 'createTable',
      table: {
        name: 'doc_knowledge_mappings',
        columns: [
          { name: 'id', type: 'TEXT', primaryKey: true },
          { name: 'document_id', type: 'TEXT', notNull: true },
          { name: 'knowledge_base_id', type: 'TEXT', notNull: true },
          { name: 'indexed_at', type: 'INTEGER', notNull: true },
          { name: 'status', type: 'TEXT', notNull: true, defaultValue: 'pending', 
            check: "status IN ('pending', 'indexing', 'indexed', 'failed')" }
        ],
        foreignKeys: [
          {
            column: 'document_id',
            referencedTable: 'documents',
            referencedColumn: 'id',
            onDelete: 'CASCADE'
          },
          {
            column: 'knowledge_base_id',
            referencedTable: 'knowledge_bases',
            referencedColumn: 'id',
            onDelete: 'CASCADE'
          }
        ],
        indexes: [
          {
            name: 'idx_doc_knowledge_unique',
            columns: ['document_id', 'knowledge_base_id'],
            unique: true
          }
        ]
      }
    }
  ],

  // 回滚操作（按相反顺序删除表）
  down: [
    { type: 'dropTable', tableName: 'doc_knowledge_mappings' },
    { type: 'dropTable', tableName: 'knowledge_chunks' },
    { type: 'dropTable', tableName: 'knowledge_bases' },
    { type: 'dropTable', tableName: 'documents' },
    { type: 'dropTable', tableName: 'messages' },
    { type: 'dropTable', tableName: 'conversations' }
  ]
}; 