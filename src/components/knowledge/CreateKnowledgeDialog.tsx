import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { toast } from 'sonner';

interface CreateKnowledgeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string, description: string) => Promise<void>;
}

export function CreateKnowledgeDialog({ open, onOpenChange, onCreate }: CreateKnowledgeDialogProps) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);

  const validName = (str: string) => /^[\u4e00-\u9fa5A-Za-z0-9 _-]+$/.test(str);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('名称不能为空');
      return;
    }
    if (!validName(name.trim())) {
      toast.error('名称包含非法字符');
      return;
    }
    try {
      setLoading(true);
      await onCreate(name.trim(), desc.trim());
      setName('');
      setDesc('');
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-gray-100">新建知识库</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            className="dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="知识库名称 (必填)"
          />
          <Textarea
            className="dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="知识库描述 (可选)"
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="dialogSecondary" onClick={() => onOpenChange(false)} disabled={loading}>取消</Button>
          <Button variant="dialogPrimary" onClick={handleSubmit} disabled={loading}>创建</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 