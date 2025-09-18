"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { usePromptStore } from '@/store/promptStore';
import { generateShortcutCandidates } from '@/lib/prompt/shortcut';
import { StorageUtil } from '@/lib/storage';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Plus, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SlashPromptPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (promptId: string, opts?: { action?: 'apply' | 'send' | 'fill'; mode?: 'permanent' | 'oneOff' }) => void;
  anchorRef?: React.RefObject<HTMLElement>;
  // 来自主输入框的文本，用于统一过滤，避免重复输入
  queryText?: string;
}

export function SlashPromptPanel({ open, onOpenChange, onSelect, anchorRef, queryText }: SlashPromptPanelProps) {
  const prompts = usePromptStore((s) => s.prompts);
  const loadFromDatabase = usePromptStore((s)=> (s as any).loadFromDatabase);
  const [activeIndex, setActiveIndex] = useState(0);
  const [anchorRect, setAnchorRect] = useState<{left:number; width:number; top:number; bottom:number} | null>(null);
  const [pendingVars, setPendingVars] = useState<Record<string, any>>({});
  const router = useRouter();
  const [altPreview, setAltPreview] = useState(false);

  // 使用 Ref 保存最新的 activeIndex / filtered / pendingVars，避免键盘事件闭包读取到旧值
  const activeIndexRef = useRef(0);
  useEffect(() => { activeIndexRef.current = activeIndex; }, [activeIndex]);
  // filtered 的 Ref 需在其定义之后设置（见下方 useMemo）
  const pendingVarsRef = useRef(pendingVars);
  useEffect(() => { pendingVarsRef.current = pendingVars; }, [pendingVars]);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      setActiveIndex(0);
      activeIndexRef.current = 0;
      // 若还未加载提示词，尝试从数据库拉取
      try { if (prompts.length === 0 && typeof loadFromDatabase === 'function') { loadFromDatabase(); } } catch {}
      // 计算锚点位置
      const calc = () => {
        try {
          const el = anchorRef?.current as HTMLElement | null;
          if (!el) return;
          const rect = el.getBoundingClientRect();
          setAnchorRect({ left: rect.left, width: rect.width, top: rect.top, bottom: rect.bottom });
        } catch {}
      };
      calc();
      window.addEventListener('scroll', calc, true);
      window.addEventListener('resize', calc);
      const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Alt') setAltPreview(true); };
      const onKeyUp = (e: KeyboardEvent) => { if (e.key === 'Alt') setAltPreview(false); };
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      return () => {
        window.removeEventListener('scroll', calc, true);
        window.removeEventListener('resize', calc);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
      };
    }
  }, [open]);

  // 解析 queryText -> pendingVars（副作用，不要在渲染期间 setState）
  useEffect(() => {
    const q = (queryText || '').trim().toLowerCase();
    let text = q;
    const tagMatch = q.match(/tag:([^\s]+)/);
    if (tagMatch) {
      text = q.replace(tagMatch[0], '').trim();
    }
    if (!text.startsWith('/')) { setPendingVars({}); return; }
    const parts = text.split(/\s+/);
    const rest = text.slice(parts[0].length).trim();
    const inlineVars: Record<string,string> = {};
    const varRe = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s]+))/gu;
    let m: RegExpExecArray | null;
    while ((m = varRe.exec(rest))) { inlineVars[m[1]] = (m[3] ?? m[4] ?? m[5] ?? '').toString(); }
    if (Object.keys(inlineVars).length === 0 && rest) {
      const asciiIdx = rest.indexOf('| ');
      const fullIdx = rest.indexOf('｜ ');
      const cutIdx = [asciiIdx, fullIdx].filter(v=>v>=0).sort((a,b)=>a-b)[0];
      if (cutIdx !== undefined) {
        const before = rest.slice(0, cutIdx);
        const after = rest.slice(cutIdx + 2).trim();
        const hasDelimBefore = /[|｜]/.test(before);
        const positional = hasDelimBefore ? before.split(/[|｜]/g).map(s=>s.trim()).filter(Boolean) : [before.trim()].filter(Boolean);
        setPendingVars({ __positional: positional, __postText: after });
      } else {
        const hasDelim = /[|｜]/.test(rest);
        const positional = hasDelim ? rest.split(/[|｜]/g).map(s=>s.trim()).filter(Boolean) : [rest];
        setPendingVars({ __positional: positional });
      }
    } else {
      setPendingVars(inlineVars);
    }
  }, [queryText]);

  const filtered = useMemo(() => {
    const q = (queryText || '').trim().toLowerCase();
    let tagFilter: string | null = null;
    let text = q;
    const tagMatch = q.match(/tag:([^\s]+)/);
    if (tagMatch) {
      tagFilter = tagMatch[1];
      text = q.replace(tagMatch[0], '').trim();
    }
    // 记忆选择（localStorage）
    let pref: Record<string,string> = {};
    try { pref = (window as any).__prompt_pref_cache__ || {}; } catch {}
    // 仅用于过滤/排序的 token
    let token = '';
    if (text.startsWith('/')) {
      const parts = text.split(/\s+/);
      token = parts[0].replace(/^\//,'');
    } else {
      token = text || '';
    }
    const list = prompts
      .filter((p) => {
        const byTag = tagFilter ? (p.tags || []).some((t) => t.toLowerCase().includes(tagFilter)) : true;
        if (!byTag) return false;
        if (!text) return true;
        const hay = `${p.name} ${(p.tags || []).join(' ')} ${p.description || ''}`.toLowerCase();
        const hasSaved = (p as any).shortcuts?.some((s:string)=> s.toLowerCase().startsWith(token));
        const suggested = token && generateShortcutCandidates(p.name, p.tags || [], p.languages || []).some((s)=> s.startsWith(token));
        return hay.includes(text) || hasSaved || suggested;
      })
      .map((p) => {
        const savedShortcuts: string[] = (p as any).shortcuts || [];
        const hasExactSaved = token && savedShortcuts.some(s=>s.toLowerCase()===token);
        const hasSavedPrefix = token && savedShortcuts.some(s=>s.toLowerCase().startsWith(token));
        const isPreferred = token && pref[token] === p.id;
        const suggestedHit = token && !hasSavedPrefix && generateShortcutCandidates(p.name, p.tags || [], p.languages || []).some(s=>s.startsWith(token));
        return { p, hasExactSaved, hasSavedPrefix, isPreferred, suggestedHit };
      });
    if (!q) {
      // 打开时优先展示：收藏其一 + 最近使用 Top，最多 10 个
      const withScore = list.map(({p}) => ({
        p,
        score: (p.favorite ? 1000 : 0) + (p.stats?.uses || 0) * 10 + (p.stats?.lastUsedAt || 0) / 1e12,
      }));
      return withScore.sort((a,b)=>b.score-a.score).map(x=>({ p: x.p, note: ''})).slice(0, 10);
    }
    // 排序：exact saved > preferred memory > saved prefix > suggested > 其他文本命中
    const sorted = list.sort((a,b)=>{
      const scoreA = (a.hasExactSaved?1000:0) + (a.isPreferred?500:0) + (a.hasSavedPrefix?100:0) + (a.suggestedHit?10:0);
      const scoreB = (b.hasExactSaved?1000:0) + (b.isPreferred?500:0) + (b.hasSavedPrefix?100:0) + (b.suggestedHit?10:0);
      return scoreB - scoreA;
    });
    return sorted.slice(0, 20).map(x=>({ p: x.p, note: x.suggestedHit && !x.hasSavedPrefix ? '(建议)' : '' }));
  }, [prompts, queryText]);

  // 将最新的 filtered 列表写入 Ref，供键盘事件读取
  const filteredRef = useRef<any[]>([]);
  useEffect(() => { filteredRef.current = filtered as any[]; }, [filtered]);

  // 当列表变化时，纠正 activeIndex，避免键盘高亮与提交不一致
  useEffect(() => {
    setActiveIndex((i) => Math.max(0, Math.min(i, filtered.length - 1)));
  }, [filtered.length]);

  const isPositionalMode = useMemo(() => {
    const raw = (queryText || '').trim();
    if (!raw.startsWith('/')) return false;
    const parts = raw.split(/\s+/);
    if (parts.length < 2) return false;
    const rest = raw.slice(parts[0].length).trim();
    if (!rest) return false;
    return !/([^\s=]+)\s*=/u.test(rest);
  }, [queryText]);

  // 从元数据或模板内容推导变量定义顺序
  const getVariableKeys = (p: any): string[] => {
    if (!p) return [];
    const metaKeys: string[] = (Array.isArray(p.variables) ? (p.variables as any[]).map(v=>v.key).filter(Boolean) : []) as string[];
    if (metaKeys.length > 0) return metaKeys;
    const content: string = String(p.content || '');
    const pattern = /\{\{\s*([^\s{}=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^}]+)))?\s*\}\}/gu;
    const keys: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(content))) {
      const key = m[1];
      if (key && !keys.includes(key)) keys.push(key);
    }
    return keys;
  };

  // 计算用于渲染的变量值（支持位置参数，并合并默认值）
  const computeVariableValues = (p: any): Record<string, string> => {
    if (!p) return {};
    const defs: Array<{ key: string; defaultValue?: string }> = ((p.variables || []) as any[]).filter(Boolean);
    const keys = getVariableKeys(p);
    const basePairs: Array<[string, string]> = keys.map(k => {
      const meta = defs.find(d=>d.key===k);
      return [k, meta?.defaultValue ?? ''];
    });
    const base: Record<string, string> = Object.fromEntries(basePairs);
    const pos: string[] | undefined = (pendingVars as any).__positional;
    if (Array.isArray(pos) && keys.length > 0) {
      keys.forEach((k, idx) => { base[k] = pos[idx] ?? base[k] ?? ''; });
      return base;
    }
    // key=value 模式：覆盖默认
    const provided = pendingVars as Record<string, string>;
    for (const k in provided) { if (k !== '__positional') base[k] = String(provided[k] ?? ''); }
    return base;
  };

  // 返回变量与填充状态（input/default/missing）供 UI 展示
  const getVariableStatuses = (p: any): Array<{ key: string; value: string; source: 'input' | 'default' | 'missing' }> => {
    const keys = getVariableKeys(p);
    if (keys.length === 0) return [];
    const values = computeVariableValues(p);
    const providedKV = pendingVars;
    const pos = (providedKV as any).__positional as string[] | undefined;
    return keys.map((k, idx) => {
      const v = values[k] ?? '';
      const hasMetaDefault = Array.isArray(p.variables) && !!(p.variables as any[]).find((d:any)=>d.key===k && d.defaultValue);
      const fromInput = (pos ? idx < (pos?.length || 0) && pos[idx] !== undefined : Object.prototype.hasOwnProperty.call(providedKV, k));
      const source: 'input' | 'default' | 'missing' = v ? (fromInput ? 'input' : (hasMetaDefault ? 'default' : 'input')) : (hasMetaDefault ? 'default' : 'missing');
      return { key: k, value: v, source };
    });
  };

  // 将模板渲染为高亮 React 片段（高亮变量值）
  const renderHighlighted = (template: string, values: Record<string, string>) => {
    const pattern = /\{\{\s*([^\s{}=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^}]+)))?\s*\}\}/gu;
    const nodes: React.ReactNode[] = [];
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(template))) {
      const [match, key, d1, d2, d3] = m as unknown as [string, string, string?, string?, string?];
      const before = template.slice(lastIndex, m.index);
      if (before) nodes.push(before);
      const fallback = d1 ?? d2 ?? (d3 ? String(d3).trim() : undefined);
      const value = (values[key] ?? fallback ?? '').toString();
      nodes.push(
        <span key={m.index} className="px-1 rounded bg-yellow-100/70 dark:bg-yellow-900/40 text-yellow-900 dark:text-yellow-100">
          {value}
        </span>
      );
      lastIndex = m.index + match.length;
    }
    const tail = template.slice(lastIndex);
    if (tail) nodes.push(tail);
    return nodes;
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape') { onOpenChange(false); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = Math.min(activeIndexRef.current + 1, (filteredRef.current).length - 1);
        activeIndexRef.current = next;
        setActiveIndex(next);
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = Math.max(activeIndexRef.current - 1, 0);
        activeIndexRef.current = prev;
        setActiveIndex(prev);
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const list: any[] = filteredRef.current;
        const idx = Math.max(0, Math.min(activeIndexRef.current, list.length - 1));
        const id = (list[idx])?.p?.id || (list[idx])?.id;
        if (id) {
          try { const ev = new CustomEvent('prompt-inline-vars', { detail: pendingVarsRef.current }); window.dispatchEvent(ev); } catch {}
          // 新规则：回车直接发送；Alt+回车应用为系统（Shift+Alt 为一次性）
          const useApply = (e as any).altKey || (e as any).metaKey; // 允许 ⌘ 兼容
          if (useApply) {
            const oneOff = (e as any).shiftKey;
            onSelect(id, { action: 'apply', mode: oneOff ? 'oneOff' : 'permanent' });
          } else {
            onSelect(id, { action: 'fill' });
          }
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onSelect, onOpenChange]);

  if (!open) return null;

  const rect = anchorRect || { left: 0, width: 0, top: 0, bottom: 0 };

  const panel = (
    <div
      ref={panelRef}
      className={cn(
        "fixed z-[2147483600] w-[min(720px,92vw)] rounded-xl border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-gray-900 shadow-lg overflow-hidden",
        open ? "opacity-100 scale-100" : "opacity-0 scale-95"
      )}
      style={{ left: Math.max(8, Math.min(rect.left, window.innerWidth - Math.min(720, window.innerWidth*0.92) - 8)), bottom: Math.max(8, window.innerHeight - rect.top + 8) }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="px-3 pt-2 pb-2 border-b border-slate-200/70 dark:border-slate-700/60">
        {/* 顶部提示与工具区 */}
        <div className="flex items-center justify-between">
          {/* 动态操作提示：更克制的提示色 */}
          <div
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-300 dark:bg-slate-800/40 dark:border-slate-700",
              altPreview && "text-purple-700 bg-purple-50 border-purple-200 dark:text-purple-200 dark:bg-purple-900/25 dark:border-purple-800"
            )}
          >
            {altPreview ? (
              <span>回车：设为系统提示词</span>
            ) : (
              <span>回车：代入提示词 Alt+回车：设为系统提示词</span>
            )}
          </div>
          {filtered.length === 0 && (
            <Button aria-label="添加提示词" variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 shrink-0" onMouseDown={(e)=>{ e.preventDefault(); onOpenChange(false); router.push('/prompts'); }}>
              <Plus className="w-4 h-4" />
            </Button>
          )}
        </div>
        {/* 使用说明：不抢眼的小字行 */}
        <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
          <span><span className="px-1 rounded bg-slate-100 dark:bg-slate-800 font-mono text-slate-700 dark:text-slate-300">空格</span> 代入变量，</span>
          <span className="px-1 rounded bg-slate-100 dark:bg-slate-800 font-mono text-slate-700 dark:text-slate-300">|</span>
          <span> 位置参数/结束变量，</span>
          <span className="px-1 rounded bg-slate-100 dark:bg-slate-800 font-mono text-slate-700 dark:text-slate-300">/tag:学习</span>
          <span> 过滤提示词</span>
        </div>
      </div>
      <ScrollArea className="max-h-60">
        <ul className="py-1">
          {filtered.map((item, idx) => (
            <li key={item.p.id} className={cn('px-3 py-2 cursor-pointer text-sm flex items-start justify-between', idx === activeIndex ? 'bg-indigo-50 dark:bg-indigo-900/30 ring-1 ring-indigo-200 dark:ring-indigo-700' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30')} onMouseEnter={() => setActiveIndex(idx)} onMouseDown={(e) => {
              e.preventDefault();
              const q = (queryText || '').trim().toLowerCase();
              const token = q.startsWith('/') ? q.replace(/^\//,'') : '';
              if (token) {
                (async ()=>{
                  try {
                    const cur = (await StorageUtil.getItem<Record<string,string>>('prompt-shortcut-preference', {}, 'user-preferences.json')) || {};
                    cur[token] = item.p.id;
                    await StorageUtil.setItem('prompt-shortcut-preference', cur, 'user-preferences.json');
                    try { (window as any).__prompt_pref_cache__ = cur; } catch {}
                  } catch {}
                })();
              }
              try { const ev = new CustomEvent('prompt-inline-vars', { detail: pendingVars }); window.dispatchEvent(ev); } catch {}
              const useApply = (e as any).altKey || (e as any).metaKey;
              if (useApply) {
                const oneOff = (e as any).shiftKey;
                onSelect(item.p.id, { action: 'apply', mode: oneOff ? 'oneOff' : 'permanent' });
              } else {
                onSelect(item.p.id, { action: 'fill' });
              }
            }}>
              {/* 选中左侧强调条 */}
              <div className={cn("mr-2 mt-0.5 rounded-full", idx===activeIndex ? "w-1.5 h-6 bg-indigo-500" : "w-1.5 h-6 bg-transparent")}/>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-gray-800 dark:text-gray-100 truncate flex items-center gap-2">
                  <span className="truncate">{item.p.name}</span>
                  {Array.isArray((item.p as any).shortcuts) && (item.p as any).shortcuts.length > 0 && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {((item.p as any).shortcuts as string[]).slice(0,3).map(s => (
                        <span key={s} className="px-1.5 py-0.5 rounded-md border border-slate-200 bg-slate-50 text-[11px] text-slate-700">/{s}</span>
                      ))}
                      {((item.p as any).shortcuts as string[]).length > 3 && (
                        <span className="text-[11px] text-slate-600">+{((item.p as any).shortcuts as string[]).length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
                {item.p.tags && item.p.tags.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {item.p.tags.slice(0,6).map((t:string) => (
                      <span key={t} className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/60 text-[11px] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">{t}</span>
                    ))}
                    {item.p.tags.length > 6 && (
                      <span className="text-[11px] text-slate-500">+{item.p.tags.length - 6}</span>
                    )}
                  </div>
                )}
                <div className="mt-1 rounded bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 px-2 py-1 text-[12px] leading-5 whitespace-normal break-words line-clamp-3">
                  {renderHighlighted(item.p.content, computeVariableValues(item.p))}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                {item.p.stats?.uses ? <span className="text-[11px] text-gray-400">{item.p.stats.uses} 次</span> : null}
                {item.note && <span className="text-[11px] text-indigo-600">{item.note}</span>}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  onMouseDown={(ev)=>{ ev.preventDefault(); try { const ce = new CustomEvent('prompt-inline-vars', { detail: pendingVars }); window.dispatchEvent(ce); } catch {} ; onSelect(item.p.id, { action: 'fill' }); }}
                  title="代入到输入框（不直接发送）"
                >
                  <Zap className="w-3.5 h-3.5" />
                </Button>
              </div>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-[12px] text-gray-600 dark:text-gray-300">没有匹配的提示词 · 试试 <span className="font-medium">tag:写作</span></li>
          )}
        </ul>
      </ScrollArea>
    </div>
  );

  // Portal 到 body，避免被上层 overflow 裁剪/遮挡
  if (typeof window !== 'undefined') {
    return createPortal(panel, document.body);
  }
  return panel;
}

