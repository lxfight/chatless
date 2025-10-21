import { Migration } from '../types';

// 版本: 7
// 消息版本化：支持重试生成多个版本
export const migration_007: Migration = {
  version: 7,
  name: 'add_message_versioning',
  description: 'Add version_group_id and version_index fields to support message retry versioning',

  up: [
    { type: 'rawSQL', sql: `ALTER TABLE messages ADD COLUMN version_group_id TEXT;` },
    { type: 'rawSQL', sql: `ALTER TABLE messages ADD COLUMN version_index INTEGER DEFAULT 0;` },
    { 
      type: 'rawSQL', 
      sql: `CREATE INDEX IF NOT EXISTS idx_messages_version_group ON messages(version_group_id, version_index) WHERE version_group_id IS NOT NULL;` 
    },
  ],

  down: [
    { type: 'rawSQL', sql: `DROP INDEX IF EXISTS idx_messages_version_group;` },
    // SQLite 不支持 DROP COLUMN，保留字段但删除索引
  ]
};

