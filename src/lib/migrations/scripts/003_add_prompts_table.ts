import { Migration } from '../types';

// 版本: 3
// 创建 prompts 表
export const migration_003: Migration = {
  version: 3,
  name: 'add_prompts_table',
  description: 'Create prompts table to store reusable prompt templates',

  up: [
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
    }
  ],

  down: [
    { type: 'dropTable', tableName: 'prompts' }
  ]
};

