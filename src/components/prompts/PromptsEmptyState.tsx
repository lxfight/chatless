'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Bookmark, Search } from 'lucide-react';
import { PromptEditorDialog } from './PromptEditorDialog';
import { usePromptStore } from '@/store/promptStore';
import { PromptImportExport } from './PromptImportExport';

export function PromptsEmptyState() {
  const [open, setOpen] = useState(false);
  const createPrompt = usePromptStore((s) => s.createPrompt);
  const ui = usePromptStore((s) => s.ui);

  return (
    <div className="w-full flex items-center justify-center">
      <div className="text-center max-w-md w-full bg-white/70 dark:bg-gray-900/40 backdrop-blur-sm rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-8 shadow-sm">
        <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white flex items-center justify-center shadow-md">
          {ui?.searchQuery ? <Search className="w-6 h-6" /> : <Bookmark className="w-6 h-6" />}
        </div>
        <div className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-1">
          {ui?.searchQuery ? '未找到匹配的提示词' : '还没有提示词'}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          {ui?.searchQuery ? '尝试调整关键词或筛选条件' : '创建或导入提示词，快速在聊天中复用'}
        </div>
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" className="h-8" onClick={() => setOpen(true)}>新建提示词</Button>
          <PromptImportExport />
        </div>
      </div>

      {open && (
        <PromptEditorDialog
          open={open}
          onOpenChange={setOpen}
          onSubmit={async (data) => { await createPrompt(data as any); setOpen(false); }}
        />
      )}
    </div>
  );
}

