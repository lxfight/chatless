import { Migration } from '../types';

// 版本: 4
// 为 prompts 表新增 shortcuts 字段（JSON TEXT）
export const migration_004: Migration = {
  version: 4,
  name: 'add_prompt_shortcuts',
  description: 'Add shortcuts TEXT column to prompts table',

  up: [
    {
      type: 'ensureColumns',
      tableName: 'prompts',
      columns: [
        { name: 'shortcuts', type: 'TEXT' },
      ]
    }
  ],

  down: [
    { type: 'rawSQL', sql: `-- SQLite 不支持直接删除列，回滚为 no-op` }
  ]
};

