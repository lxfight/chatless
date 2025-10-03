"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import type { PromptItem, PromptVariableDefinition } from '@/types/prompt';
import { generateShortcutCandidates } from '@/lib/prompt/shortcut';

interface PromptEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<PromptItem> | null;
  onSubmit: (data: Omit<PromptItem, 'id' | 'createdAt' | 'updatedAt' | 'stats'> & { id?: string }) => void;
}

export function PromptEditorDialog({ open, onOpenChange, initial, onSubmit }: PromptEditorDialogProps) {
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [content, setContent] = useState(initial?.content || '');
  const contentRef = useRef<HTMLTextAreaElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [tags, setTags] = useState<string[]>(initial?.tags || []);
  const [languages, setLanguages] = useState<string[]>(initial?.languages || []);
  const [modelHints, setModelHints] = useState<string[]>(initial?.modelHints || []);
  const [favorite, setFavorite] = useState<boolean>(!!initial?.favorite);
  const [shortcuts, setShortcuts] = useState<string[]>(initial?.shortcuts || []);

  useEffect(() => {
    if (open) {
      setName(initial?.name || '');
      setDescription(initial?.description || '');
      setContent(initial?.content || '');
      setTags(initial?.tags || []);
      setLanguages(initial?.languages || []);
      setModelHints(initial?.modelHints || []);
      setFavorite(!!initial?.favorite);
      setShortcuts(initial?.shortcuts || []);
    }
  }, [open, initial]);

  const tokenEstimate = useMemo(() => {
    const plain = content || '';
    if (!plain) return 0;
    // 粗略估算：中文每字≈1 token，英文每4字符≈1 token
    const chineseChars = plain.replace(/[\x00-\x7F]/g, '').length;
    const englishChars = plain.length - chineseChars;
    return Math.round(chineseChars + englishChars / 4);
  }, [content]);

  const deriveVariables = (text: string): PromptVariableDefinition[] => {
    // 支持中文、字母、数字与常见符号（不包含空白、花括号、等号）
    const re = /\{\{\s*([^\s{}=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^}]+)))?\s*\}\}/gu;
    const map = new Map<string, PromptVariableDefinition>();
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const key = m[1];
      const d1 = m[2]; const d2 = m[3]; const d3 = m[4];
      const def = (d1 ?? d2 ?? (d3 ? String(d3).trim() : ''));
      if (key && !map.has(key)) {
        map.set(key, { key, type: 'string', defaultValue: def });
      }
    }
    return Array.from(map.values());
  };

  const handleSubmit = () => {
    if (!name.trim() || !content.trim()) return;
    const autoVariables = deriveVariables(content);
    onSubmit({
      id: (initial as any)?.id,
      name: name.trim(),
      description: description.trim(),
      content: content,
      tags,
      languages,
      modelHints,
      variables: autoVariables,
      favorite,
      shortcuts,
    });
    onOpenChange(false);
  };

  const handleTagsInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    if (e.key === 'Enter' && target.value.trim()) {
      setTags((prev) => Array.from(new Set([...prev, target.value.trim()])));
      target.value = '';
    }
  };

  const handleLanguagesInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    if (e.key === 'Enter' && target.value.trim()) {
      setLanguages((prev) => Array.from(new Set([...prev, target.value.trim()])));
      target.value = '';
    }
  };

  const handleModelsInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    if (e.key === 'Enter' && target.value.trim()) {
      setModelHints((prev) => Array.from(new Set([...prev, target.value.trim()])));
      target.value = '';
    }
  };

  // 高亮渲染：把 {{var}} 包裹成带背景的片段，保持字符等宽与原文本一致，不插入额外字符
  const highlighted = useMemo(() => {
    const re = /\{\{\s*([^\s{}=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^}]+)))?\s*\}\}/gu;
    const esc = (s: string) => s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    let last = 0; let out = '';
    const src = content || '';
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      out += esc(src.slice(last, m.index));
      const raw = esc(m[0]);
      out += `<span class=\"rounded-sm bg-yellow-100/60 text-yellow-900 shadow-[inset_0_0_0_1px_rgba(234,179,8,0.45)] dark:bg-yellow-400/20 dark:text-yellow-200 dark:shadow-[inset_0_0_0_1px_rgba(234,179,8,0.35)]\">${raw}</span>`;
      last = m.index + m[0].length;
    }
    out += esc(src.slice(last));
    // 保持换行（空格由 whitespace-pre-wrap 处理）
    return out.replace(/\n/g, '<br/>');
  }, [content]);

  // 同步滚动
  const syncScroll = () => {
    if (!contentRef.current || !previewRef.current) return;
    previewRef.current.scrollTop = contentRef.current.scrollTop;
  };

  const removeTag = (t: string) => setTags(prev => prev.filter(x => x !== t));
  const removeLang = (t: string) => setLanguages(prev => prev.filter(x => x !== t));
  const removeModel = (t: string) => setModelHints(prev => prev.filter(x => x !== t));
  const removeShortcut = (s: string) => setShortcuts(prev => prev.filter(x => x !== s));

  const Chip = ({ label, onRemove }: { label: string; onRemove: () => void }) => (
    <span className="relative group inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs border border-emerald-200/70 bg-emerald-50/70 text-emerald-700 dark:bg-emerald-500/15 dark:border-emerald-600/40 dark:text-emerald-200 hover:bg-emerald-100/70 dark:hover:bg-emerald-500/25 transition-colors">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="absolute -top-1.5 -right-1.5 hidden group-hover:flex h-4 w-4 items-center justify-center rounded-full bg-slate-400/80 text-white text-[10px] leading-none hover:bg-slate-500 shadow-sm"
        title="移除"
      >
        ×
      </button>
    </span>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[80vh] p-0 flex flex-col rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-xl">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-slate-100/80 dark:border-slate-800/60 bg-gradient-to-b from-slate-50/50 to-transparent dark:from-slate-900/30">
          <DialogTitle className="text-lg font-semibold">{(initial as any)?.id ? '编辑提示词' : '新建提示词'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 overflow-auto px-6 pb-4 pt-1">
          <div className="grid grid-cols-2 gap-6 items-end">
            <div>
              <Label htmlFor="prompt-name" className="text-sm font-medium mb-1.5">名称</Label>
              <Input id="prompt-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：技术文档总结助手" className="h-10 rounded-lg border-slate-200 dark:border-slate-700 focus:border-blue-400 dark:focus:border-blue-500 transition-colors" />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5">Token 估算</Label>
              <div className="h-10 flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
                <span className="inline-flex items-center rounded-full bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-800/70 text-slate-700 dark:text-slate-300 px-4 py-1.5 border border-slate-200/60 dark:border-slate-700/60 shadow-sm">≈ {tokenEstimate} tokens</span>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label htmlFor="prompt-desc" className="text-sm font-medium">描述</Label>
              <span className="text-xs text-slate-400">可选</span>
            </div>
            <Input id="prompt-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="简要说明用途（可选）" className="h-10 rounded-lg border-slate-200 dark:border-slate-700 focus:border-blue-400 dark:focus:border-blue-500 transition-colors" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="prompt-content" className="text-sm font-medium">内容</Label>
              <div className="text-xs text-slate-500 bg-slate-100/60 dark:bg-slate-800/60 px-2 py-1 rounded">在文本中直接使用 {'{{变量}}'}，无需单独新增变量</div>
            </div>
            <div className="relative rounded-xl ring-1 ring-slate-200/70 dark:ring-slate-700/70 bg-white/80 dark:bg-slate-900/40 min-h-[280px] max-h-[50vh] shadow-sm hover:ring-slate-300/70 dark:hover:ring-slate-600/70 transition-all">
              <div
                ref={previewRef}
                className="absolute inset-0 overflow-auto p-4 text-sm leading-6 whitespace-pre-wrap pointer-events-none select-none text-slate-900 dark:text-slate-100 font-mono"
                dangerouslySetInnerHTML={{ __html: highlighted || '<span class=\'text-slate-400\'>直接描述角色、目标、输出格式与边界，可用 {{变量}}</span>' }}
              />
              <textarea
                ref={contentRef as any}
                id="prompt-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onScroll={syncScroll}
                className="absolute inset-0 w-full h-full resize-none bg-transparent outline-none ring-0 focus:ring-0 p-4 text-sm leading-6 text-transparent selection:bg-blue-500/20 dark:selection:bg-blue-400/25 caret-blue-600 dark:caret-blue-400 font-mono"
                placeholder=""
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium">标签（回车添加）</Label>
              <Input onKeyDown={handleTagsInput} placeholder="写作、翻译… 回车添加" className="h-9 rounded-lg border-slate-200 dark:border-slate-700" />
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <Chip key={t} label={t} onRemove={() => removeTag(t)} />
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {['写作','编程','翻译','总结'].map(t => (
                  <button
                    key={t}
                    className="text-xs px-2 py-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                    onClick={()=>setTags(prev=>Array.from(new Set([...prev, t])))}
                  >{t}</button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">语言（回车添加）</Label>
              <Input onKeyDown={handleLanguagesInput} placeholder="zh-CN、en… 回车添加" className="h-9 rounded-lg border-slate-200 dark:border-slate-700" />
              <div className="flex flex-wrap gap-2">
                {languages.map((t) => (
                  <Chip key={t} label={t} onRemove={() => removeLang(t)} />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">模型提示（回车添加）</Label>
              <Input onKeyDown={handleModelsInput} placeholder="gpt-4o、claude-3-5… 回车添加" className="h-9 rounded-lg border-slate-200 dark:border-slate-700" />
              <div className="flex flex-wrap gap-2">
                {modelHints.map((t) => (
                  <Chip key={t} label={t} onRemove={() => removeModel(t)} />
                ))}
              </div>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">快捷指令（回车添加）</Label>
            <Input onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>)=>{ const target=e.currentTarget; if(e.key==='Enter'&&target.value.trim()){ const val=target.value.trim().replace(/^\//,'').toLowerCase(); setShortcuts((prev: string[])=>Array.from(new Set([...prev,val]))); target.value=''; } }} placeholder="如 /write、/review，不加斜杠也可" className="h-9 rounded-lg border-slate-200 dark:border-slate-700 mt-1.5" />
            <div className="mt-2 flex flex-wrap gap-2">
              {shortcuts.map((s: string) => (
                <Chip key={s} label={`/${s}`} onRemove={() => removeShortcut(s)} />
              ))}
            </div>
            {generateShortcutCandidates(name, tags, languages).filter(s=>!shortcuts.includes(s)).length > 0 && (
              <>
                <div className="mt-2 text-xs text-gray-500">系统建议：</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {generateShortcutCandidates(name, tags, languages).filter(s=>!shortcuts.includes(s)).map(s => (
                    <button key={s} className="px-2 py-0.5 rounded-full bg-indigo-50/80 text-indigo-600 border border-indigo-200 shadow-sm hover:bg-indigo-100" onClick={()=>setShortcuts((prev:string[])=>Array.from(new Set([...prev,s])))}>/{s}</button>
                  ))}
                </div>
              </>
            )}
          </div>

            {/* 去掉额外“添加变量”UI，变量从内容中自动识别 */}
        </div>

        <DialogFooter className="mt-2 px-6 py-4 border-t border-slate-100/80 dark:border-slate-800/60 bg-gradient-to-t from-slate-50/30 to-transparent dark:from-slate-900/20">
          <Button variant="dialogSecondary" onClick={() => onOpenChange(false)} className="rounded-lg">取消</Button>
          <Button variant="soft" onClick={handleSubmit} disabled={!name.trim() || !content.trim()} className="rounded-lg shadow-sm">保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

