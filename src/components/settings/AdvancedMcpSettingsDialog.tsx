import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maxDepth: number;
  onSave: (val: number) => Promise<void>;
}

export default function AdvancedMcpSettingsDialog({ open, onOpenChange, maxDepth, onSave }: Props) {
  const [val, setVal] = useState(maxDepth);
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>高级设置</DialogTitle>
          <DialogDescription>配置 MCP 全局参数。</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <label className="flex flex-col gap-2 text-sm">
            最大递归深度：{val}
            <Slider min={3} max={20} step={1} value={[val]} onValueChange={([v]) => setVal(v)} />
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} size="sm">取消</Button>
          <Button size="sm" className="bg-blue-500 hover:bg-blue-600 text-white" disabled={saving} onClick={async () => { setSaving(true); await onSave(val); setSaving(false); onOpenChange(false); }}>保存</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
