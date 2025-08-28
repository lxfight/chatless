"use client";

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { usePromptStore } from '@/store/promptStore';

export function PromptImportExport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const importPrompts = usePromptStore((s) => s.importPrompts);
  const exportPrompts = usePromptStore((s) => s.exportPrompts);

  const handleImportClick = () => inputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      let data: any;
      if (file.name.endsWith('.json')) {
        data = JSON.parse(text);
      } else {
        // 简单 CSV 支持：name,content,tags
        const lines = text.split(/\r?\n/).filter(Boolean);
        const headers = lines.shift()!.split(',').map((s) => s.trim());
        data = lines.map((line) => {
          const parts = line.split(',');
          const record: any = {};
          headers.forEach((h, i) => (record[h] = parts[i]));
          if (record.tags) record.tags = String(record.tags).split(';').map((s: string) => s.trim()).filter(Boolean);
          if (record.shortcuts) record.shortcuts = String(record.shortcuts).split(';').map((s: string) => s.trim()).filter(Boolean);
          return record;
        });
      }
      const arr = Array.isArray(data?.prompts) ? data.prompts : Array.isArray(data) ? data : [];
      // 规范化 shortcuts
      arr.forEach((it:any)=>{ if (Array.isArray(it?.shortcuts)) it.shortcuts = Array.from(new Set(it.shortcuts.map((s:any)=>String(s).replace(/^\//,'').toLowerCase()).filter(Boolean))); });
      const result = importPrompts(arr);
      toast.success(`导入完成：新增 ${result.created}，更新 ${result.updated}，跳过 ${result.skipped}`);
    } catch (e: any) {
      toast.error('导入失败', { description: e?.message || '文件解析失败' });
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleExport = () => {
      const data = { version: 1, prompts: exportPrompts() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompts-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex items-center gap-2">
      <input ref={inputRef} type="file" accept=".json,.csv" className="hidden" onChange={handleFileChange} />
      <Button variant="outline" size="sm" className="h-9" onClick={handleImportClick}>导入</Button>
      <Button variant="outline" size="sm" className="h-9" onClick={handleExport}>导出</Button>
    </div>
  );
}

