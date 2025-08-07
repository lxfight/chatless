import Database from "@tauri-apps/plugin-sql";

// 字段类型定义
export type ColumnType = 
  | 'TEXT' 
  | 'INTEGER' 
  | 'BOOLEAN' 
  | 'BLOB' 
  | 'REAL';

// 字段定义
export interface ColumnDefinition {
  name: string;
  type: ColumnType;
  primaryKey?: boolean;
  notNull?: boolean;
  defaultValue?: string | number | boolean;
  unique?: boolean;
  autoIncrement?: boolean;
  check?: string;
}

// 外键定义
export interface ForeignKeyDefinition {
  column: string;
  referencedTable: string;
  referencedColumn: string;
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT';
  onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT';
}

// 索引定义
export interface IndexDefinition {
  name: string;
  columns: string[];
  unique?: boolean;
}

// 表定义
export interface TableDefinition {
  name: string;
  columns: ColumnDefinition[];
  foreignKeys?: ForeignKeyDefinition[];
  indexes?: IndexDefinition[];
}

// 迁移操作类型
export type MigrationOperation = 
  | CreateTableOperation
  | AlterTableOperation
  | DropTableOperation
  | CreateIndexOperation
  | DropIndexOperation
  | RawSQLOperation
  | DataMigrationOperation;

export interface CreateTableOperation {
  type: 'createTable';
  table: TableDefinition;
}

export interface AlterTableOperation {
  type: 'alterTable';
  tableName: string;
  operations: AlterTableSubOperation[];
}

export type AlterTableSubOperation = 
  | { type: 'addColumn'; column: ColumnDefinition }
  | { type: 'dropColumn'; columnName: string }
  | { type: 'renameColumn'; oldName: string; newName: string }
  | { type: 'modifyColumn'; column: ColumnDefinition };

export interface DropTableOperation {
  type: 'dropTable';
  tableName: string;
}

export interface CreateIndexOperation {
  type: 'createIndex';
  tableName: string;
  index: IndexDefinition;
}

export interface DropIndexOperation {
  type: 'dropIndex';
  indexName: string;
}

export interface RawSQLOperation {
  type: 'rawSQL';
  sql: string;
  params?: any[];
}

export interface DataMigrationOperation {
  type: 'dataMigration';
  description: string;
  up: (db: Database) => Promise<void>;
  down?: (db: Database) => Promise<void>;
}

// 迁移脚本接口
export interface Migration {
  version: number;
  name: string;
  description: string;
  up: MigrationOperation[];
  down?: MigrationOperation[];
}

// 迁移执行结果
export interface MigrationResult {
  version: number;
  success: boolean;
  error?: string;
  executionTime: number;
}

// 迁移状态
export interface MigrationState {
  version: number;
  name: string;
  executedAt: number;
  executionTime: number;
  checksum: string;
} 