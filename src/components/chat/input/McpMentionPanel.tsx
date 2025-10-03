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

  // 预取所有可用服务器的工具名称（打开面板时立即获取）
  useEffect(() => {
    if (!open) return;
    
    const fetchAllTools = async () => {
      const withTimeout = async <T,>(p: Promise<T>, ms = 1000): Promise<T | null> => {
        return await Promise.race([p, new Promise<null>(resolve => setTimeout(()=>resolve(null), ms))]);
      };
      
      for (const it of items) {
        if (!it.allowed || toolsPreview[it.name]) continue;
        
        try {
          const { serverManager } = await import('@/lib/mcp/ServerManager');
          const tools: any[] | null = await withTimeout(serverManager.listTools(it.name) as any, 1000);
          if (!tools) continue;
          const names = tools.slice(0, 5).map((t: any) => (t?.name || 'tool'));
          setToolsPreview(prev => ({ ...prev, [it.name]: names }));
        } catch {
          // ignore preview errors
        }
      }
    };
    
    fetchAllTools();
  }, [open, items]);

// reserved for future schema previews

  if (!open || !pos) return null;

  // 动态宽度：根据输入框宽度自适应，最小400px，最大window宽度90%
  const panelWidth = Math.min(Math.max(pos.width, 400), window.innerWidth * 0.9);

  const panel = (
    <div 
      style={{ 
        position: 'fixed', 
        left: Math.max(8, Math.min(pos.left, window.innerWidth - panelWidth - 8)), 
        bottom: pos.bottom, 
        width: panelWidth, 
        zIndex: 2147483600 
      }} 
      className="rounded-2xl border border-slate-300/60 dark:border-slate-600/50 bg-white/98 dark:bg-slate-900/98 backdrop-blur-xl shadow-2xl overflow-hidden transition-all duration-200"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/60 dark:border-slate-700/50 bg-gradient-to-r from-slate-50/50 to-transparent dark:from-slate-800/30">
        <div className="flex items-center gap-2">
          <div className="px-2 py-1 rounded-lg bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/20 border border-emerald-200/50 dark:border-emerald-700/40">
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">MCP 服务器</span>
          </div>
        </div>
        <button 
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-500 dark:text-slate-400 transition-all hover:scale-105" 
          onMouseDown={(e)=>{ e.preventDefault(); window.location.assign('/settings?tab=mcpServers'); }} 
          title="MCP 设置"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
      <ul className="max-h-80 overflow-auto py-2 px-1">
        {items.map((it, idx) => (
          <li 
            key={it.name} 
            onMouseDown={(e)=>{ e.preventDefault(); if (it.allowed) { preheatServer(it.name); onSelect(it.name); } }} 
            onMouseEnter={()=>{ if (it.allowed) { activeRef.current = idx; setItems((v)=>[...v]); } }} 
            className={`mx-1.5 px-4 py-3 rounded-xl transition-all duration-150 ${
              it.allowed ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'
            } ${
              idx === activeRef.current 
                ? 'bg-gradient-to-br from-emerald-50 via-teal-50/80 to-cyan-50/60 dark:from-emerald-900/25 dark:via-teal-900/20 dark:to-cyan-900/15 ring-2 ring-emerald-300/60 dark:ring-emerald-600/50 shadow-md border border-emerald-200/50 dark:border-emerald-700/40' 
                : 'hover:bg-gradient-to-r hover:from-slate-50 hover:to-gray-50/50 dark:hover:from-slate-800/50 dark:hover:to-slate-800/30 border border-transparent hover:border-slate-200/50 dark:hover:border-slate-700/40'
            } ${!it.connected ? 'opacity-75' : ''}`}
          >
            <div className="flex items-center gap-3">
              <span className="shrink-0 px-2 py-1 rounded-lg border border-emerald-300/60 dark:border-emerald-600/50 bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-800/40 dark:to-teal-800/30 text-emerald-700 dark:text-emerald-300 text-sm font-mono font-bold shadow-sm">@</span>
              <span className="flex-1 truncate font-semibold text-slate-900 dark:text-slate-50 text-base">{it.name}</span>
              
              {/* 预热状态指示器 */}
              <div className="flex items-center gap-2 shrink-0">
                {preheatingStatus[it.name]?.status === 'preheating' && (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-50/80 dark:bg-blue-900/30 border border-blue-200/50 dark:border-blue-700/40">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 dark:text-blue-400" />
                    <span className="text-[11px] text-blue-700 dark:text-blue-300 font-medium">预热中</span>
                  </div>
                )}
                {preheatingStatus[it.name]?.status === 'completed' && (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-green-50/80 dark:bg-green-900/30 border border-green-200/50 dark:border-green-700/40">
                    <CheckCircle className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                    <span className="text-[11px] text-green-700 dark:text-green-300 font-medium">已就绪</span>
                  </div>
                )}
                {preheatingStatus[it.name]?.status === 'failed' && (
                  <div className="px-2 py-1 rounded-lg bg-red-50/80 dark:bg-red-900/30 border border-red-200/50 dark:border-red-700/40">
                    <span className="text-[11px] text-red-700 dark:text-red-300 font-medium">预热失败</span>
                  </div>
                )}
                {!it.allowed && (
                  <div className="px-2 py-1 rounded-lg bg-gray-100/80 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700/40">
                    <span className="text-[11px] text-gray-600 dark:text-gray-400 font-medium">未启用</span>
                  </div>
                )}
                {it.allowed && !it.connected && !preheatingStatus[it.name] && (
                  <div className="px-2 py-1 rounded-lg bg-gray-100/80 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700/40">
                    <span className="text-[11px] text-gray-600 dark:text-gray-400 font-medium">未连接</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* 工具列表：始终显示（如果有） */}
            {toolsPreview[it.name] && toolsPreview[it.name].length > 0 && (
              <div className="mt-3 pl-11 flex flex-wrap gap-2">
                {toolsPreview[it.name].slice(0, 5).map((tool: string, i: number) => (
                  <span 
                    key={i} 
                    className="px-2.5 py-1 rounded-lg bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100/80 dark:from-slate-800/70 dark:via-gray-800/60 dark:to-slate-800/50 text-[11px] text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/50 font-mono shadow-sm hover:shadow-md hover:scale-105 transition-all"
                  >
                    {tool}
                  </span>
                ))}
                {toolsPreview[it.name].length > 5 && (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium self-center">+{toolsPreview[it.name].length - 5} 更多</span>
                )}
              </div>
            )}
            {!toolsPreview[it.name] && it.allowed && it.connected && (
              <div className="mt-3 pl-11 flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
                <span className="text-[11px] text-slate-500 dark:text-slate-400 italic">加载工具中...</span>
              </div>
            )}
          </li>
        ))}
        {items.length===0 && (
          <li className="px-4 py-6 text-center">
            <div className="text-sm text-slate-500 dark:text-slate-400">暂无"已启用"的 MCP 服务</div>
            <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">请前往设置页面配置</div>
          </li>
        )}
      </ul>
    </div>
  );

  return typeof window !== 'undefined' ? createPortal(panel, document.body) : panel;
}

