/**
 * Provider / Model 相关通用类型
 */
export enum ProviderStatus {
  UNKNOWN = 'UNKNOWN',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  NOT_CONNECTED = 'NOT_CONNECTED',
  NO_KEY = 'NO_KEY',
}

export interface ProviderEntity {
  /** 唯一标识 */
  name: string;
  /** 服务 URL */
  url: string;
  /** 是否需要 API Key */
  requiresKey: boolean;
  /** 当前连接状态 */
  status: ProviderStatus;
  /** 最后一次状态检查时间戳 */
  lastChecked: number;
  /** Provider 级别 API Key，可为空 */
  apiKey?: string | null;
  /** 最近一次检查的失败/状态原因 */
  lastReason?: 'NO_KEY' | 'AUTH' | 'NETWORK' | 'TIMEOUT' | 'UNKNOWN';
  /** 最近一次检查的消息 */
  lastMessage?: string | null;
}

export interface ModelEntity {
  provider: string;
  /** 实际模型 ID，用于请求 */
  name: string;
  /** 面向用户展示的名称；如果缺失则回退 name */
  label?: string;
  aliases: string[];
  /** 可选：模型级别 API Key */
  apiKey?: string | null;
} 