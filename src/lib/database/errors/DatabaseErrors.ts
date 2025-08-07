/**
 * 数据库错误类型枚举
 * 用于分类和处理不同类型的数据库错误
 */
export enum DatabaseErrorType {
  // 连接相关错误
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  CONNECTION_LOST = 'CONNECTION_LOST',

  // 锁定相关错误
  DATABASE_LOCKED = 'DATABASE_LOCKED',
  TABLE_LOCKED = 'TABLE_LOCKED',
  MIGRATION_IN_PROGRESS = 'MIGRATION_IN_PROGRESS',

  // SQL 相关错误
  SQL_SYNTAX_ERROR = 'SQL_SYNTAX_ERROR',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',
  FOREIGN_KEY_VIOLATION = 'FOREIGN_KEY_VIOLATION',
  UNIQUE_CONSTRAINT_VIOLATION = 'UNIQUE_CONSTRAINT_VIOLATION',

  // 迁移相关错误
  MIGRATION_FAILED = 'MIGRATION_FAILED',
  MIGRATION_VALIDATION_FAILED = 'MIGRATION_VALIDATION_FAILED',
  SCHEMA_VERSION_MISMATCH = 'SCHEMA_VERSION_MISMATCH',
  MIGRATION_ROLLBACK_FAILED = 'MIGRATION_ROLLBACK_FAILED',

  // 数据相关错误
  DATA_CORRUPTION = 'DATA_CORRUPTION',
  INVALID_DATA_FORMAT = 'INVALID_DATA_FORMAT',
  DATA_NOT_FOUND = 'DATA_NOT_FOUND',

  // 操作相关错误
  OPERATION_NOT_ALLOWED = 'OPERATION_NOT_ALLOWED',
  OPERATION_TIMEOUT = 'OPERATION_TIMEOUT',
  CONCURRENT_OPERATION = 'CONCURRENT_OPERATION',

  // 配置相关错误
  INVALID_CONFIGURATION = 'INVALID_CONFIGURATION',
  MISSING_DEPENDENCY = 'MISSING_DEPENDENCY',

  // 未知错误
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * 数据库错误严重程度
 */
export enum DatabaseErrorSeverity {
  LOW = 'LOW',           // 警告，不影响正常功能
  MEDIUM = 'MEDIUM',     // 错误，影响部分功能
  HIGH = 'HIGH',         // 严重，影响主要功能
  CRITICAL = 'CRITICAL'  // 致命，系统无法使用
}

/**
 * 错误恢复策略
 */
export enum RecoveryStrategy {
  RETRY = 'RETRY',               // 重试操作
  ROLLBACK = 'ROLLBACK',         // 回滚事务
  RESET_CONNECTION = 'RESET_CONNECTION', // 重置连接
  CLEAR_CACHE = 'CLEAR_CACHE',   // 清理缓存
  MIGRATE_SCHEMA = 'MIGRATE_SCHEMA', // 迁移Schema
  MANUAL_INTERVENTION = 'MANUAL_INTERVENTION', // 需要手动处理
  IGNORE = 'IGNORE'              // 忽略错误
}

/**
 * 数据库错误类
 * 提供结构化的错误信息和恢复建议
 */
export class DatabaseError extends Error {
  public readonly type: DatabaseErrorType;
  public readonly severity: DatabaseErrorSeverity;
  public readonly originalError?: Error;
  public readonly recoveryStrategies: RecoveryStrategy[];
  public readonly userMessage: string;
  public readonly timestamp: number;
  public readonly context?: Record<string, any>;

  constructor(
    type: DatabaseErrorType,
    message: string,
    originalError?: Error,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = 'DatabaseError';
    this.type = type;
    this.originalError = originalError;
    this.context = context;
    this.timestamp = Date.now();

    // 根据错误类型设置严重程度和恢复策略
    const errorInfo = this.getErrorInfo(type);
    this.severity = errorInfo.severity;
    this.recoveryStrategies = errorInfo.recoveryStrategies;
    this.userMessage = errorInfo.userMessage;
  }

  /**
   * 获取错误的详细信息
   */
  private getErrorInfo(type: DatabaseErrorType): {
    severity: DatabaseErrorSeverity;
    recoveryStrategies: RecoveryStrategy[];
    userMessage: string;
  } {
    switch (type) {
      case DatabaseErrorType.CONNECTION_FAILED:
        return {
          severity: DatabaseErrorSeverity.HIGH,
          recoveryStrategies: [RecoveryStrategy.RETRY, RecoveryStrategy.RESET_CONNECTION],
          userMessage: '数据库连接失败，请检查数据库配置'
        };

      case DatabaseErrorType.CONNECTION_TIMEOUT:
        return {
          severity: DatabaseErrorSeverity.MEDIUM,
          recoveryStrategies: [RecoveryStrategy.RETRY],
          userMessage: '数据库连接超时，请稍后重试'
        };

      case DatabaseErrorType.CONNECTION_LOST:
        return {
          severity: DatabaseErrorSeverity.HIGH,
          recoveryStrategies: [RecoveryStrategy.RESET_CONNECTION, RecoveryStrategy.MANUAL_INTERVENTION],
          userMessage: '数据库连接已断开，需要重新初始化连接'
        };

      case DatabaseErrorType.DATABASE_LOCKED:
        return {
          severity: DatabaseErrorSeverity.MEDIUM,
          recoveryStrategies: [RecoveryStrategy.RETRY],
          userMessage: '数据库正在被其他进程使用，请稍后重试'
        };

      case DatabaseErrorType.MIGRATION_FAILED:
        return {
          severity: DatabaseErrorSeverity.HIGH,
          recoveryStrategies: [RecoveryStrategy.ROLLBACK, RecoveryStrategy.MIGRATE_SCHEMA],
          userMessage: '数据库升级失败，系统将尝试自动修复'
        };

      case DatabaseErrorType.CONSTRAINT_VIOLATION:
        return {
          severity: DatabaseErrorSeverity.MEDIUM,
          recoveryStrategies: [RecoveryStrategy.ROLLBACK],
          userMessage: '数据不符合约束条件，请检查输入数据'
        };

      case DatabaseErrorType.DATA_CORRUPTION:
        return {
          severity: DatabaseErrorSeverity.CRITICAL,
          recoveryStrategies: [RecoveryStrategy.MANUAL_INTERVENTION],
          userMessage: '检测到数据损坏，请联系技术支持'
        };

      case DatabaseErrorType.SCHEMA_VERSION_MISMATCH:
        return {
          severity: DatabaseErrorSeverity.HIGH,
          recoveryStrategies: [RecoveryStrategy.MIGRATE_SCHEMA],
          userMessage: '数据库版本不匹配，正在更新数据库结构'
        };

      case DatabaseErrorType.MIGRATION_IN_PROGRESS:
        return {
          severity: DatabaseErrorSeverity.LOW,
          recoveryStrategies: [RecoveryStrategy.RETRY],
          userMessage: '数据库正在更新中，请稍等片刻'
        };

      case DatabaseErrorType.OPERATION_NOT_ALLOWED:
        return {
          severity: DatabaseErrorSeverity.MEDIUM,
          recoveryStrategies: [RecoveryStrategy.IGNORE],
          userMessage: '当前操作不被允许'
        };

      default:
        return {
          severity: DatabaseErrorSeverity.MEDIUM,
          recoveryStrategies: [RecoveryStrategy.RETRY, RecoveryStrategy.MANUAL_INTERVENTION],
          userMessage: '发生了未知的数据库错误'
        };
    }
  }

  /**
   * 获取完整的错误信息
   */
  getFullErrorInfo(): {
    type: DatabaseErrorType;
    severity: DatabaseErrorSeverity;
    message: string;
    userMessage: string;
    recoveryStrategies: RecoveryStrategy[];
    timestamp: number;
    context?: Record<string, any>;
    originalError?: string;
  } {
    return {
      type: this.type,
      severity: this.severity,
      message: this.message,
      userMessage: this.userMessage,
      recoveryStrategies: this.recoveryStrategies,
      timestamp: this.timestamp,
      context: this.context,
      originalError: this.originalError?.message
    };
  }

  /**
   * 判断是否为特定类型的错误
   */
  isType(type: DatabaseErrorType): boolean {
    return this.type === type;
  }

  /**
   * 判断是否为连接相关错误
   */
  isConnectionError(): boolean {
    return [
      DatabaseErrorType.CONNECTION_FAILED,
      DatabaseErrorType.CONNECTION_TIMEOUT,
      DatabaseErrorType.CONNECTION_LOST
    ].includes(this.type);
  }

  /**
   * 判断是否为锁定相关错误
   */
  isLockError(): boolean {
    return [
      DatabaseErrorType.DATABASE_LOCKED,
      DatabaseErrorType.TABLE_LOCKED,
      DatabaseErrorType.MIGRATION_IN_PROGRESS
    ].includes(this.type);
  }

  /**
   * 判断是否为迁移相关错误
   */
  isMigrationError(): boolean {
    return [
      DatabaseErrorType.MIGRATION_FAILED,
      DatabaseErrorType.MIGRATION_VALIDATION_FAILED,
      DatabaseErrorType.SCHEMA_VERSION_MISMATCH,
      DatabaseErrorType.MIGRATION_ROLLBACK_FAILED
    ].includes(this.type);
  }

  /**
   * 判断是否支持自动恢复
   */
  canAutoRecover(): boolean {
    return !this.recoveryStrategies.includes(RecoveryStrategy.MANUAL_INTERVENTION);
  }
}

/**
 * 错误分析器
 * 用于分析原始错误并转换为 DatabaseError
 */
export class DatabaseErrorAnalyzer {
  /**
   * 分析错误并创建 DatabaseError 实例
   */
  static analyze(error: Error | unknown, context?: Record<string, any>): DatabaseError {
    if (error instanceof DatabaseError) {
      return error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const originalError = error instanceof Error ? error : undefined;

    // 根据错误消息分析错误类型
    const type = this.analyzeErrorType(errorMessage);

    return new DatabaseError(type, errorMessage, originalError, context);
  }

  /**
   * 根据错误消息分析错误类型
   */
  private static analyzeErrorType(message: string): DatabaseErrorType {
    const lowerMessage = message.toLowerCase();

    // 连接相关错误
    if (lowerMessage.includes('connection') || lowerMessage.includes('connect')) {
      if (lowerMessage.includes('timeout')) {
        return DatabaseErrorType.CONNECTION_TIMEOUT;
      }
      if (lowerMessage.includes('closed pool') || lowerMessage.includes('connection on a closed')) {
        return DatabaseErrorType.CONNECTION_LOST;
      }
      return DatabaseErrorType.CONNECTION_FAILED;
    }

    // 锁定相关错误
    if (lowerMessage.includes('locked') || lowerMessage.includes('busy')) {
      return DatabaseErrorType.DATABASE_LOCKED;
    }

    // SQL 语法错误
    if (lowerMessage.includes('syntax error') || lowerMessage.includes('near')) {
      return DatabaseErrorType.SQL_SYNTAX_ERROR;
    }

    // 约束违反
    if (lowerMessage.includes('constraint')) {
      if (lowerMessage.includes('foreign key')) {
        return DatabaseErrorType.FOREIGN_KEY_VIOLATION;
      }
      if (lowerMessage.includes('unique')) {
        return DatabaseErrorType.UNIQUE_CONSTRAINT_VIOLATION;
      }
      return DatabaseErrorType.CONSTRAINT_VIOLATION;
    }

    // 表已存在错误
    if (lowerMessage.includes('already exists')) {
      return DatabaseErrorType.CONSTRAINT_VIOLATION;
    }

    // 迁移相关错误
    if (lowerMessage.includes('migration')) {
      return DatabaseErrorType.MIGRATION_FAILED;
    }

    // 数据不存在
    if (lowerMessage.includes('not found') || lowerMessage.includes('no such')) {
      return DatabaseErrorType.DATA_NOT_FOUND;
    }

    return DatabaseErrorType.UNKNOWN_ERROR;
  }
}

/**
 * 错误恢复器
 * 提供自动错误恢复功能
 */
export class DatabaseErrorRecovery {
  /**
   * 尝试自动恢复错误
   */
  static async attemptRecovery(
    error: DatabaseError,
    retryFunction?: () => Promise<any>
  ): Promise<{
    recovered: boolean;
    strategy?: RecoveryStrategy;
    message: string;
  }> {
    for (const strategy of error.recoveryStrategies) {
      try {
        const result = await this.executeRecoveryStrategy(strategy, error, retryFunction);
        if (result.success) {
          return {
            recovered: true,
            strategy,
            message: result.message
          };
        }
      } catch (recoveryError) {
        console.warn(`恢复策略 ${strategy} 失败:`, recoveryError);
      }
    }

    return {
      recovered: false,
      message: '自动恢复失败，需要手动处理'
    };
  }

  /**
   * 执行特定的恢复策略
   */
  private static async executeRecoveryStrategy(
    strategy: RecoveryStrategy,
    error: DatabaseError,
    retryFunction?: () => Promise<any>
  ): Promise<{ success: boolean; message: string }> {
    switch (strategy) {
      case RecoveryStrategy.RETRY:
        if (retryFunction) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒
          await retryFunction();
          return { success: true, message: '重试成功' };
        }
        return { success: false, message: '无重试函数' };

      case RecoveryStrategy.IGNORE:
        return { success: true, message: '错误已忽略' };

      default:
        return { success: false, message: `不支持的恢复策略: ${strategy}` };
    }
  }
} 