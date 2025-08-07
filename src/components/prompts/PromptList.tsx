'use client';

import { useState } from 'react';
import { PromptCard, Prompt } from "./PromptCard";

interface PromptListProps {
  prompts: Prompt[];
  // Add handlers from PromptCard if needed at this level
}

export function PromptList({ prompts }: PromptListProps) {
  const [selectedPrompts, setSelectedPrompts] = useState<Set<string>>(new Set());
  // Add state for favorites if needed

  const handleSelectChange = (id: string, selected: boolean) => {
    setSelectedPrompts(prev => {
      const newSet = new Set(prev);
      if (selected) newSet.add(id);
      else newSet.delete(id);
      return newSet;
    });
    // TODO: Update global selection state if toolbar needs it
  };

  // Placeholder handlers - implement actual logic
  const handleToggleFavorite = (id: string) => console.log("Toggle Favorite:", id);
  const handleEdit = (id: string) => console.log("Edit:", id);
  const handleCopy = (id: string) => console.log("Copy:", id);
  const handleMove = (id: string) => console.log("Move:", id);
  const handleDelete = (id: string) => console.log("Delete:", id);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {prompts.map((prompt) => (
        <PromptCard 
          key={prompt.id} 
          {...prompt} 
          isSelected={selectedPrompts.has(prompt.id)}
          onSelectChange={handleSelectChange}
          onToggleFavorite={handleToggleFavorite}
          onEdit={handleEdit}
          onCopy={handleCopy}
          onMove={handleMove}
          onDelete={handleDelete}
        />
      ))}
    </div>
  );
} 