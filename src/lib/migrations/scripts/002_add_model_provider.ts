import { Migration } from '../types';

// 版本: 2
// 为 conversations 与 messages 新增 provider 与 full_id 字段，用于精确还原模型
export const migration_002: Migration = {
  version: 2,
  name: 'add_model_provider_fields',
  description: 'Add model_provider and model_full_id to conversations and messages',

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
    }
  ],

  down: [
    { type: 'rawSQL', sql: `-- SQLite cannot drop columns directly; no-op rollback.` }
  ]
};


