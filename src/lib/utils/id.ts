/**
 * 生成唯一ID的工具函数
 */

/**
 * 生成随机UUID（简化版）
 */
export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 生成带时间戳的ID
 */
export function generateTimestampId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}

/**
 * 生成带前缀的ID
 */
export function generatePrefixedId(prefix: string): string {
  return `${prefix}_${generateId()}`;
}

/**
 * 生成短ID（8位）
 */
export function generateShortId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * 生成数字ID
 */
export function generateNumericId(): string {
  return Date.now().toString() + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
} 