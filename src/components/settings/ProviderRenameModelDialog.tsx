"use client";
import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ProviderRenameModelDialog({ providerName, modelName, currentLabel }: { providerName: string; modelName: string; currentLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentLabel || '');
  useEffect(()=>{ if(open) setValue(currentLabel || ''); }, [open, currentLabel]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e:any)=>e?.preventDefault?.()}>重命名</DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>重命名模型</DialogTitle>
        </DialogHeader>
        <div>
          <label className="block text-xs text-gray-500 mb-1">新名称</label>
          <input className="w-full h-9 px-3 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm" value={value} onChange={e=>setValue(e.target.value)} placeholder="输入新的显示名" />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={()=>setOpen(false)}>取消</Button>
          <Button onClick={async()=>{
            const nextLabel = (value || '').trim();
            if (!nextLabel) { toast.error('名称不可为空'); return; }
            try {
              const { modelRepository } = await import('@/lib/provider/ModelRepository');
              const { specializedStorage } = await import('@/lib/storage');
              const list = (await modelRepository.get(providerName)) || [];
              const updated = list.map((m: any) => (m.name === modelName ? { ...m, label: nextLabel } : m));
              await modelRepository.save(providerName, updated);
              await specializedStorage.models.setModelLabel(providerName, modelName, nextLabel);
              toast.success('已重命名', { description: nextLabel });
              setOpen(false);
            } catch (err) { console.error(err); toast.error('重命名失败'); }
          }}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

