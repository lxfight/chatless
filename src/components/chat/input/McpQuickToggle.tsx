"use client";

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getEnabledConfiguredServers, getConnectedServers, getGlobalEnabledServers, setGlobalEnabledServers } from '@/lib/mcp/chatIntegration';

export function McpQuickToggle({ onInsertMention }: { onInsertMention?: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState<string[]>([]);
  const [connected, setConnected] = useState<string[]>([]);
  const [enabled, setEnabled] = useState<string[]>([]);
  const rootRef = useRef<HTMLDivElement | null>(null);

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

  return (
    <div className="relative" ref={rootRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(v=>!v)}
        className="h-7 w-7 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600"
        title="启用的 MCP"
      >
        <ChevronUp className="w-4 h-4" />
      </Button>
      {open && (
        <div className="absolute bottom-8 left-0 z-[9999] w-72 max-h-80 overflow-auto rounded-md border bg-white dark:bg-gray-800 shadow-2xl p-2 space-y-1">
          <div className="text-[11px] text-slate-500 px-1">未选择时默认使用“所有已连接”的服务器</div>
          {all.length === 0 && (
            <div className="text-xs text-slate-500 px-1 py-1">暂无配置的 MCP 服务器</div>
          )}
          {all.map((name) => (
            <div key={name} className={cn("group flex items-center gap-2 px-2 py-1 rounded text-sm",
              connected.includes(name) ? "hover:bg-slate-50 dark:hover:bg-slate-700/50" : "opacity-50")}
            >
              <label className="flex items-center gap-2 flex-1 cursor-pointer">
                <input
                  type="checkbox"
                  className="scale-90"
                  checked={enabled.includes(name)}
                  onChange={() => toggle(name)}
                />
                <span className="truncate">{name}</span>
                {!connected.includes(name) && <span className="ml-auto text-[10px] text-slate-400">未连接</span>}
              </label>
              <button
                className="ml-2 text-[11px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded px-2 py-0.5 opacity-0 group-hover:opacity-100 transition"
                title="在输入框插入 @ 引用"
                onClick={() => { onInsertMention?.(name); setOpen(false); }}
              >@ 引用</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

