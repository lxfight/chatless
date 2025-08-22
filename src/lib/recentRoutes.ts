// 简单的内存缓存：最近访问的站内路由

export type RecentRoute = {
  path: string;
  title?: string;
  ts: number; // last visited timestamp
};

const MAX_RECENTS = 12;
const recentList: RecentRoute[] = [];

export function addRecentRoute(path: string, title?: string) {
  const p = (path || '').trim();
  if (!p || p.startsWith('http://') || p.startsWith('https://')) return;
  const now = Date.now();
  const idx = recentList.findIndex(r => r.path === p);
  if (idx >= 0) {
    recentList[idx].ts = now;
    if (title) recentList[idx].title = title;
  } else {
    recentList.unshift({ path: p, title, ts: now });
  }
  // 截断
  if (recentList.length > MAX_RECENTS) recentList.length = MAX_RECENTS;
}

export function getRecentRoutes(): RecentRoute[] {
  // 返回拷贝，避免外部修改
  return recentList.slice(0);
}

