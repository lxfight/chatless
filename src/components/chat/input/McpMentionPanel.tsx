"use client";

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getEnabledConfiguredServers, getConnectedServers, getGlobalEnabledServers } from '@/lib/mcp/chatIntegration';
import { Settings, Loader2, CheckCircle } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { mcpPreheater } from '@/lib/mcp/mcpPreheater';

interface McpMentionPanelProps {
  open: boolean;
  anchorRef: React.RefObject<HTMLTextAreaElement>;
  onSelect: (name: string) => void;
  onClose: () => void;
  filterQuery?: string;
}

export function McpMentionPanel({ open, anchorRef, onSelect, onClose, filterQuery = '' }: McpMentionPanelProps) {
  const [items, setItems] = useState<Array<{ name: string; connected: boolean; allowed: boolean }>>([]);
  const [pos, setPos] = useState<{ left: number; bottom: number; width: number } | null>(null);
  const activeRef = useRef(0);
  const [toolsPreview, setToolsPreview] = useState<Record<string, string[]>>({});
  const [preheatingStatus, setPreheatingStatus] = useState<Record<string, { status: string; toolCount?: number }>>({});

  // 预热：被选择但未连接时，尝试快速连接并预取工具
  const preheatServer = async (name: string) => {
    try {
      // 若已连接，则无需再次连接/预热
      try {
        const { serverManager } = await import('@/lib/mcp/ServerManager');
        if (serverManager.isServerConnected(name)) return;
      } catch { /* ignore */ }
      toast.info(`正在连接 ${name}…`, { duration: 1200 });
      const { getAllConfiguredServersWithStatus } = await import('@/lib/mcp/chatIntegration');
      const list = await getAllConfiguredServersWithStatus();
      const item = list.find(s => s.name === name);
      if (!item) return;
      const { serverManager } = await import('@/lib/mcp/ServerManager');
      const withTimeout = async <T,>(p: Promise<T>, ms = 1500): Promise<T | null> => {
        return await Promise.race([p, new Promise<null>(resolve => setTimeout(()=>resolve(null), ms))]);
      };
      let connectedOk = true;
      try {
        const res = await withTimeout(serverManager.startServer(name, (item as any).config) as any, 1500);
        if (res === null) connectedOk = false;
      } catch { connectedOk = false; }
      try {
        const tools: any[] | null = await withTimeout(serverManager.listTools(name) as any, 1200);
        if (Array.isArray(tools)) {
          const names = tools.slice(0,3).map((t:any)=>t?.name||'tool');
          setToolsPreview(prev => ({ ...prev, [name]: names }));
        }
      } catch { /* ignore */ }
      if (!connectedOk) toast.error(`连接 ${name} 失败`, {description: `请前往管理页检查配置和网络连接`, duration: 3000 });
    } catch {
      toast.error(`连接 ${name} 失败`, {description: `请前往管理页检查配置和网络连接`, duration: 3000 });
    }
  };

  useEffect(() => {
    if (!open) return;
    (async () => {
      const all = await getEnabledConfiguredServers();
      const connected = new Set(await getConnectedServers());
      const globallyEnabled = new Set(await getGlobalEnabledServers());
      // 过滤：按字母匹配（前缀优先，其次包含）
      const q = (filterQuery || '').toLowerCase();
      let list = all.map(n => ({ name: n, connected: connected.has(n), allowed: globallyEnabled.has(n) }));
      if (q) {
        const prefix = list.filter(it => it.name.toLowerCase().startsWith(q));
        const contains = list.filter(it => it.name.toLowerCase().includes(q) && !it.name.toLowerCase().startsWith(q));
        list = [...prefix, ...contains];
      }
      setItems(list);
      
      // 获取预热状态
      const preheatStatus = mcpPreheater.getPreheatingStatus();
      const statusMap: Record<string, { status: string; toolCount?: number }> = {};
      
      list.forEach(item => {
        const status = preheatStatus[item.name];
        if (status) {
          statusMap[item.name] = {
            status: status.status,
          };
        }
      });
      
      setPreheatingStatus(statusMap);
      
      // 将焦点移动到第一个"可选项"（已启用且已连接）
      const firstIdx = list.findIndex((it) => it.allowed && it.connected);
      activeRef.current = firstIdx >= 0 ? firstIdx : 0;
    })();
  }, [open, filterQuery]);

  useEffect(() => {
    if (!open) return;
    const el = anchorRef.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({ left: rect.left + 56, bottom: window.innerHeight - rect.top + 36, width: rect.width - 72 });
    const onKey = (e: KeyboardEvent) => {
      if (!open) return;
      const isSelectable = (it?: {allowed:boolean; connected:boolean}) => !!it && it.allowed; // 未连接也可选择
      if (e.key === 'Escape') { onClose(); }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        let i = activeRef.current;
        for (let step = 0; step < items.length; step++) {
          i = (i + 1) % items.length;
          if (isSelectable(items[i])) { activeRef.current = i; break; }
        }
        setItems((v)=>[...v]);
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        let i = activeRef.current;
        for (let step = 0; step < items.length; step++) {
          i = (i - 1 + items.length) % items.length;
          if (isSelectable(items[i])) { activeRef.current = i; break; }
        }
        setItems((v)=>[...v]);
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const it = items[activeRef.current];
        if (isSelectable(it)) { preheatServer(it.name); onSelect(it.name); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, items, anchorRef, onSelect, onClose]);

  // 预取当前高亮服务器的少量工具名称（带缓存与超时）
  useEffect(() => {
    if (!open) return;
    const it = items[activeRef.current];
    if (!it || toolsPreview[it.name] || !it.allowed) return;
    (async () => {
      try {
        const { serverManager } = await import('@/lib/mcp/ServerManager');
        const withTimeout = async <T,>(p: Promise<T>, ms = 1200): Promise<T | null> => {
          return await Promise.race([p, new Promise<null>(resolve => setTimeout(()=>resolve(null), ms))]);
        };
        const tools: any[] | null = await withTimeout(serverManager.listTools(it.name) as any, 1200);
        if (!tools) return;
        const names = tools.slice(0, 3).map((t: any) => (t?.name || 'tool'));
        setToolsPreview(prev => ({ ...prev, [it.name]: names }));
      } catch {
        // ignore preview errors
      }
    })();
  }, [open, items, activeRef.current]);

// reserved for future schema previews

  if (!open || !pos) return null;

  const panel = (
    <div style={{ position: 'fixed', left: pos.left, bottom: pos.bottom, width: pos.width, zIndex: 2147483600 }} className="rounded-xl border border-slate-200/70 dark:border-slate-700/60 bg-white/70 dark:bg-gray-900/50 backdrop-blur-sm shadow-lg overflow-hidden">
      <div className="flex items-center justify-end px-2 pt-1 pb-0.5">
        <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500" onMouseDown={(e)=>{ e.preventDefault(); window.location.assign('/settings?tab=mcpServers'); }} title="MCP 设置">
          <Settings className="h-4 w-4" />
        </button>
      </div>
      <ul className="max-h-56 overflow-auto py-1">
        {items.map((it, idx) => (
          <li key={it.name} onMouseDown={(e)=>{ e.preventDefault(); if (it.allowed) { preheatServer(it.name); onSelect(it.name); } }} onMouseEnter={()=>{ if (it.allowed) { activeRef.current = idx; setItems((v)=>[...v]); } }} className={`px-3 py-1.5 text-sm ${it.allowed?'cursor-pointer':'cursor-not-allowed opacity-50'} ${idx===activeRef.current?'bg-slate-100/70 dark:bg-slate-800/40':'hover:bg-slate-50 dark:hover:bg-slate-800/30'} ${it.connected?'':'opacity-60'}`}>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 text-[11px]">@</span>
              <span className="truncate font-medium">{it.name}</span>
              
              {/* 预热状态指示器 */}
              {preheatingStatus[it.name]?.status === 'preheating' && (
                <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
              )}
              {preheatingStatus[it.name]?.status === 'completed' && (
                <CheckCircle className="w-3 h-3 text-green-500" />
              )}
              
              {!it.allowed && <span className="ml-auto text-[10px] text-gray-400">未启用</span>}
              {it.allowed && !it.connected && !preheatingStatus[it.name] && <span className="ml-auto text-[10px] text-gray-400">未连接</span>}
              {preheatingStatus[it.name]?.status === 'preheating' && <span className="ml-auto text-[10px] text-blue-500">预热中</span>}
              {preheatingStatus[it.name]?.status === 'completed' && <span className="ml-auto text-[10px] text-green-500">已就绪</span>}
              {preheatingStatus[it.name]?.status === 'failed' && <span className="ml-auto text-[10px] text-red-500">预热失败</span>}
            </div>
            {toolsPreview[it.name] && toolsPreview[it.name].length > 0 && (
              <div className="mt-0.5 pl-6 text-[11px] text-gray-600 dark:text-gray-300 truncate">
                {(() => {
                  const names = toolsPreview[it.name] || [];
                  const text = names.join(', ');
                  return names.length < 3 ? text : `${names.slice(0,3).join(', ')}…`;
                })()}
              </div>
            )}
          </li>
        ))}
        {items.length===0 && <li className="px-3 py-2 text-xs text-gray-500">暂无“已启用”的 MCP</li>}
      </ul>
    </div>
  );

  return typeof window !== 'undefined' ? createPortal(panel, document.body) : panel;
}

