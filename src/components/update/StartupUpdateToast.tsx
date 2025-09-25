"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { getUpdateAvailability, UPDATE_AVAILABILITY_EVENT, isVersionIgnored, setIgnoredVersion } from "@/lib/update/update-notifier";
import { linkOpener } from "@/lib/utils/linkOpener";

/**
 * 启动更新提示组件
 * - 启动后检测是否存在新版本，若有则在右下角以自定义Toast提示
 * - 提供“下载更新”按钮
 * - 提供“忽略此版本”勾选
 */
export function StartupUpdateToast() {
  const showingForVersionRef = useRef<string | null>(null);
  const [onlyCheck, setOnlyCheck] = useState<boolean>(false);

  // 初始化“仅检查更新”偏好
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // 优先读取全局标记（设置页会写入）
        const winAny: any = typeof window !== 'undefined' ? window : undefined;
        const flag = !!winAny?.__CHATLESS_ONLY_CHECK_UPDATE__;
        if (mounted) setOnlyCheck(flag);
        if (!flag) {
          // 若未设置全局标记，则尝试读取存储（避免首次未打开设置页时状态不准）
          const { default: StorageUtil } = await import("@/lib/storage");
          const saved = await StorageUtil.getItem<boolean>('only_check_update', false, 'user-preferences.json');
          if (mounted) setOnlyCheck(!!saved);
        }
      } catch {
        // noop
      }
    })();
    return () => { mounted = false; };
  }, []);

  const showToastFor = useCallback(async (version: string) => {
    try {
      if (await isVersionIgnored(version)) return; // 已被忽略则不提示

      // 避免重复为相同版本弹多次
      if (showingForVersionRef.current === version) return;
      showingForVersionRef.current = version;

      const id = toast.raw(
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold">发现新版本 v{version}</div>
            <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">建议更新以获取最新功能与修复。</div>
            <div className="flex items-center flex-wrap gap-3 mt-2">
              <DownloadButton onlyCheck={onlyCheck} version={version} />
              <Button
                size="sm"
                variant="link"
                onClick={async () => { const ok = await linkOpener.openReleases(); if (!ok) toast.error('无法打开发布页'); }}
                className="h-7 px-2 text-[12px]"
              >查看发布页</Button>
              <label className="inline-flex items-center gap-2 text-[12px] text-slate-600 dark:text-slate-300 select-none cursor-pointer">
                <IgnoreCheckbox version={version} onIgnored={() => { toast.raw.dismiss(id); }} />
                忽略此版本
              </label>
            </div>
          </div>
          <button
            onClick={() => toast.raw.dismiss(id)}
            className="ml-2 -mt-1 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 transition-colors text-[12px]"
            aria-label="关闭"
          >×</button>
        </div>,
        { duration: 60000 }
      );
    } catch {
      // noop
    }
  }, [onlyCheck]);

  // 首次挂载时尝试展示（依赖 TauriApp 内部的静默检查也会很快更新状态）
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const info = await getUpdateAvailability();
        if (!mounted) return;
        if (info.available && info.version) {
          await showToastFor(info.version);
        }
      } catch {
        // noop
      }
    })();
    return () => { mounted = false; };
  }, [showToastFor]);

  // 订阅可用性事件：当后台检查发现新版本时弹出
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = async () => {
      const info = await getUpdateAvailability();
      if (info.available && info.version) {
        await showToastFor(info.version);
      }
    };
    window.addEventListener(UPDATE_AVAILABILITY_EVENT, handler as EventListener);
    return () => window.removeEventListener(UPDATE_AVAILABILITY_EVENT, handler as EventListener);
  }, [showToastFor]);

  return null;
}

function DownloadButton({ onlyCheck, version: _version }: { onlyCheck: boolean; version: string }) {
  const [loading, setLoading] = useState(false);

  const handleDownload = useCallback(async () => {
    try {
      setLoading(true);
      if (onlyCheck) {
        // 仅检查模式：跳转到发布页
        const ok = await linkOpener.openReleases();
        if (!ok) toast.error('无法打开发布页');
        return;
      }

      // 使用 Tauri Updater 下载并安装
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check({ timeout: 30_000 });
      if (!update || !(update as any).available) {
        toast.success('已是最新版本');
        return;
      }
      if ('downloadAndInstall' in update && typeof (update as any).downloadAndInstall === 'function') {
        await (update as any).downloadAndInstall();
        try {
          const { clearUpdateAvailable } = await import('@/lib/update/update-notifier');
          await clearUpdateAvailable();
        } catch { /* noop */ }
        toast.success('更新已安装，即将重启应用');
        const { relaunch } = await import('@tauri-apps/plugin-process');
        relaunch();
      } else {
        // 兼容兜底
        const ok = await linkOpener.openReleases();
        if (!ok) toast.error('无法打开发布页');
      }
    } catch (error) {
      console.error('下载或安装更新失败:', error);
      const offline = typeof navigator !== 'undefined' && navigator && (navigator as any).onLine === false;
      const desc = offline
        ? '当前网络不可用，请检查网络连接后再试。'
        : '可能是网络问题，请检查网络后重试，或前往发布页手动下载安装包。';

      toast.raw(
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold">下载或安装更新失败</div>
            <div className="text-[12px] text-slate-600 dark:text-slate-300 mt-1">{desc}</div>
            <div className="flex items-center gap-3 mt-2">
              <Button size="sm" variant="dialogPrimary" onClick={handleDownload} className="h-7 px-3 text-[12px]">重试</Button>
              <Button
                size="sm"
                variant="dialogSecondary"
                onClick={async () => { try { const { relaunch } = await import('@tauri-apps/plugin-process'); relaunch(); } catch { /* noop */ } }}
                className="h-7 px-3 text-[12px]"
              >重启应用</Button>
              <Button
                size="sm"
                variant="link"
                onClick={async () => { const ok = await linkOpener.openReleases(); if (!ok) toast.error('无法打开发布页'); }}
                className="h-7 px-3 text-[12px]"
              >查看发布页</Button>
            </div>
          </div>
        </div>,
        { duration: 20000 }
      );
    } finally {
      setLoading(false);
    }
  }, [onlyCheck]);

  return (
    <Button size="sm" variant="dialogPrimary" onClick={handleDownload} disabled={loading} className="h-7 px-3 text-[12px]">
      {loading ? '下载中…' : '下载更新'}
    </Button>
  );
}

function IgnoreCheckbox({ version, onIgnored }: { version: string; onIgnored?: () => void }) {
  const [checked, setChecked] = useState(false);

  const onChange = useCallback(async (next: boolean | string) => {
    const c = Boolean(next);
    setChecked(c);
    if (c) {
      try {
        await setIgnoredVersion(version);
        onIgnored?.();
        //toast.success('已忽略此版本');
      } catch {
        // ignore
      }
    }
  }, [version, onIgnored]);

  return (
    <Checkbox checked={checked} onCheckedChange={onChange} />
  );
}

export default StartupUpdateToast;


