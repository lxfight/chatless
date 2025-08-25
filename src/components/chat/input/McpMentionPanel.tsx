"use client";

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getEnabledConfiguredServers, getConnectedServers } from '@/lib/mcp/chatIntegration';

interface McpMentionPanelProps {
  open: boolean;
  anchorRef: React.RefObject<HTMLTextAreaElement>;
  onSelect: (name: string) => void;
  onClose: () => void;
  filterQuery?: string;
}

export function McpMentionPanel({ open, anchorRef, onSelect, onClose, filterQuery = '' }: McpMentionPanelProps) {
  const [items, setItems] = useState<Array<{ name: string; connected: boolean }>>([]);
  const [pos, setPos] = useState<{ left: number; bottom: number; width: number } | null>(null);
  const activeRef = useRef(0);
  const [toolsPreview, setToolsPreview] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!open) return;
    (async () => {
      const all = await getEnabledConfiguredServers();
      const connected = new Set(await getConnectedServers());
      // 过滤：按字母匹配（前缀优先，其次包含）
      const q = (filterQuery || '').toLowerCase();
      let list = all.map(n => ({ name: n, connected: connected.has(n) }));
      if (q) {
        const prefix = list.filter(it => it.name.toLowerCase().startsWith(q));
        const contains = list.filter(it => it.name.toLowerCase().includes(q) && !it.name.toLowerCase().startsWith(q));
        list = [...prefix, ...contains];
      }
      setItems(list);
      activeRef.current = 0;
    })();
  }, [open, filterQuery]);

  useEffect(() => {
    if (!open) return;
    const el = anchorRef.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({ left: rect.left + 56, bottom: window.innerHeight - rect.top + 36, width: rect.width - 72 });
    const onKey = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape') { onClose(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); activeRef.current = Math.min(activeRef.current + 1, items.length - 1); setItems((v)=>[...v]); }
      if (e.key === 'ArrowUp') { e.preventDefault(); activeRef.current = Math.max(activeRef.current - 1, 0); setItems((v)=>[...v]); }
      if (e.key === 'Enter') { e.preventDefault(); const it = items[activeRef.current]; if (it) { onSelect(it.name); } }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, items, anchorRef, onSelect, onClose]);

  // 预取当前高亮服务器的工具摘要（带缓存与超时）
  useEffect(() => {
    if (!open) return;
    const it = items[activeRef.current];
    if (!it || toolsPreview[it.name]) return;
    (async () => {
      try {
        const { serverManager } = await import('@/lib/mcp/ServerManager');
        const withTimeout = async <T,>(p: Promise<T>, ms = 1200): Promise<T | null> => {
          return await Promise.race([p, new Promise<null>(resolve => setTimeout(()=>resolve(null), ms))]);
        };
        const tools: any[] | null = await withTimeout(serverManager.listTools(it.name) as any, 1200);
        if (!tools) return;
        const pick = tools.slice(0, 5).map((t: any) => (t?.name || 'tool'));
        setToolsPreview(prev => ({ ...prev, [it.name]: pick }));
      } catch {}
    })();
  }, [open, items, activeRef.current]);

  function buildExampleFromSchema(schema: any): string | undefined {
    try {
      if (!schema || typeof schema !== 'object') return undefined;
      const props = schema.properties || schema?.schema?.properties;
      if (!props || typeof props !== 'object') return '{}';
      const obj: any = {};
      const required: string[] = schema.required || schema?.schema?.required || [];
      for (const key of Object.keys(props).slice(0, 3)) {
        const p = props[key];
        const type = p?.type || (Array.isArray(p?.type) ? p.type[0] : 'string');
        obj[key] = type === 'number' || type === 'integer' ? 0 : type === 'boolean' ? false : type === 'array' ? [] : '';
      }
      // 加注：只显示必填字段
      const filtered = Object.fromEntries(Object.entries(obj).filter(([k]) => required.length === 0 || required.includes(k)));
      return JSON.stringify(Object.keys(filtered).length ? filtered : obj);
    } catch {
      return undefined;
    }
  }

  if (!open || !pos) return null;

  const panel = (
    <div style={{ position: 'fixed', left: pos.left, bottom: pos.bottom, width: pos.width, zIndex: 2147483600 }} className="bg-white dark:bg-gray-900 shadow-md border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
      <ul className="max-h-56 overflow-auto py-1">
        {items.map((it, idx) => (
          <li key={it.name} onMouseDown={(e)=>{ e.preventDefault(); onSelect(it.name); }} onMouseEnter={()=>{ activeRef.current = idx; setItems((v)=>[...v]); }} className={`px-3 py-1.5 text-sm cursor-pointer ${idx===activeRef.current?'bg-emerald-50/70 dark:bg-emerald-900/30':''} ${it.connected?'':'opacity-60'}`}>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 text-[11px]">@</span>
              <span className="truncate font-medium">{it.name}</span>
              {!it.connected && <span className="ml-auto text-[10px] text-gray-400">未连接</span>}
            </div>
            {toolsPreview[it.name] && toolsPreview[it.name].length > 0 && (
              <div className="mt-0.5 pl-6 text-[11px] text-gray-600 dark:text-gray-300 truncate">
                {(() => {
                  const names = toolsPreview[it.name] || [];
                  const text = names.join(', ');
                  return names.length < 5 ? text : `${names.slice(0,5).join(', ')}…`;
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

