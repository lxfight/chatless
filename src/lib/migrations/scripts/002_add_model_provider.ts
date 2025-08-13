import { Migration } from '../types';

// 版本: 2
// 合并后：
// - 为 conversations 与 messages 新增 provider 与 full_id 字段
// - 创建 prompts 表（包含 shortcuts 字段）
export const migration_002: Migration = {
  version: 2,
  name: 'add_model_provider_fields',
  description: 'Add model_provider/full_id to core tables, and create prompts table (merged 003+004)',

  up: [
    {
      type: 'ensureColumns',
      tableName: 'conversations',
      columns: [
        { name: 'model_provider', type: 'TEXT' },
        { name: 'model_full_id', type: 'TEXT' }
      ]
    },
    {
      type: 'ensureColumns',
      tableName: 'messages',
      columns: [
        { name: 'model_provider', type: 'TEXT' },
        { name: 'model_full_id', type: 'TEXT' }
      ]
    },
    // 创建 prompts 表（包含 shortcuts 字段）
    {
      type: 'createTable',
      table: {
        name: 'prompts',
        columns: [
          { name: 'id', type: 'TEXT', primaryKey: true },
          { name: 'name', type: 'TEXT', notNull: true },
          { name: 'description', type: 'TEXT' },
          { name: 'content', type: 'TEXT', notNull: true },
          { name: 'tags', type: 'TEXT' },
          { name: 'languages', type: 'TEXT' },
          { name: 'model_hints', type: 'TEXT' },
          { name: 'variables', type: 'TEXT' },
          { name: 'shortcuts', type: 'TEXT' },
          { name: 'favorite', type: 'BOOLEAN', defaultValue: 0 },
          { name: 'created_at', type: 'INTEGER', notNull: true },
          { name: 'updated_at', type: 'INTEGER', notNull: true },
          { name: 'external_id', type: 'TEXT' },
          { name: 'stats', type: 'TEXT' }
        ],
        indexes: [
          { name: 'idx_prompts_name', columns: ['name'], unique: false }
        ]
      }
    },
    // 兜底：如果已有 prompts 表但缺少新列则补齐
    {
      type: 'ensureColumns',
      tableName: 'prompts',
      columns: [
        { name: 'model_hints', type: 'TEXT' },
        { name: 'shortcuts', type: 'TEXT' }
      ]
    }
  ],

  down: [
    { type: 'dropTable', tableName: 'prompts' },
    { type: 'rawSQL', sql: `-- SQLite cannot drop columns directly; no-op rollback for added columns.` }
  ]
};


