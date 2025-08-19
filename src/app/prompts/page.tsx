'use client';

import { PromptsHeader } from "@/components/prompts/PromptsHeader";
import { PromptList } from "@/components/prompts/PromptList";
import { PromptsEmptyState } from "@/components/prompts/PromptsEmptyState";
import { usePromptStore } from "@/store/promptStore";
import { useEffect, useMemo } from "react";
import { filterAndSortPrompts } from "@/lib/prompt/search";

export default function PromptsPage() {
  const prompts = usePromptStore((s) => s.prompts);
  const ui = usePromptStore((s)=>s.ui);
  const loadFromDatabase = usePromptStore((s)=>s.loadFromDatabase);

  useEffect(() => {
    loadFromDatabase().catch(()=>{});
  }, []);
  const mapped = useMemo(() => {
    const filtered = filterAndSortPrompts(prompts, { query: ui?.searchQuery, favoriteOnly: ui?.favoriteOnly, tag: ui?.tagFilter || undefined, sortBy: ui?.sortBy || 'recent' });
    return filtered.map((p) => ({
      id: p.id,
      title: p.name,
      description: p.description || '',
      content: p.content,
      tags: p.tags || [],
      shortcuts: p.shortcuts || [],
      usageCount: p.stats?.uses || 0,
      lastUpdated: new Date(p.updatedAt).toLocaleString(),
      isFavorite: !!p.favorite,
    }));
  }, [prompts, ui]);

  return (
    <div className="h-full w-full flex flex-col">
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <PromptsHeader />
      </div>
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50 dark:bg-gray-950/40">
        <div className="max-w-6xl mx-auto">
          {mapped.length > 0 ? (
            <PromptList prompts={mapped} />
          ) : (
            <PromptsEmptyState />
          )}
        </div>
      </div>
    </div>
  );
} 