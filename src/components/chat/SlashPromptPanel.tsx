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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SlashPromptPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (promptId: string, opts?: { action?: 'apply' | 'send'; mode?: 'permanent' | 'oneOff' }) => void;
  anchorRef?: React.RefObject<HTMLElement>;
  // 来自主输入框的文本，用于统一过滤，避免重复输入
  queryText?: string;
}

export function SlashPromptPanel({ open, onOpenChange, onSelect, anchorRef, queryText }: SlashPromptPanelProps) {
  const prompts = usePromptStore((s) => s.prompts);
  const loadFromDatabase = usePromptStore((s)=> (s as any).loadFromDatabase);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [anchorRect, setAnchorRect] = useState<{left:number; width:number; top:number} | null>(null);
  const [pendingVars, setPendingVars] = useState<Record<string, any>>({});
  const router = useRouter();
  const [ctrlPreview, setCtrlPreview] = useState(false);

  useEffect(() => {
    if (open) {
      setActiveIndex(0);
      // 若还未加载提示词，尝试从数据库拉取
      try { if (prompts.length === 0 && typeof loadFromDatabase === 'function') { loadFromDatabase(); } } catch {}
      // 计算锚点位置
      const calc = () => {
        try {
          const el = anchorRef?.current as HTMLElement | null;
          if (!el) return;
          const rect = el.getBoundingClientRect();
          setAnchorRect({ left: rect.left, width: rect.width, top: rect.top });
        } catch {}
      };
      calc();
      window.addEventListener('scroll', calc, true);
      window.addEventListener('resize', calc);
      const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Control') setCtrlPreview(true); };
      const onKeyUp = (e: KeyboardEvent) => { if (e.key === 'Control') setCtrlPreview(false); };
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
    // 同步读取改为 StorageUtil：此处在 useMemo 内，统一保持同步读取为兜底
    try { pref = (window as any).__prompt_pref_cache__ || {}; } catch {}
    // 内联变量赋值解析，格式 k=v k2="x y"，仅在以 / 指令开头时生效
    let token = '';
    const inlineVars: Record<string,string> = {};
    if (text.startsWith('/')) {
      const parts = text.split(/\s+/);
      token = parts[0].replace(/^\//,'');
      const rest = text.slice(parts[0].length).trim();
      // 支持中文键名：用 [^\s=]+ 代替 \w
      const varRe = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s]+))/gu;
      let m: RegExpExecArray | null;
      while ((m = varRe.exec(rest))) {
        const key = m[1];
        const val = (m[3] ?? m[4] ?? m[5] ?? '').toString();
        inlineVars[key] = val;
      }
      if (Object.keys(inlineVars).length === 0 && rest) {
        // 位置参数模式：支持英文竖线 | 与全角竖线 ｜
        const hasDelim = /[|｜]/.test(rest);
        const positional = hasDelim
          ? rest.split(/[|｜]/g).map(s => s.trim()).filter(Boolean)
          : [rest];
        setPendingVars({ __positional: positional });
      } else {
        setPendingVars(inlineVars);
      }
    } else {
      token = text || '';
      setPendingVars({});
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
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, filtered.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
      if (e.key === 'Enter') {
        e.preventDefault();
        const id = (filtered[activeIndex] as any)?.p?.id || (filtered[activeIndex] as any)?.id;
        if (id) {
          try { const ev = new CustomEvent('prompt-inline-vars', { detail: pendingVars }); window.dispatchEvent(ev); } catch {}
          // 新规则：回车直接发送；Alt+回车应用为系统（Shift+Alt 为一次性）
          const useApply = (e as any).altKey || (e as any).metaKey; // 允许 ⌘ 兼容
          if (useApply) {
            const oneOff = (e as any).shiftKey;
            onSelect(id, { action: 'apply', mode: oneOff ? 'oneOff' : 'permanent' });
          } else {
            onSelect(id, { action: 'send' });
          }
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, filtered, activeIndex, onSelect, onOpenChange, pendingVars]);

  if (!open) return null;

  const fixedStyle = anchorRect ? {
    position: 'fixed' as const,
    left: `${anchorRect.left}px`,
    width: `${anchorRect.width}px`,
    bottom: `${window.innerHeight - anchorRect.top + 36}px`,
    zIndex: 2147483000,
  } : undefined;

  const panel = (
    <div ref={containerRef} className="bg-white dark:bg-gray-900/95 shadow-md border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden" style={fixedStyle}>
      {/* 顶部提示：一行操作提示 + 一行位置参数提示（按需显示） */}
      <div className="px-3 pt-2 pb-1.5 relative">
        <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
          输入关键词、/指令 或 tag:分类；回车直接发送 · Alt+回车应用为系统（Shift+Alt 为一次性）；闪电为直接发送；位置参数可用 | 或 ｜ 分隔
        </div>
        {filtered.length === 0 && (
          <Button aria-label="添加提示词" variant="ghost" size="icon" className="absolute top-1.5 right-1.5 h-7 w-7 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" onMouseDown={(e)=>{ e.preventDefault(); onOpenChange(false); router.push('/prompts'); }}>
            <Plus className="w-4 h-4" />
          </Button>
        )}
        {/* 去掉位置参数提示，简洁显示 */}
      </div>
      {/* 按需预览已移除，避免与条目内的内容预览重复 */}
      <ScrollArea className="max-h-60">
        <ul className="py-1">
          {filtered.map((item, idx) => (
            <li key={item.p.id} className={cn('px-3 py-2 cursor-pointer text-sm flex items-center justify-between', idx === activeIndex ? 'bg-indigo-50/70 dark:bg-indigo-900/40' : 'hover:bg-gray-50 dark:hover:bg-gray-800/60')} onMouseEnter={() => setActiveIndex(idx)} onClick={(e) => {
              // 记忆本次选择的指令 -> 提示词映射
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
              // 选择时把解析到的变量透传给父层（ChatInput 会存入 conversation.system_prompt_applied）
              // 这里通过自定义事件发送，避免改动过多 props
              try { const ev = new CustomEvent('prompt-inline-vars', { detail: pendingVars }); window.dispatchEvent(ev); } catch {}
              onSelect(item.p.id, { action: 'apply', mode: (e as any).altKey ? 'oneOff' : 'permanent' });
            }}>
              <div className="min-w-0">
                <div className="font-medium text-gray-800 dark:text-gray-100 truncate flex items-center gap-2">
                  <span className="truncate">{item.p.name}</span>
                </div>
                {item.p.tags && item.p.tags.length > 0 && (
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{item.p.tags.join(' · ')}</div>
                )}
                {/* 内容占位预览：在模板中将 {{var}} 以灰色chip展示，若输入有值则显示值 */}
                <div className="mt-1 rounded bg-gray-50/70 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 px-2 py-1 text-[12px] leading-5 whitespace-pre-wrap">
                  {renderHighlighted(item.p.content, computeVariableValues(item.p))}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                {item.p.stats?.uses ? <span className="text-[11px] text-gray-400">{item.p.stats.uses} 次</span> : null}
                {item.note && <span className="text-[11px] text-indigo-600">{item.note}</span>}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700"
                  onMouseDown={(ev)=>{ ev.preventDefault(); try { const ce = new CustomEvent('prompt-inline-vars', { detail: pendingVars }); window.dispatchEvent(ce); } catch {} ; onSelect(item.p.id, { action: 'send' }); }}
                  title="直接发送一次"
                >
                  <Zap className="w-3.5 h-3.5" />
                </Button>
              </div>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-[12px] text-gray-600 dark:text-gray-300">
              没有匹配的提示词 · 试试 <span className="font-medium">tag:写作</span>
            </li>
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

