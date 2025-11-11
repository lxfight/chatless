import { isDebugEnabled, type DebugCategory } from './DebugFlags';

export function trace(category: DebugCategory, messageId: string | undefined, label: string, data?: unknown): void {
  if (!isDebugEnabled(category)) return;
  try {
    const time = new Date().toISOString().split('T')[1]?.replace('Z', '') || '';
    const prefix = `[TRACE:${category}]${messageId ? `(${messageId.substring(0,8)})` : ''} ${time} - ${label}`;
    if (data !== undefined) {
      // 避免打印过大对象
      console.log(prefix, typeof data === 'string' ? data.slice(0, 2000) : data);
    } else {
      console.log(prefix);
    }
  } catch { /* noop */ }
}


