"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, Database } from 'lucide-react';
import { KnowledgeService, KnowledgeBase } from '@/lib/knowledgeService';
import { cn } from "@/lib/utils";

interface KnowledgeBaseSelectorProps {
  onSelect: (knowledgeBase: KnowledgeBase) => void;
  selectedKnowledgeBase: KnowledgeBase | null;
}

export function KnowledgeBaseSelector({ onSelect, selectedKnowledgeBase }: KnowledgeBaseSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadKnowledgeBases = async () => {
    setLoading(true);
    try {
      const kbs = await KnowledgeService.getAllKnowledgeBases();
      setKnowledgeBases(kbs);
    } catch (error) {
      console.error('加载知识库列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadKnowledgeBases();
    }
  }, [isOpen]);

  const filteredKnowledgeBases = knowledgeBases.filter(kb =>
    searchQuery
      ? kb.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (kb.description && kb.description.toLowerCase().includes(searchQuery.toLowerCase()))
      : true
  );
  
  const handleSelect = (kb: KnowledgeBase) => {
    onSelect(kb);
    setIsOpen(false);
    setSearchQuery('');
  };

  const getKnowledgeBaseIcon = (iconName?: string) => {
    // 未来可以扩展，暂时统一使用Database
    return <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setIsOpen(true)}
        className={cn(
          "rounded-lg text-gray-600 hover:bg-gray-100/80 dark:text-gray-400 dark:hover:bg-gray-800/60 shrink-0 transition-all duration-200",
          selectedKnowledgeBase && "text-blue-600 bg-gradient-to-br from-blue-50 to-indigo-50/80 dark:from-blue-900/30 dark:to-indigo-900/25 ring-1 ring-blue-400/30 dark:ring-blue-500/30 shadow-sm"
        )}
        title={selectedKnowledgeBase ? '更换知识库' : '选择知识库'}
      >
        <Database className="w-4 h-4" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-lg font-semibold">选择一个知识库</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              AI将基于您选择的知识库内容进行回答，以提供更精准、个性化的信息。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <Input
                placeholder="搜索知识库名称或描述..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="max-h-80 overflow-y-auto custom-scrollbar">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : filteredKnowledgeBases.length > 0 ? (
                <ul className="space-y-2">
                  {filteredKnowledgeBases.map((kb) => (
                    <li key={kb.id}>
                      <button
                        onClick={() => handleSelect(kb)}
                        className="w-full text-left p-3 rounded-xl border border-gray-200/60 dark:border-gray-700/50 hover:border-blue-300/60 dark:hover:border-blue-600/50 bg-white/60 dark:bg-gray-800/40 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50/80 dark:hover:from-blue-900/20 dark:hover:to-indigo-900/15 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 cursor-pointer group hover:shadow-md backdrop-blur-sm"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/25 flex items-center justify-center group-hover:from-blue-100 group-hover:to-indigo-100 dark:group-hover:from-blue-800/40 dark:group-hover:to-indigo-800/35 transition-all duration-200 shadow-sm">
                            {getKnowledgeBaseIcon(kb.icon)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors duration-200">{kb.name}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                              {(kb.description || '暂无描述')
                                .replace(/\\n|\n|\r|\\r|\t|\\t/g, ' ')
                                .replace(/\s{2,}/g, ' ')
                              }
                            </p>
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Database className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                  <p className="text-sm">没有找到匹配的知识库</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
} 