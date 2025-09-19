import { Migration } from '../types';

// 版本: 6
// 核心索引：提升常见查询/排序性能（非功能性变更）
export const migration_006: Migration = {
  version: 6,
  name: 'add_core_indexes',
  description: 'Add indexes for common queries and sorts on conversations and messages',

  up: [
    { type: 'rawSQL', sql: `CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at);` },
    { type: 'rawSQL', sql: `CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at);` },
    { type: 'rawSQL', sql: `CREATE INDEX IF NOT EXISTS idx_conversations_favorite ON conversations(is_favorite);` },
    { type: 'rawSQL', sql: `CREATE INDEX IF NOT EXISTS idx_conversations_important ON conversations(is_important);` },
  ],

  down: [
    { type: 'rawSQL', sql: `DROP INDEX IF EXISTS idx_messages_conversation_created;` },
    { type: 'rawSQL', sql: `DROP INDEX IF EXISTS idx_conversations_updated;` },
    { type: 'rawSQL', sql: `DROP INDEX IF EXISTS idx_conversations_favorite;` },
    { type: 'rawSQL', sql: `DROP INDEX IF EXISTS idx_conversations_important;` },
  ]
};


