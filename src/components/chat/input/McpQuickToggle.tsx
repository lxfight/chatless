"use client";

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plug, Settings, RotateCcw, Loader2 } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { getEnabledConfiguredServers, getConnectedServers, getGlobalEnabledServers, setGlobalEnabledServers } from '@/lib/mcp/chatIntegration';
import Link from 'next/link';

export function McpQuickToggle({ onInsertMention }: { onInsertMention?: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState<string[]>([]);
  const [connected, setConnected] = useState<string[]>([]);
  const [enabled, setEnabled] = useState<string[]>([]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const list = await getEnabledConfiguredServers();
      setAll(list);
      setConnected(await getConnectedServers());
      const saved = await getGlobalEnabledServers();
      // 默认：首次无保存记录时，勾选“所有已启用”的服务器
      if (!saved || saved.length === 0) {
        setEnabled(list);
        await setGlobalEnabledServers(list);
      } else {
        setEnabled(saved);
      }
    })();
  }, []);

  const toggle = async (name: string) => {
    const next = enabled.includes(name) ? enabled.filter(n => n !== name) : [...enabled, name];
    setEnabled(next);
    await setGlobalEnabledServers(next);
  };

  // 自动关闭：点击外部 / Esc / 滚动
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!open) return;
      const el = rootRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (open && e.key === 'Escape') setOpen(false); };
    const onScroll = () => { if (open) setOpen(false); };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const unconnected = all.filter((n) => !connected.includes(n));
  const hasDisconnected = unconnected.length > 0;

  const panel = (
    <Popover.Content sideOffset={8} align="start" className="z-[10000] w-80 max-h-72 overflow-auto rounded-xl border bg-white/90 dark:bg-gray-800/90 backdrop-blur-md shadow-xl ring-1 ring-black/5 dark:ring-white/10 p-2">
      {/* 头部：说明 + 齿轮（仅有未连接时显示） */}
      <div className="flex items-center justify-between px-1 pb-2">
        <div className="text-[11px] text-slate-500">未选择时默认使用“所有已连接”的服务器</div>
        <Link
            href="/settings?tab=mcpServers"
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            title="前往 MCP 服务器设置"
          >
            <Settings className="w-3.5 h-3.5" />
            {/* <span className="hidden sm:block">设置</span> */}
          </Link>
      </div>
      {all.length === 0 && (
        <div className="text-xs text-slate-500 px-1 py-1">暂无配置的 MCP 服务器</div>
      )}
      {all.map((name) => (
        <div key={name} className={cn("group flex items-center gap-2 px-2 py-1 rounded text-sm",
          connected.includes(name) ? "hover:bg-slate-50 dark:hover:bg-slate-700/50" : "opacity-75")}
        >
          <label className="flex items-center gap-2 flex-1 cursor-pointer">
            <Checkbox checked={enabled.includes(name)} onCheckedChange={() => toggle(name)} className="h-4 w-4" />
            <span className="truncate">{name}</span>
            {!connected.includes(name) && <span className="ml-auto text-[10px] text-slate-400">未连接</span>}
          </label>
          {!connected.includes(name) && (
            <button
              className="ml-1 inline-flex items-center gap-1 text-[11px] text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded px-2 py-0.5"
              title="尝试连接该服务器"
              onClick={async (e)=>{
                e.stopPropagation();
                try {
                  setBusy(name);
                  const { serverManager } = await import('@/lib/mcp/ServerManager');
                  // 读取配置以连接
                  const { Store } = await import('@tauri-apps/plugin-store');
                  const store = await Store.load('mcp_servers.json');
                  const list = (await store.get<Array<{ name: string; config: any }>>('servers')) || [];
                  const item = list.find(s=>s.name===name);
                  if (item) {
                    await serverManager.startServer(item.name, item.config);
                    // 刷新连接态
                    setConnected(await getConnectedServers());
                  }
                } catch (e) {
                  // 忽略瞬时错误，保持面板轻量
                  void e;
                }
                setBusy(null);
              }}
            >
              {busy===name ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
              连接
            </button>
          )}
          <button
            className="ml-2 text-[11px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded px-2 py-0.5 opacity-0 group-hover:opacity-100 transition"
            title="在输入框插入 @ 引用"
            onClick={() => { onInsertMention?.(name); setOpen(false); }}
          >@ 引用</button>
        </div>
      ))}
    </Popover.Content>
  );

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600"
          title="启用的 MCP"
        >
          <Plug className="w-4 h-4" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>{panel}</Popover.Portal>
    </Popover.Root>
  );
}

