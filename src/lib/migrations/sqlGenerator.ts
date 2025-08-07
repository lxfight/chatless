import {
  TableDefinition,
  ColumnDefinition,
  ForeignKeyDefinition,
  IndexDefinition,
  AlterTableSubOperation
} from './types';

/**
 * SQL语句生成器
 * 将表结构定义转换为对应的SQL语句
 */
export class SQLGenerator {
  /**
   * 生成CREATE TABLE语句
   */
  generateCreateTable(table: TableDefinition, ifNotExists: boolean = true): string {
    const columns = table.columns.map(col => this.generateColumnDefinition(col));
    const foreignKeys = table.foreignKeys?.map(fk => this.generateForeignKeyDefinition(fk)) || [];
    
    const allDefinitions = [...columns, ...foreignKeys];
    
    const ifNotExistsClause = ifNotExists ? ' IF NOT EXISTS' : '';
    return `CREATE TABLE${ifNotExistsClause} ${table.name} (\n  ${allDefinitions.join(',\n  ')}\n)`;
  }

  /**
   * 生成字段定义
   */
  private generateColumnDefinition(column: ColumnDefinition): string {
    let sql = `${column.name} ${column.type}`;
    
    if (column.primaryKey) {
      sql += ' PRIMARY KEY';
      if (column.autoIncrement) {
        sql += ' AUTOINCREMENT';
      }
    }
    
    if (column.notNull && !column.primaryKey) {
      sql += ' NOT NULL';
    }
    
    if (column.unique && !column.primaryKey) {
      sql += ' UNIQUE';
    }
    
    if (column.defaultValue !== undefined) {
      if (typeof column.defaultValue === 'string') {
        sql += ` DEFAULT '${column.defaultValue}'`;
      } else {
        sql += ` DEFAULT ${column.defaultValue}`;
      }
    }
    
    if (column.check) {
      sql += ` CHECK (${column.check})`;
    }
    
    return sql;
  }

  /**
   * 生成外键定义
   */
  private generateForeignKeyDefinition(fk: ForeignKeyDefinition): string {
    let sql = `FOREIGN KEY (${fk.column}) REFERENCES ${fk.referencedTable}(${fk.referencedColumn})`;
    
    if (fk.onDelete) {
      sql += ` ON DELETE ${fk.onDelete}`;
    }
    
    if (fk.onUpdate) {
      sql += ` ON UPDATE ${fk.onUpdate}`;
    }
    
    return sql;
  }

  /**
   * 生成CREATE INDEX语句
   */
  generateCreateIndex(tableName: string, index: IndexDefinition, ifNotExists: boolean = true): string {
    const uniqueKeyword = index.unique ? 'UNIQUE ' : '';
    const ifNotExistsClause = ifNotExists ? 'IF NOT EXISTS ' : '';
    const columns = index.columns.join(', ');
    return `CREATE ${uniqueKeyword}INDEX ${ifNotExistsClause}${index.name} ON ${tableName} (${columns})`;
  }

  /**
   * 生成DROP INDEX语句
   */
  generateDropIndex(indexName: string, ifExists: boolean = true): string {
    const ifExistsClause = ifExists ? 'IF EXISTS ' : '';
    return `DROP INDEX ${ifExistsClause}${indexName}`;
  }

  /**
   * 生成ALTER TABLE语句
   */
  generateAlterTable(tableName: string, operations: AlterTableSubOperation[]): string[] {
    return operations.map(op => {
      switch (op.type) {
        case 'addColumn':
          return `ALTER TABLE ${tableName} ADD COLUMN ${this.generateColumnDefinition(op.column)}`;
        case 'dropColumn':
          return `ALTER TABLE ${tableName} DROP COLUMN ${op.columnName}`;
        case 'renameColumn':
          return `ALTER TABLE ${tableName} RENAME COLUMN ${op.oldName} TO ${op.newName}`;
        case 'modifyColumn':
          // SQLite不直接支持修改列，需要通过重建表来实现
          throw new Error('Column modification requires table rebuild - use data migration instead');
        default:
          throw new Error(`Unknown alter table operation: ${(op as any).type}`);
      }
    });
  }

  /**
   * 生成DROP TABLE语句
   */
  generateDropTable(tableName: string, ifExists: boolean = true): string {
    const ifExistsClause = ifExists ? 'IF EXISTS ' : '';
    return `DROP TABLE ${ifExistsClause}${tableName}`;
  }
}

export const sqlGenerator = new SQLGenerator(); 