import StorageUtil from "@/lib/storage";

// 轻量级更新提示逻辑（无弹窗）
// 数据持久化在 updates.json 中

const STORE = "updates.json";
export const UPDATE_AVAILABILITY_EVENT = 'chatless-update-availability-changed';

const KEY_AVAILABLE_VERSION = "available_version"; // string
const KEY_AVAILABLE_SINCE = "available_since"; // number (ms)
const KEY_LAST_CHECKED_AT = "last_checked_at"; // number (ms)
const KEY_LAST_ABOUT_SEEN_AT = "last_about_seen_at"; // number (ms)
const KEY_IGNORED_VERSION = "ignored_version"; // string

const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * ONE_HOUR;
const THREE_DAYS = 3 * ONE_DAY;

// 生产环境兜底的 update.json 检查端点（与 tauri.conf.json 保持一致）
const UPDATE_ENDPOINTS: string[] = [
  "https://github.com/kamjin3086/chatless/releases/latest/download/update.json",
  "https://gh-proxy.com/https://github.com/kamjin3086/chatless/releases/latest/download/update-proxy.json",
  "https://github.com/kamjin3086/chatless/releases/download/updater-alpha/update.json",
  "https://gh-proxy.com/https://github.com/kamjin3086/chatless/releases/download/updater-alpha/update-proxy.json",
];

export interface UpdateAvailability {
  available: boolean;
  version?: string | null;
  availableSince?: number | null;
}

export async function getUpdateAvailability(): Promise<UpdateAvailability> {
  const version = await StorageUtil.getItem<string>(KEY_AVAILABLE_VERSION, null, STORE);
  const since = await StorageUtil.getItem<number>(KEY_AVAILABLE_SINCE, null, STORE);
  return { available: !!version, version, availableSince: since };
}

export async function setUpdateAvailable(version: string): Promise<void> {
  const existed = await StorageUtil.getItem<string>(KEY_AVAILABLE_VERSION, null, STORE);
  await StorageUtil.setItem(KEY_AVAILABLE_VERSION, version, STORE);
  // 当首次检测到更新，或检测到不同于之前的版本时，刷新可用时间戳
  if (!existed || existed !== version) {
    await StorageUtil.setItem(KEY_AVAILABLE_SINCE, Date.now(), STORE);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(UPDATE_AVAILABILITY_EVENT));
  }
}

export async function clearUpdateAvailable(): Promise<void> {
  await StorageUtil.removeItem(KEY_AVAILABLE_VERSION, STORE);
  await StorageUtil.removeItem(KEY_AVAILABLE_SINCE, STORE);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(UPDATE_AVAILABILITY_EVENT));
  }
}

export async function recordAboutViewed(): Promise<void> {
  await StorageUtil.setItem(KEY_LAST_ABOUT_SEEN_AT, Date.now(), STORE);
}

export async function shouldShowAboutBlueDot(): Promise<boolean> {
  const availability = await getUpdateAvailability();
  if (!availability.available) return false;
  const lastSeen = await StorageUtil.getItem<number>(KEY_LAST_ABOUT_SEEN_AT, 0, STORE);
  if (!lastSeen) return true; // 从未看过关于页
  // 若在“关于”页上次查看时间早于本次更新出现时间，则立即显示蓝点
  if (availability.availableSince && lastSeen < availability.availableSince) return true;
  // 否则按照冷却时间（三天）显示
  return (Date.now() - lastSeen) >= THREE_DAYS;
}

export async function checkForUpdatesSilently(force: boolean = false): Promise<UpdateAvailability> {
  try {
    // 在非 Tauri 环境（纯 Web 预览）下，也尝试使用 /update.json 进行开发兜底
    if (typeof window === "undefined" || !(window as any).__TAURI__) {
      try {
        if (typeof window !== 'undefined' && location && /^http:\/\/localhost:\d+/.test(location.origin)) {
          const resp = await fetch('/update.json', { cache: 'no-store' });
          if (resp.ok) {
            const json: any = await resp.json();
            const remote = String(json?.version || '');
            const current = '0.0.0'; // 纯 Web 环境无法读取应用版本，默认 0.0.0 以便开发联调
            const newer = compareVersions(remote, current) > 0;
            if (newer) {
              await setUpdateAvailable(remote);
              return { available: true, version: remote };
            }
          }
        }
      } catch {
        // noop
      }
      return { available: false };
    }

    const lastChecked = await StorageUtil.getItem<number>(KEY_LAST_CHECKED_AT, 0, STORE);
    if (!force && lastChecked && Date.now() - lastChecked < ONE_DAY) {
      return getUpdateAvailability();
    }

    const { check } = await import("@tauri-apps/plugin-updater");
    const result = await check({ timeout: 20_000 });
    await StorageUtil.setItem(KEY_LAST_CHECKED_AT, Date.now(), STORE);

    if (result && (result as any).available) {
      const version = (result as any).version ?? "unknown";
      await setUpdateAvailable(version);
      return { available: true, version };
    } else {
      // 若插件未报告更新，增加生产环境兜底：直接访问 update.json 端点比较版本
      const fallback = await tryFetchUpdateFromEndpoints();
      if (fallback?.available) {
        await setUpdateAvailable(fallback.version!);
        return fallback;
      }

      // 开发场景兜底：尝试读取同源 /update.json（public/update.json）
      try {
        if (location && /^http:\/\/localhost:\d+/.test(location.origin)) {
          const resp = await fetch('/update.json', { cache: 'no-store' });
          if (resp.ok) {
            const json: any = await resp.json();
            const remote = String(json?.version || '');
            let current = '0.0.0';
            try {
              const { getVersion } = await import('@tauri-apps/api/app');
              current = await getVersion();
            } catch { /* noop */ }
            const newer = compareVersions(remote, current) > 0;
            if (newer) {
              await setUpdateAvailable(remote);
              return { available: true, version: remote };
            }
          }
        }
      } catch { /* noop */ }

      await clearUpdateAvailable();
      return { available: false };
    }
  } catch {
    // 插件检查失败：优先尝试生产环境端点兜底
    try {
      const fallback = await tryFetchUpdateFromEndpoints();
      if (fallback?.available) {
        await setUpdateAvailable(fallback.version!);
        return fallback;
      }
    } catch { /* noop */ }

    // 开发场景兜底：尝试 /update.json
    try {
      if (typeof window !== 'undefined' && location && /^http:\/\/localhost:\d+/.test(location.origin)) {
        const resp = await fetch('/update.json', { cache: 'no-store' });
        if (resp.ok) {
          const json: any = await resp.json();
          const remote = String(json?.version || '');
          let current = '0.0.0';
          try {
            const { getVersion } = await import('@tauri-apps/api/app');
            current = await getVersion();
          } catch { /* noop */ }
          const newer = compareVersions(remote, current) > 0;
          if (newer) {
            await setUpdateAvailable(remote);
            return { available: true, version: remote };
          }
        }
      }
    } catch { /* noop */ }

    return getUpdateAvailability();
  }
}

export function scheduleBackgroundUpdateChecks(): void {
  // 启动后立即检查一次（开发体验更好），并在 5s 后再补充一次
  checkForUpdatesSilently(true).catch(() => {});
  setTimeout(() => { checkForUpdatesSilently(false).catch(() => {}); }, 5_000);

  // 每 24 小时检查一次
  setInterval(() => {
    checkForUpdatesSilently(false).catch(() => {});
  }, ONE_DAY);
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((x) => parseInt(x, 10) || 0);
  const pb = b.split('.').map((x) => parseInt(x, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

// ===== 生产环境端点兜底实现 =====
async function tryFetchUpdateFromEndpoints(): Promise<UpdateAvailability | null> {
  try {
    // 仅在 Tauri 环境下执行（避免 Web 预览跨域问题）
    const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI__;
    if (!isTauri) return null;

    // 获取当前应用版本
    let current = '0.0.0';
    try {
      const { getVersion } = await import('@tauri-apps/api/app');
      current = await getVersion();
    } catch { /* noop */ }

    // 优先使用 Tauri HTTP 插件以绕过 CORS；失败则回退到 fetch
    for (const url of UPDATE_ENDPOINTS) {
      let json: any | null = null;
      try {
        const { fetch: httpFetch } = await import('@tauri-apps/plugin-http');
        const resp: any = await httpFetch(url, { method: 'GET', timeout: 20_000 } as any);
        if (resp && (resp.ok ?? true) && resp.data) {
          json = typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
        }
      } catch {
        // 回退到浏览器 fetch（某些环境也可用）
        try {
          const resp2 = await fetch(url, { cache: 'no-store' } as RequestInit);
          if (resp2.ok) json = await resp2.json();
        } catch { /* noop */ }
      }

      if (json) {
        const remote = String(json?.version || '');
        if (remote) {
          const newer = compareVersions(remote, current) > 0;
          if (newer) return { available: true, version: remote };
        }
      }
    }
    return { available: false };
  } catch {
    return null;
  }
}

// ===== 忽略版本（用户选择不再提示当前版本） =====
export async function getIgnoredVersion(): Promise<string | null> {
  return StorageUtil.getItem<string>(KEY_IGNORED_VERSION, null, STORE);
}

export async function setIgnoredVersion(version: string): Promise<void> {
  await StorageUtil.setItem(KEY_IGNORED_VERSION, version, STORE);
}

export async function clearIgnoredVersion(): Promise<void> {
  await StorageUtil.removeItem(KEY_IGNORED_VERSION, STORE);
}

export async function isVersionIgnored(version: string | null | undefined): Promise<boolean> {
  if (!version) return false;
  const ignored = await getIgnoredVersion();
  return !!ignored && ignored === version;
}


