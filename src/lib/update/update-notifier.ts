import StorageUtil from "@/lib/storage";

// 简化：仅持久化“最后检查时间”和“忽略版本”。不持久化可用版本或出现时间
const STORE = "updates.json";
export const UPDATE_AVAILABILITY_EVENT = 'chatless-update-availability-changed';

const KEY_LAST_CHECKED_AT = "last_checked_at"; // number (ms)
const KEY_IGNORED_VERSION = "ignored_version"; // string

const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * ONE_HOUR;

// 仅依赖 Tauri Updater 插件进行检查；不再进行任何自定义网络请求兜底

export interface UpdateAvailability {
  available: boolean;
  version?: string | null;
}

// 单航班锁：避免在启动阶段或设置页并发触发多次插件检查
let inFlightCheck: Promise<UpdateAvailability> | null = null;

export async function getUpdateAvailability(): Promise<UpdateAvailability> {
  try {
    if (typeof window === "undefined") {
      return { available: false };
    }
    const { check } = await import("@tauri-apps/plugin-updater");
    const result = await check({ timeout: 20_000 });
    console.log('[update-notifier] getUpdateAvailability: plugin result', result);
    if (result && (result as any).available) {
      const versionRaw: any = (result as any).version;
      const version: string | null = typeof versionRaw === 'string' && versionRaw.length > 0 ? versionRaw : '新版本';
      return { available: true, version };
    }
    return { available: false };
  } catch {
    return { available: false };
  }
}

// 已移除：setUpdateAvailable/clearUpdateAvailable（不再持久化可用版本）

// 关于页蓝点：简化为“有更新 且 未被忽略”
export async function shouldShowAboutBlueDot(): Promise<boolean> {
  const availability = await getUpdateAvailability();
  if (!availability.available) return false;
  try {
    const ignored = await isVersionIgnored(availability.version);
    if (ignored) return false;
  } catch { /* noop */ }
  return true;
}

export async function checkForUpdatesSilently(force: boolean = false): Promise<UpdateAvailability> {
  // 并发合并：若已有检查在进行，复用同一 Promise
  if (inFlightCheck) return inFlightCheck;

  const doCheck = async (): Promise<UpdateAvailability> => {
    try {
    // 非浏览器环境直接返回无更新
    if (typeof window === "undefined") {
      return { available: false };
    }

    const lastChecked = await StorageUtil.getItem<number>(KEY_LAST_CHECKED_AT, 0, STORE);
    if (!force && lastChecked && Date.now() - lastChecked < ONE_DAY) {
      console.log('[update-notifier] skip check due to throttle. force?', force, 'lastChecked', new Date(lastChecked).toISOString());
      return getUpdateAvailability();
    }

    const { check } = await import("@tauri-apps/plugin-updater");
    const result = await check({ timeout: 20_000 });
    console.log('[update-notifier] silent check: plugin result', result);
    await StorageUtil.setItem(KEY_LAST_CHECKED_AT, Date.now(), STORE);

    if (result && (result as any).available) {
      const versionRaw: any = (result as any).version;
      const version: string = typeof versionRaw === 'string' && versionRaw.length > 0 ? versionRaw : '新版本';
      // 通知前端监听者（携带版本号）
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(UPDATE_AVAILABILITY_EVENT, { detail: { available: true, version } as any }));
        }
      } catch { /* noop */ }
      return { available: true, version };
    }
    return { available: false };
    } catch {
      // 失败路径也记录检查时间，避免短时间内重复检查
      try { await StorageUtil.setItem(KEY_LAST_CHECKED_AT, Date.now(), STORE); } catch { /* noop */ }
      return { available: false };
    }
  };

  inFlightCheck = doCheck();
  try {
    return await inFlightCheck;
  } finally {
    inFlightCheck = null;
  }
}

export function scheduleBackgroundUpdateChecks(): void {
  // 启动后立即检查一次（开发体验更好）。若失败，再在 5s 后补一次；成功则不重复。
  let firstAttemptSucceeded = false;
  checkForUpdatesSilently(true)
    .then(() => { firstAttemptSucceeded = true; })
    .catch(() => {});
  setTimeout(() => {
    if (!firstAttemptSucceeded) {
      checkForUpdatesSilently(false).catch(() => {});
    }
  }, 5_000);

  // 每 24 小时检查一次
  setInterval(() => {
    checkForUpdatesSilently(false).catch(() => {});
  }, ONE_DAY);
}

// 已移除版本比较与自定义端点兜底逻辑，完全依赖 Tauri 插件

// ===== 忽略版本（用户选择不再提示当前版本） =====
export async function getIgnoredVersion(): Promise<string | null> {
  return StorageUtil.getItem<string>(KEY_IGNORED_VERSION, null, STORE);
}

export async function setIgnoredVersion(version: string): Promise<void> {
  await StorageUtil.setItem(KEY_IGNORED_VERSION, version, STORE);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(UPDATE_AVAILABILITY_EVENT));
  }
}

export async function clearIgnoredVersion(): Promise<void> {
  await StorageUtil.removeItem(KEY_IGNORED_VERSION, STORE);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(UPDATE_AVAILABILITY_EVENT));
  }
}

export async function isVersionIgnored(version: string | null | undefined): Promise<boolean> {
  if (!version) return false;
  const ignored = await getIgnoredVersion();
  return !!ignored && ignored === version;
}


