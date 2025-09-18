"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { usePromptStore } from '@/store/promptStore';
import { generateShortcutCandidates } from '@/lib/prompt/shortcut';
import { StorageUtil } from '@/lib/storage';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';
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

  // 轮播提示（固定列表 + 定时切换）
  const hintList = useMemo(() => (
    [
      ['空格', '代入变量'],
      ['|', '分隔/结束参数输入'],
      ['/tag:', '过滤'],
      ['Enter', '使用'],
      ['Alt+Enter', '设为系统']
    ] as const
  ), []);
  const [hintIndex, setHintIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setHintIndex((i) => (i + 1) % hintList.length), 3500);
    return () => clearInterval(timer);
  }, [hintList.length]);

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
    if (q === '/') return [] as any[]; // 仅输入斜线：不展开任何项
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
        if (!text || text === '/') return false; // 避免空或仅斜线时误命中
        const hay = `${p.name} ${(p.tags || []).join(' ')} ${p.description || ''}`.toLowerCase();
        const hasSaved = token && (p as any).shortcuts?.some((s:string)=> s.toLowerCase().startsWith(token));
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
    // 返回最多 50 条匹配用于“展开集合”
    const sorted = list.sort((a,b)=>{
      const scoreA = (a.hasExactSaved?1000:0) + (a.isPreferred?500:0) + (a.hasSavedPrefix?100:0) + (a.suggestedHit?10:0);
      const scoreB = (b.hasExactSaved?1000:0) + (b.isPreferred?500:0) + (b.hasSavedPrefix?100:0) + (b.suggestedHit?10:0);
      return scoreB - scoreA;
    });
    return sorted.slice(0, 50).map(x=>({ p: x.p, note: x.suggestedHit && !x.hasSavedPrefix ? '(建议)' : '' }));
  }, [prompts, queryText]);

  // 将最新的 filtered 列表写入 Ref，供键盘事件读取
  const filteredRef = useRef<any[]>([]);
  useEffect(() => { filteredRef.current = filtered as any[]; }, [filtered]);

  // 可导航列表：有匹配项时使用匹配集合，否则（例如仅输入'/'）使用全部提示词
  const navigableRef = useRef<any[]>([]);
  useEffect(() => {
    if ((filtered?.length || 0) > 0) {
      navigableRef.current = (filtered as any[]).map((x:any)=> x.p);
    } else {
      navigableRef.current = prompts as any[];
    }
  }, [filtered, prompts]);

  // 悬浮项 id：鼠标在面板上移动时临时生效；移出面板后恢复到选中项
  const [hoverId, setHoverId] = useState<string | null>(null);

  // 选中项：仅输入 '/' 时不选中；有匹配项时默认选中第一条
  const onlySlash = useMemo(() => {
    const q = (queryText || '').trim();
    return q === '/';
  }, [queryText]);

  useEffect(() => {
    if (onlySlash) {
      setActiveIndex(-1);
      activeIndexRef.current = -1 as any;
    } else if ((filtered?.length || 0) > 0) {
      setActiveIndex(0);
      activeIndexRef.current = 0;
    } else {
      setActiveIndex(-1);
      activeIndexRef.current = -1 as any;
    }
    // 每次查询变化时，清空悬浮，避免保留无效 hoverId 导致不展开
    setHoverId(null);
  }, [onlySlash, filtered?.length, queryText]);

  // 打开面板时也清空悬浮，避免沿用上一次的 hoverId
  useEffect(() => { if (open) setHoverId(null); }, [open]);

  // 当前选中项 id（用于同步展开项）
  const selectedId = useMemo(() => {
    if (activeIndex < 0) return null;
    if (onlySlash) {
      const list = navigableRef.current || [];
      return list[activeIndex]?.id ?? null;
    }
    return (filtered[activeIndex]?.p?.id) ?? null;
  }, [activeIndex, onlySlash, filtered]);

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
        const list = navigableRef.current || [];
        const start = activeIndexRef.current < 0 ? 0 : activeIndexRef.current + 1;
        const next = Math.min(start, list.length - 1);
        activeIndexRef.current = next;
        setActiveIndex(next);
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const list = navigableRef.current || [];
        const base = activeIndexRef.current < 0 ? 0 : activeIndexRef.current - 1;
        const prev = Math.max(base, 0);
        activeIndexRef.current = prev;
        setActiveIndex(prev);
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const list: any[] = navigableRef.current || [];
        let idx = activeIndexRef.current;
        if (idx < 0) {
          // 无选中：优先 hover，其次第一项
          if (hoverId) idx = Math.max(0, list.findIndex((it:any)=> (it.p?.id||it.id) === hoverId));
          if (idx < 0) idx = 0;
        }
        if (idx < 0 || idx >= list.length) return;
        const id = (list[idx])?.p?.id || (list[idx])?.id;
        if (!id) return;
        try { const ev = new CustomEvent('prompt-inline-vars', { detail: pendingVarsRef.current }); window.dispatchEvent(ev); } catch {}
        const useApply = (e as any).altKey || (e as any).metaKey;
        if (useApply) {
          const oneOff = (e as any).shiftKey;
          onSelect(id, { action: 'apply', mode: oneOff ? 'oneOff' : 'permanent' });
        } else {
          onSelect(id, { action: 'fill' });
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onSelect, onOpenChange, hoverId]);

  if (!open) return null;

  const rect = anchorRect || { left: 0, width: 0, top: 0, bottom: 0 };

  const panel = (
    <div
      ref={panelRef}
      className={cn(
        "fixed z-[2147483600] w-[min(720px,92vw)] rounded-lg border border-slate-200/50 dark:border-slate-700/50 bg-white dark:bg-gray-900 shadow-lg overflow-hidden",
        open ? "opacity-100 scale-100" : "opacity-0 scale-95"
      )}
      style={{ left: Math.max(8, Math.min(rect.left, window.innerWidth - Math.min(720, window.innerWidth*0.92) - 8)), bottom: Math.max(8, window.innerHeight - rect.top + 8) }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* 顶部已去除，防止高度变化时挤压上方内容 */}
      {/* 列表区域：无滚动时最多 6 项，超出出现滚动条；当仅输入'/'时展示全部提示词的折叠项 */}
      <ScrollArea className={cn(
        (queryText || '').trim().startsWith('/') ? (prompts.length > 6 ? 'max-h-60' : '') : (filtered.length > 6 ? 'max-h-60' : '')
      )} onMouseLeave={() => setHoverId(null)}>
        <ul className="py-1">
          {(() => {
            const q = (queryText || '').trim().toLowerCase();
            const startWithSlash = q.startsWith('/');
            // 展开集合：匹配到的提示词 id 集合
            const expandedId = (hoverId ?? selectedId) || '';
            let source: any[];
            if (startWithSlash) {
              source = (q === '/' || q === '') ? (prompts as any[]) : (filtered as any[]).map((x:any)=> x.p);
            } else {
              source = (filtered as any[]).map((x:any)=> x.p);
            }
            return source.map((p:any, idx:number) => (
              <li key={p.id}
                  className={cn('px-3 py-2 cursor-pointer text-sm flex flex-col rounded-md transition-colors', (hoverId ? hoverId===p.id : selectedId===p.id) ? 'bg-slate-100 ring-1 ring-slate-300 dark:bg-slate-800/40 dark:ring-slate-700' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30')}
                  onMouseEnter={() => { setHoverId(p.id); setActiveIndex(idx); activeIndexRef.current = idx; }}
                  onMouseDown={(e)=>{
                    e.preventDefault();
                    // 确保点击也能代入：将该项设为选中后触发填充
                    setActiveIndex(idx); activeIndexRef.current = idx; setHoverId(p.id);
                    const ev = new CustomEvent('prompt-inline-vars', { detail: pendingVars });
                    try { window.dispatchEvent(ev); } catch {}
                    onSelect(p.id, { action: 'fill' } as any);
                  }}
              >
                {/* 折叠标题行：名称在左、命令/shortcut右对齐，无边框，更醒目 */}
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-800 dark:text-gray-100 truncate">{p.name}</span>
                  <span className="ml-2 text-xs text-amber-700 dark:text-amber-300 font-semibold tabular-nums">/{((p as any).shortcuts?.[0] || (p.name||'')[0]?.toLowerCase() || '')}</span>
                </div>
                {/* 匹配项展开：显示标签和片段预览 */}
                {(expandedId === p.id) && (
                  <div className="mt-1">
                    {p.tags && p.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {p.tags.slice(0,6).map((t:string) => (
                          <span key={t} className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/60 text-[11px] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">{t}</span>
                        ))}
                        {p.tags.length > 6 && (
                          <span className="text-[11px] text-slate-500">+{p.tags.length - 6}</span>
                        )}
                      </div>
                    )}
                    <div className="mt-1 rounded bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 px-2 py-1 text-[12px] leading-5 whitespace-normal break-words line-clamp-3">
                      {renderHighlighted(p.content || '', computeVariableValues(p))}
                    </div>
                  </div>
                )}
              </li>
            ));
          })()}
          {(filtered.length === 0 && (queryText || '').trim() !== '/' ) && (
            <li className="px-3 py-2 text-[12px] text-gray-600 dark:text-gray-300">没有匹配的提示词 · 试试 <span className="font-medium">tag:写作</span></li>
          )}
        </ul>
      </ScrollArea>
      {/* 底部控制区：左 / 徽标；中间居中的轮播提示；右设置 */}
      <div className="px-3 py-1.5 border-t border-slate-200 dark:border-slate-700 flex items-center text-[11px] text-slate-600 dark:text-slate-400 select-none gap-2">
        <span className="px-1.5 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-700 text-[11px]">/</span>
        <div className="flex-1 flex items-center justify-center">
          <div key={hintIndex} className="flex items-center gap-2 transition-all duration-300 ease-out translate-y-0 opacity-100">
            <span className="px-1.5 py-0.5 rounded border border-slate-300/70 bg-slate-50 dark:bg-slate-800 dark:border-slate-600 font-mono">{hintList[hintIndex][0]}</span>
            <span>{hintList[hintIndex][1]}</span>
          </div>
        </div>
        <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500" onMouseDown={(e)=>{ e.preventDefault(); window.location.assign('/prompts'); }} title="管理提示词">
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  // Portal 到 body，避免被上层 overflow 裁剪/遮挡
  if (typeof window !== 'undefined') {
    return createPortal(panel, document.body);
  }
  return panel;
}

