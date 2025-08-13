'use client';

import { useMemo, useState } from 'react';
import { PromptCard, Prompt } from "./PromptCard";
import { usePromptStore } from "@/store/promptStore";
import { useChatStore } from "@/store/chatStore";
import { toast } from "sonner";
import { PromptEditorDialog } from "./PromptEditorDialog";

interface PromptListProps {
  prompts: Prompt[];
  // Add handlers from PromptCard if needed at this level
}

export function PromptList({ prompts }: PromptListProps) {
  // 轻量化：移除批量选择
  const toggleFavorite = usePromptStore((s)=>s.toggleFavorite);
  const updatePrompt = usePromptStore((s)=>s.updatePrompt);
  const allPrompts = usePromptStore((s)=>s.prompts);
  const updateConversation = useChatStore((s)=>s.updateConversation);
  const currentConversationId = useChatStore((s)=>s.currentConversationId);

  const handleSelectChange = () => {};

  // Placeholder handlers - implement actual logic
  const handleToggleFavorite = (id: string) => toggleFavorite(id);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingInitial = useMemo(() => allPrompts.find(p=>p.id===editingId) || null, [allPrompts, editingId]);
  const handleEdit = (id: string) => { setEditingId(id); setEditorOpen(true); };
  const handleCopy = (id: string) => console.log("Copy:", id);
  const handleMove = (id: string) => console.log("Move:", id);
  const handleDelete = (id: string) => console.log("Delete:", id);

  const applyToCurrentChat = (id: string) => {
    if (!currentConversationId) { toast.info('请先选择一个对话'); return; }
    updateConversation(currentConversationId, { system_prompt_applied: { promptId: id, mode: 'permanent' } as any });
    toast.success('已应用到当前对话');
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {prompts.map((prompt) => (
          <PromptCard 
            key={prompt.id} 
            {...prompt} 
            onToggleFavorite={handleToggleFavorite}
            onApply={(id)=>{applyToCurrentChat(id);}}
            onEdit={handleEdit}
          />
        ))}
      </div>
      <PromptEditorDialog
        open={editorOpen}
        onOpenChange={(o)=>{ setEditorOpen(o); if(!o) setEditingId(null); }}
        initial={editingInitial}
        onSubmit={(data)=>{
          if (!editingId) return;
          updatePrompt(editingId, {
            name: data.name,
            description: data.description,
            content: data.content,
            tags: data.tags,
            languages: data.languages,
            modelHints: data.modelHints,
            variables: data.variables,
            favorite: data.favorite,
            shortcuts: (data as any).shortcuts,
          } as any);
          toast.success('已保存修改');
        }}
      />
    </>
  );
} 