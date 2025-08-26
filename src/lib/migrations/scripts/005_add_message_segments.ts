import { Migration } from '../types';

// 版本: 5
// 为 messages 表新增 segments 列（TEXT，存储为 JSON 字符串）。
export const migration_005: Migration = {
  version: 5,
  name: 'add_message_segments',
  description: 'Add segments JSON column to messages table for structured rendering',

  up: [
    {
      type: 'ensureColumns',
      tableName: 'messages',
      columns: [
        { name: 'segments', type: 'TEXT' }
      ]
    }
  ],

  down: [
    { type: 'rawSQL', sql: `-- SQLite does not support dropping columns easily; keep segments column.` }
  ]
};

