"use client";
import React, { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ProviderAddModelDialog({ providerName, onAdded }: { providerName: string; onAdded?: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ id: '', label: '' });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const id = (form.id || '').trim();
    const label = (form.label || '').trim();
    if (!id) { toast.error('请输入模型 ID'); return; }
    setSaving(true);
    try {
      const { modelRepository } = await import('@/lib/provider/ModelRepository');
      const list = (await modelRepository.get(providerName)) || [];
      const exists = list.some((m: any)=> m.name.toLowerCase() === id.toLowerCase());
      if (exists) { toast.error('模型已存在'); setSaving(false); return; }
      const next = [...list, { provider: providerName, name: id, label: label || undefined, aliases: [id] } as any];
      await modelRepository.save(providerName, next);
      toast.success('已添加模型', { description: label || id });
      setOpen(false); setForm({ id: '', label: '' }); onAdded?.();
    } catch (e:any) {
      console.error(e); toast.error('添加模型失败', { description: e?.message || String(e) });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="soft" className="h-8 text-xs">添加模型</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>添加模型</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">模型名称（显示名，可选）</label>
            <input className="w-full h-9 px-3 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm" value={form.label} onChange={e=>setForm(s=>({...s, label: e.target.value}))} placeholder="如：Gemini 2.5 Pro" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">模型 ID</label>
            <input className="w-full h-9 px-3 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm" value={form.id} onChange={e=>setForm(s=>({...s, id: e.target.value}))} placeholder="如：gemini-2.5-pro" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={()=>setOpen(false)} disabled={saving}>取消</Button>
          <Button onClick={submit} disabled={saving}>{saving? '保存中…' : '确定添加'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

