# 数据库迁移系统

这是一个现代化的数据库迁移框架，支持类型安全的表结构定义、自动SQL生成、回滚操作等高级功能。

## 🚀 特性

- **类型安全** - 使用TypeScript定义表结构，编译时检查
- **声明式配置** - 通过配置对象定义表结构，无需手写SQL
- **自动SQL生成** - 根据表结构定义自动生成CREATE TABLE、ALTER TABLE等语句
- **支持回滚** - 每个迁移都可以定义回滚操作
- **事务安全** - 每个迁移都在事务中执行，失败自动回滚
- **版本管理** - 自动跟踪迁移版本和执行状态
- **校验和检查** - 确保迁移脚本未被篡改
- **详细日志** - 提供清晰的迁移进度和错误信息

## 📦 基本使用

```typescript
import Database from "@tauri-apps/plugin-sql";
import { runDatabaseMigration } from "@/lib/migrations";

// 简单使用 - 迁移到最新版本
const db = await Database.load("sqlite:app.db");
await runDatabaseMigration(db);
```

## 🔧 高级使用

```typescript
import { DatabaseMigrator } from "@/lib/migrations";

const migrator = new DatabaseMigrator(db);

// 获取状态信息
const status = await migrator.getStatus();
console.log(`当前版本: v${status.currentVersion}`);
console.log(`最新版本: v${status.latestVersion}`);

// 迁移到特定版本
await migrator.migrateTo(5);

// 回滚到指定版本
await migrator.rollbackTo(3);

// 列出所有迁移
migrator.listMigrations();
```

## 📝 创建新迁移

### 1. 创建迁移文件

在 `src/lib/migrations/scripts/` 目录下创建新文件：

```typescript
// 003_add_user_preferences.ts
import { Migration } from '../types';

export const migration_003: Migration = {
  version: 3,
  name: 'add_user_preferences',
  description: '添加用户偏好设置表',
  
  up: [
    {
      type: 'createTable',
      table: {
        name: 'user_preferences',
        columns: [
          { name: 'id', type: 'TEXT', primaryKey: true },
          { name: 'user_id', type: 'TEXT', notNull: true },
          { name: 'preference_key', type: 'TEXT', notNull: true },
          { name: 'preference_value', type: 'TEXT' },
          { name: 'created_at', type: 'INTEGER', notNull: true }
        ],
        indexes: [
          {
            name: 'idx_user_preferences_user_key',
            columns: ['user_id', 'preference_key'],
            unique: true
          }
        ]
      }
    }
  ],
  
  down: [
    { type: 'dropTable', tableName: 'user_preferences' }
  ]
};
```

### 2. 注册迁移

在 `registry.ts` 中注册新迁移：

```typescript
import { migration_003 } from './scripts/003_add_user_preferences';

private registerMigrations(): void {
  this.register(migration_001);
  this.register(migration_002);
  this.register(migration_003); // 添加这一行
}
```

## 🔄 迁移操作类型

### 创建表
```typescript
{
  type: 'createTable',
  table: {
    name: 'table_name',
    columns: [
      { name: 'id', type: 'TEXT', primaryKey: true },
      { name: 'name', type: 'TEXT', notNull: true },
      { name: 'created_at', type: 'INTEGER', notNull: true }
    ],
    foreignKeys: [{
      column: 'user_id',
      referencedTable: 'users',
      referencedColumn: 'id',
      onDelete: 'CASCADE'
    }],
    indexes: [{
      name: 'idx_name',
      columns: ['name'],
      unique: true
    }]
  }
}
```

### 修改表
```typescript
{
  type: 'alterTable',
  tableName: 'existing_table',
  operations: [
    {
      type: 'addColumn',
      column: { name: 'new_field', type: 'TEXT' }
    },
    {
      type: 'dropColumn',
      columnName: 'old_field'
    },
    {
      type: 'renameColumn',
      oldName: 'old_name',
      newName: 'new_name'
    }
  ]
}
```

### 创建索引
```typescript
{
  type: 'createIndex',
  tableName: 'table_name',
  index: {
    name: 'idx_field',
    columns: ['field1', 'field2'],
    unique: false
  }
}
```

### 执行原始SQL
```typescript
{
  type: 'rawSQL',
  sql: 'UPDATE table_name SET field = ? WHERE condition = ?',
  params: ['value', 'condition_value']
}
```

### 数据迁移
```typescript
{
  type: 'dataMigration',
  description: '迁移用户数据',
  up: async (db) => {
    // 复杂的数据迁移逻辑
    const users = await db.select('SELECT * FROM old_users');
    for (const user of users) {
      await db.execute(
        'INSERT INTO new_users (id, name, email) VALUES (?, ?, ?)',
        [user.id, user.full_name, user.email_address]
      );
    }
  },
  down: async (db) => {
    await db.execute('DELETE FROM new_users');
  }
}
```

## 🔍 字段类型

支持的字段类型：
- `TEXT` - 文本类型
- `INTEGER` - 整数类型  
- `BOOLEAN` - 布尔类型
- `BLOB` - 二进制数据
- `REAL` - 浮点数类型

字段属性：
- `primaryKey` - 主键
- `notNull` - 非空
- `unique` - 唯一
- `autoIncrement` - 自增（仅限INTEGER主键）
- `defaultValue` - 默认值
- `check` - 检查约束

## 🎯 最佳实践

### 1. 版本号规范
- 使用连续的整数版本号（1, 2, 3...）
- 不要跳过版本号
- 每个版本对应一个特定的变更

### 2. 迁移命名
- 使用描述性的名称，如 `add_user_table`、`modify_message_schema`
- 遵循 snake_case 命名规范

### 3. 回滚操作
- 总是为迁移定义回滚操作
- 确保回滚操作能完全撤销正向操作

### 4. 数据安全
- 删除字段前确保数据已备份
- 使用数据迁移处理复杂的结构变更

### 5. 测试
- 在开发环境充分测试迁移和回滚
- 验证数据完整性

## 🚨 注意事项

1. **SQLite限制**: SQLite对ALTER TABLE支持有限，复杂变更需要重建表
2. **外键约束**: 确保外键引用的表已存在
3. **索引命名**: 索引名称在整个数据库中必须唯一
4. **事务处理**: 迁移失败会自动回滚，但要注意DDL语句的事务特性

## 📊 vs 旧迁移系统对比

| 特性 | 旧系统 | 新系统 |
|------|-------|-------|
| 类型安全 | ❌ | |
| 自动SQL生成 | ❌ | |
| 回滚支持 | ❌ | |
| 声明式配置 | ❌ | |
| 迁移验证 | ❌ | |
| 代码重用 | ❌ | |
| 维护成本 | 高 | 低 |

使用新的迁移系统，添加一个新表只需要几行配置代码，而不是几十行手写SQL！ 