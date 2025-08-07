import { DatabaseManager, DatabaseTransaction } from "../core/DatabaseManager";
import { DatabaseError, DatabaseErrorType, DatabaseErrorAnalyzer } from "../errors/DatabaseErrors";

/**
 * 查询条件接口
 */
export interface QueryCondition {
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN' | 'NOT IN';
  value: any;
}

/**
 * 排序条件接口
 */
export interface SortCondition {
  field: string;
  direction: 'ASC' | 'DESC';
}

/**
 * 分页参数接口
 */
export interface PaginationParams {
  page: number;
  pageSize: number;
}

/**
 * 分页结果接口
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 基础Repository类
 * 提供通用的数据库操作方法
 */
export abstract class BaseRepository<T extends Record<string, any>> {
  protected dbManager: DatabaseManager;
  protected abstract tableName: string;
  protected abstract primaryKey: string;

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager;
  }

  /**
   * 根据主键查找记录
   */
  async findById(id: string | number): Promise<T | null> {
    try {
      const sql = `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = ?`;
      const results = await this.dbManager.select<T>(sql, [id]);
      return results.length > 0 ? results[0] : null;
    } catch (error) {
      const dbError = DatabaseErrorAnalyzer.analyze(error, {
        operation: 'findById',
        table: this.tableName,
        id
      });
      console.error(`查找记录失败: ${this.tableName}`, dbError);
      throw dbError;
    }
  }

  /**
   * 根据条件查找记录
   */
  async findByCondition(conditions: QueryCondition[]): Promise<T[]> {
    try {
      const whereClause = conditions.map((condition, index) => {
        const paramName = `param${index}`;
        return `${condition.field} ${condition.operator} ?`;
      }).join(' AND ');

      const sql = `SELECT * FROM ${this.tableName} WHERE ${whereClause}`;
      const params = conditions.map(condition => condition.value);
      const results = await this.dbManager.select<T>(sql, params);
      return results;
    } catch (error) {
      const dbError = DatabaseErrorAnalyzer.analyze(error, {
        operation: 'findByCondition',
        table: this.tableName,
        conditions
      });
      console.error(`查找记录失败: ${this.tableName}`, dbError);
      throw dbError;
    }
  }

  /**
   * 分页查询
   */
  async findWithPagination(
    conditions: QueryCondition[] = [],
    sort: SortCondition[] = [],
    pagination: PaginationParams
  ): Promise<PaginatedResult<T>> {
    try {
      // 构建WHERE子句
      const whereClause = conditions.length > 0
        ? 'WHERE ' + conditions.map((condition, index) => {
            return `${condition.field} ${condition.operator} ?`;
          }).join(' AND ')
        : '';

      // 构建ORDER BY子句
      const orderClause = sort.length > 0
        ? 'ORDER BY ' + sort.map(s => `${s.field} ${s.direction}`).join(', ')
        : '';

      // 计算总数
      const countSql = `SELECT COUNT(*) as total FROM ${this.tableName} ${whereClause}`;
      const countParams = conditions.map(condition => condition.value);
      const countResult = await this.dbManager.select<{ total: number }>(countSql, countParams);
      const total = countResult[0]?.total || 0;

      // 查询数据
      const offset = (pagination.page - 1) * pagination.pageSize;
      const dataSql = `
        SELECT * FROM ${this.tableName} 
        ${whereClause} 
        ${orderClause} 
        LIMIT ? OFFSET ?
      `;
      const dataParams = [...countParams, pagination.pageSize, offset];
      const data = await this.dbManager.select<T>(dataSql, dataParams);

      return {
        data,
        total,
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalPages: Math.ceil(total / pagination.pageSize)
      };
    } catch (error) {
      const dbError = DatabaseErrorAnalyzer.analyze(error, {
        operation: 'findWithPagination',
        table: this.tableName,
        conditions,
        sort,
        pagination
      });
      console.error(`分页查询失败: ${this.tableName}`, dbError);
      throw dbError;
    }
  }

  /**
   * 统计记录数
   */
  async count(conditions: QueryCondition[] = []): Promise<number> {
    try {
      const whereClause = conditions.length > 0
        ? 'WHERE ' + conditions.map((condition, index) => {
            return `${condition.field} ${condition.operator} ?`;
          }).join(' AND ')
        : '';

      const sql = `SELECT COUNT(*) as total FROM ${this.tableName} ${whereClause}`;
      const params = conditions.map(condition => condition.value);
      const result = await this.dbManager.select<{ total: number }>(sql, params);
      return result[0]?.total || 0;
    } catch (error) {
      const dbError = DatabaseErrorAnalyzer.analyze(error, {
        operation: 'count',
        table: this.tableName,
        conditions
      });
      console.error(`统计记录失败: ${this.tableName}`, dbError);
      throw dbError;
    }
  }

  /**
   * 创建记录
   */
  async create(data: Omit<T, typeof this.primaryKey>): Promise<T> {
    try {
      const now = Date.now();
      
      // 自动添加时间戳字段（如果不存在）
      const recordData = {
        ...data,
        created_at: (data as any).created_at ?? now,
        updated_at: (data as any).updated_at ?? now
      };

      const fields = Object.keys(recordData);
      const placeholders = fields.map(() => '?').join(', ');
      const sql = `INSERT INTO ${this.tableName} (${fields.join(', ')}) VALUES (${placeholders})`;
      const params = Object.values(recordData);

      const result = await this.dbManager.execute(sql, params);
      
      // 如果数据中包含主键，直接使用该主键；否则使用 lastInsertId
      const id = (data as any)[this.primaryKey] || result.lastInsertId;
      
      if (!id) {
        throw new Error(`无法获取插入记录的ID: ${this.tableName}`);
      }

      // 返回创建的记录
      const createdRecord = await this.findById(id);
      if (!createdRecord) {
        throw new Error(`无法找到刚插入的记录: ${this.tableName}, ID: ${id}`);
      }
      
      return createdRecord as T;
    } catch (error) {
      const dbError = DatabaseErrorAnalyzer.analyze(error, {
        operation: 'create',
        table: this.tableName,
        data
      });
      console.error(`创建记录失败: ${this.tableName}`, dbError);
      throw dbError;
    }
  }

  /**
   * 更新记录
   */
  async update(id: string | number, data: Partial<T>): Promise<T | null> {
    try {
      const now = Date.now();
      
      // 自动添加updated_at字段
      const updateData = {
        ...data,
        updated_at: now
      };

      const fields = Object.keys(updateData);
      if (fields.length === 0) {
        return await this.findById(id);
      }

      const setClause = fields.map(field => `${field} = ?`).join(', ');
      const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE ${this.primaryKey} = ?`;
      const params = [...Object.values(updateData), id];

      await this.dbManager.execute(sql, params);
      return await this.findById(id);
    } catch (error) {
      const dbError = DatabaseErrorAnalyzer.analyze(error, {
        operation: 'update',
        table: this.tableName,
        id,
        data
      });
      console.error(`更新记录失败: ${this.tableName}`, dbError);
      throw dbError;
    }
  }

  /**
   * 删除记录
   */
  async delete(id: string | number): Promise<boolean> {
    try {
      const sql = `DELETE FROM ${this.tableName} WHERE ${this.primaryKey} = ?`;
      const result = await this.dbManager.execute(sql, [id]);
      return result.changes > 0;
    } catch (error) {
      const dbError = DatabaseErrorAnalyzer.analyze(error, {
        operation: 'delete',
        table: this.tableName,
        id
      });
      console.error(`删除记录失败: ${this.tableName}`, dbError);
      throw dbError;
    }
  }

  /**
   * 批量删除
   */
  async deleteMany(conditions: QueryCondition[]): Promise<number> {
    try {
      const whereClause = conditions.map((condition, index) => {
        return `${condition.field} ${condition.operator} ?`;
      }).join(' AND ');

      const sql = `DELETE FROM ${this.tableName} WHERE ${whereClause}`;
      const params = conditions.map(condition => condition.value);
      const result = await this.dbManager.execute(sql, params);
      return result.changes;
    } catch (error) {
      const dbError = DatabaseErrorAnalyzer.analyze(error, {
        operation: 'deleteMany',
        table: this.tableName,
        conditions
      });
      console.error(`批量删除失败: ${this.tableName}`, dbError);
      throw dbError;
    }
  }

  /**
   * 检查记录是否存在
   */
  async exists(id: string | number): Promise<boolean> {
    try {
      const sql = `SELECT 1 FROM ${this.tableName} WHERE ${this.primaryKey} = ? LIMIT 1`;
      const results = await this.dbManager.select(sql, [id]);
      return results.length > 0;
    } catch (error) {
      const dbError = DatabaseErrorAnalyzer.analyze(error, {
        operation: 'exists',
        table: this.tableName,
        id
      });
      console.error(`检查记录存在性失败: ${this.tableName}`, dbError);
      throw dbError;
    }
  }

  /**
   * 获取所有记录
   */
  async findAll(
    conditions: QueryCondition[] = [],
    sort: SortCondition[] = []
  ): Promise<T[]> {
    try {
      const whereClause = conditions.length > 0
        ? 'WHERE ' + conditions.map((condition, index) => {
            return `${condition.field} ${condition.operator} ?`;
          }).join(' AND ')
        : '';

      const orderClause = sort.length > 0
        ? 'ORDER BY ' + sort.map(s => `${s.field} ${s.direction}`).join(', ')
        : '';

      const sql = `SELECT * FROM ${this.tableName} ${whereClause} ${orderClause}`;
      const params = conditions.map(condition => condition.value);
      const results = await this.dbManager.select<T>(sql, params);
      return results;
    } catch (error) {
      const dbError = DatabaseErrorAnalyzer.analyze(error, {
        operation: 'findAll',
        table: this.tableName,
        conditions,
        sort
      });
      console.error(`获取所有记录失败: ${this.tableName}`, dbError);
      throw dbError;
    }
  }

  /**
   * 验证必需字段
   */
  protected validateRequiredFields(data: Record<string, any>, requiredFields: string[]): void {
    const missingFields = requiredFields.filter(field => {
      const value = data[field];
      return value === undefined || value === null || value === '';
    });

    if (missingFields.length > 0) {
      throw new Error(`缺少必需字段: ${missingFields.join(', ')}`);
    }
  }

  /**
   * 解析JSON字段
   */
  protected parseJsonField(value: any): any {
    if (!value) return null;
    
    try {
      if (typeof value === 'string') {
        return JSON.parse(value);
      }
      return value;
    } catch (error) {
      console.warn('Failed to parse JSON field:', value, error);
      return null;
    }
  }

  /**
   * 执行原始查询
   */
  async executeRawQuery<R = any>(sql: string, params: any[] = []): Promise<R[]> {
    try {
      return await this.dbManager.select<R>(sql, params);
    } catch (error) {
      const dbError = DatabaseErrorAnalyzer.analyze(error, {
        operation: 'executeRawQuery',
        table: this.tableName,
        sql,
        params
      });
      console.error(`执行原始查询失败: ${this.tableName}`, dbError);
      throw dbError;
    }
  }

  /**
   * 执行事务
   */
  async executeTransaction<R>(
    operation: (transaction: DatabaseTransaction) => Promise<R>
  ): Promise<R> {
    return await this.dbManager.executeTransaction(operation);
  }

  /**
   * 获取表信息
   */
  async getTableInfo(): Promise<{
    columns: Array<{
      name: string;
      type: string;
      notNull: boolean;
      defaultValue: any;
      primaryKey: boolean;
    }>;
    indexes: Array<{
      name: string;
      columns: string[];
      unique: boolean;
    }>;
  }> {
    try {
      // 获取列信息
      const columnsSql = `PRAGMA table_info(${this.tableName})`;
      const columnsResult = await this.dbManager.select(columnsSql);
      
      const columns = columnsResult.map((col: any) => ({
        name: col.name,
        type: col.type,
        notNull: Boolean(col.notnull),
        defaultValue: col.dflt_value,
        primaryKey: Boolean(col.pk)
      }));

      // 获取索引信息
      const indexesSql = `PRAGMA index_list(${this.tableName})`;
      const indexesResult = await this.dbManager.select(indexesSql);
      
      const indexes = await Promise.all(
        indexesResult.map(async (index: any) => {
          const indexInfoSql = `PRAGMA index_info(${index.name})`;
          const indexInfoResult = await this.dbManager.select(indexInfoSql);
          const columns = indexInfoResult.map((info: any) => info.name);
          
          return {
            name: index.name,
            columns,
            unique: Boolean(index.unique)
          };
        })
      );

      return { columns, indexes };
    } catch (error) {
      const dbError = DatabaseErrorAnalyzer.analyze(error, {
        operation: 'getTableInfo',
        table: this.tableName
      });
      console.error(`获取表信息失败: ${this.tableName}`, dbError);
      throw dbError;
    }
  }
} 