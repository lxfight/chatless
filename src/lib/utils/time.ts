export function formatTime(date: Date | string | number, timezone: string = 'local') {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (timezone === 'local') {
    return d.toLocaleString();
  }
  try {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: timezone,
    };
    return new Intl.DateTimeFormat(undefined, options).format(d);
  } catch (e) {
    // 若浏览器不支持该时区，退回本地
    return d.toLocaleString();
  }
} 