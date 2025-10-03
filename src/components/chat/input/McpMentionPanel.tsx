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
      className="rounded-xl border border-slate-200/60 dark:border-slate-700/50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md shadow-2xl overflow-hidden transition-all duration-200"
    >
      <div className="flex items-center justify-end px-3 py-1.5 border-b border-slate-200/50 dark:border-slate-700/40">
        <button 
          className="p-1.5 rounded-md hover:bg-slate-100/80 dark:hover:bg-slate-800/60 text-slate-500 dark:text-slate-400 transition-colors" 
          onMouseDown={(e)=>{ e.preventDefault(); window.location.assign('/settings?tab=mcpServers'); }} 
          title="MCP 设置"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>
      </div>
      <ul className="max-h-72 overflow-auto py-1.5">
        {items.map((it, idx) => (
          <li 
            key={it.name} 
            onMouseDown={(e)=>{ e.preventDefault(); if (it.allowed) { preheatServer(it.name); onSelect(it.name); } }} 
            onMouseEnter={()=>{ if (it.allowed) { activeRef.current = idx; setItems((v)=>[...v]); } }} 
            className={`mx-2 px-3 py-2.5 rounded-lg transition-all duration-150 ${
              it.allowed ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'
            } ${
              idx === activeRef.current 
                ? 'bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 ring-1 ring-emerald-200/50 dark:ring-emerald-700/50 shadow-sm' 
                : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
            } ${!it.connected ? 'opacity-75' : ''}`}
          >
            <div className="flex items-center gap-2.5">
              <span className="shrink-0 px-1.5 py-0.5 rounded-md border border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/20 text-emerald-700 dark:text-emerald-300 text-xs font-mono font-semibold">@</span>
              <span className="flex-1 truncate font-semibold text-gray-900 dark:text-gray-50">{it.name}</span>
              
              {/* 预热状态指示器 */}
              <div className="flex items-center gap-1.5 shrink-0">
                {preheatingStatus[it.name]?.status === 'preheating' && (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">预热中</span>
                  </>
                )}
                {preheatingStatus[it.name]?.status === 'completed' && (
                  <>
                    <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                    <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">已就绪</span>
                  </>
                )}
                {preheatingStatus[it.name]?.status === 'failed' && (
                  <span className="text-[10px] text-red-600 dark:text-red-400 font-medium">预热失败</span>
                )}
                {!it.allowed && <span className="text-[10px] text-gray-400">未启用</span>}
                {it.allowed && !it.connected && !preheatingStatus[it.name] && (
                  <span className="text-[10px] text-gray-400">未连接</span>
                )}
              </div>
            </div>
            
            {/* 工具列表：始终显示（如果有） */}
            {toolsPreview[it.name] && toolsPreview[it.name].length > 0 && (
              <div className="mt-2 pl-7 flex flex-wrap gap-1.5">
                {toolsPreview[it.name].slice(0, 5).map((tool: string, i: number) => (
                  <span 
                    key={i} 
                    className="px-2 py-0.5 rounded-full bg-gradient-to-r from-slate-100 to-gray-50 dark:from-slate-800/60 dark:to-gray-800/40 text-[10px] text-slate-700 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/50 font-mono"
                  >
                    {tool}
                  </span>
                ))}
                {toolsPreview[it.name].length > 5 && (
                  <span className="text-[10px] text-slate-500">+{toolsPreview[it.name].length - 5}</span>
                )}
              </div>
            )}
            {!toolsPreview[it.name] && it.allowed && it.connected && (
              <div className="mt-2 pl-7 text-[10px] text-gray-400 italic">加载工具中...</div>
            )}
          </li>
        ))}
        {items.length===0 && (
          <li className="px-3 py-3 text-xs text-center text-gray-500">暂无"已启用"的 MCP 服务</li>
        )}
      </ul>
    </div>
  );

  return typeof window !== 'undefined' ? createPortal(panel, document.body) : panel;
}

