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
    const re = /\{\{\s*([a-zA-Z0-9_\-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^}]+)))?\s*\}\}/g;
    const map = new Map<string, PromptVariableDefinition>();
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const key = m[1];
      const d1 = m[2]; const d2 = m[3]; const d3 = m[4];
      const def = (d1 ?? d2 ?? (d3 ? String(d3).trim() : '')) as string;
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
    const re = /\{\{\s*([a-zA-Z0-9_\-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^}]+)))?\s*\}\}/g;
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
      out += `<span class=\"rounded-sm bg-yellow-100/60 text-yellow-900 shadow-[inset_0_0_0_1px_rgba(234,179,8,0.45)]\">${raw}</span>`;
      last = m.index + m[0].length;
    }
    out += esc(src.slice(last));
    // 保持换行与空格
    return out.replace(/\n/g, '<br/>').replace(/\s{2}/g, ' &nbsp;');
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
    <span className="relative group inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs border border-green-200 bg-green-50 text-green-700 dark:bg-green-900/20 dark:border-green-700 dark:text-green-200">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="absolute -top-1 -right-1 hidden group-hover:flex h-4 w-4 items-center justify-center rounded-full bg-gray-400/70 text-white text-[10px] leading-none hover:bg-gray-500"
        title="移除"
      >
        ×
      </button>
    </span>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[80vh] p-0 flex flex-col">
        <DialogHeader>
          <DialogTitle>{(initial as any)?.id ? '编辑提示词' : '新建提示词'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-auto px-6 pb-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="prompt-name">名称</Label>
              <Input id="prompt-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：技术文档总结助手" />
            </div>
            <div>
              <Label>Token 估算</Label>
              <div className="h-10 flex items-center text-sm text-gray-600 dark:text-gray-300">≈ {tokenEstimate} tokens</div>
            </div>
          </div>

          <div>
            <Label htmlFor="prompt-desc">描述</Label>
            <Input id="prompt-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="简要说明用途" />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="prompt-content">内容</Label>
              <div className="text-xs text-gray-500">在文本中直接使用 {'{{变量}}'}，无需单独新增变量</div>
            </div>
            <div className="relative rounded-md border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/40 min-h-[220px] max-h-[50vh]">
              <div
                ref={previewRef}
                className="absolute inset-0 overflow-auto p-3 text-sm leading-6 whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: highlighted || '<span class=\'text-gray-400\'>直接描述角色、目标、输出格式与边界，可用 {{变量}}</span>' }}
              />
              <textarea
                ref={contentRef as any}
                id="prompt-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onScroll={syncScroll}
                className="absolute inset-0 w-full h-full resize-none bg-transparent outline-none ring-0 focus:ring-0 p-3 text-sm leading-6 text-transparent caret-indigo-600 dark:caret-slate-100 font-sans"
                placeholder=""
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>标签（回车添加）</Label>
              <Input onKeyDown={handleTagsInput} placeholder="写作、翻译… 回车添加" />
              <div className="mt-2 flex flex-wrap gap-2">
                {['写作','编程','翻译','总结'].map(t => (
                  <button key={t} className="text-xs px-2 py-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50" onClick={()=>setTags(prev=>Array.from(new Set([...prev, t])))}>{t}</button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {tags.map((t) => (
                  <Chip key={t} label={t} onRemove={() => removeTag(t)} />
                ))}
              </div>
            </div>
            <div>
              <Label>语言（回车添加）</Label>
              <Input onKeyDown={handleLanguagesInput} placeholder="zh-CN、en… 回车添加" />
              <div className="mt-2 flex flex-wrap gap-2">
                {languages.map((t) => (
                  <Chip key={t} label={t} onRemove={() => removeLang(t)} />
                ))}
              </div>
            </div>
            <div>
              <Label>模型提示（回车添加）</Label>
              <Input onKeyDown={handleModelsInput} placeholder="gpt-4o、claude-3-5… 回车添加" />
              <div className="mt-2 flex flex-wrap gap-2">
                {modelHints.map((t) => (
                  <Chip key={t} label={t} onRemove={() => removeModel(t)} />
                ))}
              </div>
            </div>
          </div>

          <div>
            <Label>快捷指令（回车添加）</Label>
            <Input onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>)=>{ const target=e.currentTarget; if(e.key==='Enter'&&target.value.trim()){ const val=target.value.trim().replace(/^\//,'').toLowerCase(); setShortcuts((prev: string[])=>Array.from(new Set([...prev,val]))); target.value=''; } }} placeholder="如 /write、/review，不加斜杠也可" />
            <div className="mt-2 flex flex-wrap gap-2">
              {shortcuts.map((s: string) => (
                <Chip key={s} label={`/${s}`} onRemove={() => removeShortcut(s)} />
              ))}
            </div>
            <div className="mt-2 text-xs text-gray-500">系统建议：</div>
            <div className="mt-1 flex flex-wrap gap-2">
              {generateShortcutCandidates(name, tags, languages).filter(s=>!shortcuts.includes(s)).map(s => (
                <button key={s} className="px-2 py-0.5 rounded-full bg-indigo-50/80 text-indigo-600 border border-indigo-200 shadow-sm hover:bg-indigo-100" onClick={()=>setShortcuts((prev:string[])=>Array.from(new Set([...prev,s])))}>/{s}</button>
              ))}
            </div>
          </div>

            {/* 去掉额外“添加变量”UI，变量从内容中自动识别 */}
        </div>

        <DialogFooter className="mt-4 px-6 pb-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || !content.trim()}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

