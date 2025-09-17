"use client";
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { validateProviderName } from '@/lib/utils/pinyin';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerName: string; // stable key
  initialDisplayName: string;
};

export function ProviderRenameDialog({ open, onOpenChange, providerName, initialDisplayName }: Props) {
  const [value, setValue] = useState<string>(initialDisplayName);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (open) setValue(initialDisplayName);
  }, [open, initialDisplayName]);

  const handleSave = async () => {
    const next = (value || '').trim();
    const v = validateProviderName(next);
    if (!v.isValid) {
      toast.error(v.error || '名称无效', { description: v.suggestion });
      return;
    }
    setSaving(true);
    try {
      const { providerRepository } = await import('@/lib/provider/ProviderRepository');
      await providerRepository.update({ name: providerName, displayName: next } as any);
      // 立即刷新内存 store 的列表展示（无需切页面）
      try {
        const { useProviderStore } = await import('@/store/providerStore');
        const state = useProviderStore.getState();
        const current = state.providers;
        const updated = current.map(p => p.name === providerName ? { ...p, displayName: next } : p);
        if (state) {
          useProviderStore.setState({ providers: updated } as any);
        }
        // 同步 UI 元数据列表以立即反映 displayName
        const { useProviderMetaStore } = await import('@/store/providerMetaStore');
        const { mapToProviderWithStatus } = await import('@/lib/provider/transform');
        useProviderMetaStore.getState().setList(updated.map((v:any)=>mapToProviderWithStatus(v)) as any);
      } catch (err) {
        console.warn('rename immediate refresh failed, will rely on repository subscription', err);
      }
      toast.success('已更新名称');
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error('保存失败', { description: e?.message || String(e) });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>重命名提供商</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">显示名称（最长20个字符，不含特殊符号）</label>
            <Input
              value={value}
              maxLength={20}
              onChange={(e)=> setValue(e.target.value)}
              placeholder="新的显示名称"
            />
            <div className="mt-1 text-[10px] text-gray-400">名称仅用于展示，唯一标识仍为 {providerName}</div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="dialogSecondary" onClick={()=>onOpenChange(false)} disabled={saving}>取消</Button>
            <Button variant="dialogPrimary" onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


