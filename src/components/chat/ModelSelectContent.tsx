"use client";

import { useRef, useState, useEffect } from 'react';
import { SelectContent } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, Clock, X } from 'lucide-react';
import { ModelList } from './ModelList';
import { RecentModelsList } from './RecentModelsList';
import type { ProviderMetadata, ModelMetadata } from '@/lib/metadata/types';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useRouter } from 'next/navigation';

interface ModelSelectContentProps {
  filteredModels: ProviderMetadata[];
  recentModelDetails: { provider: ProviderMetadata, model: ModelMetadata }[];
  globalDefaultModel: string | null;
  currentModelId: string | null;
  currentSelection?: string | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onSetDefault: (e: React.MouseEvent, providerName: string, modelName: string) => void;
  onOpenChange: (open: boolean) => void; // Pass this down to manage focus
  onRefresh: () => void;
  onOpenParameters?: (providerName: string, modelId: string, modelLabel?: string) => void;
}

export function ModelSelectContent({
  filteredModels,
  recentModelDetails,
  globalDefaultModel,
  currentModelId,
  currentSelection,
  searchQuery,
  setSearchQuery,
  onSetDefault,
  onOpenChange,
  onRefresh,
  onOpenParameters,
}: ModelSelectContentProps) {
  const [activeTab, setActiveTab] = useState('all');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // 当搜索词变化（即用户输入或列表更新）时，确保输入框重新获得焦点，
  // 解决 Radix Select 因自动聚焦选中项导致的偶发失焦问题。
  useEffect(() => {
    searchInputRef.current?.focus();
  }, [searchQuery]);

  function handleToAiSetting () { 
    router.push('/settings?tab=localModels');
  };

  // Focus search input when dropdown opens
  // This logic is now managed by the parent, but we keep the ref
  // The onOpenChange prop handles the focus logic directly in the parent.
  
  const handleFocusCapture = (e: React.FocusEvent) => {
    if (e.target !== searchInputRef.current) {
      searchInputRef.current?.focus();
    }
  };

  return (
    <TooltipProvider delayDuration={150}>
      <SelectContent
        onFocusCapture={handleFocusCapture}
        className="max-h-[560px] w-[500px] p-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg"
      >
      {/* 搜索栏 */}
      <div className="sticky top-0 z-10 p-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="搜索模型或提供商..."
            className="w-full py-1.5 pl-9 pr-9 border border-gray-200 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-800 dark:text-gray-200 transition-colors"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDownCapture={(e) => {
              // 捕获阶段阻止事件冒泡，彻底隔离 Radix Select 的键盘处理
              e.stopPropagation();
            }}
            onKeyUpCapture={(e) => {
              e.stopPropagation();
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-12 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
            {/* 刷新按钮 */}
           
           <button
             onClick={() => handleToAiSetting()}
             title="设置AI模型"
             className="absolute right-9 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
           >
             <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20V10"></path><path d="M12 10L19 17"></path><path d="M12 10L5 17"></path></svg>
           </button>
           
         </div>
       </div>

      {/* 标签页 */}
      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="p-2">
        <TabsList className="w-full grid grid-cols-2 mb-2 bg-gray-200/60 dark:bg-gray-800/60 rounded-lg">
          <TabsTrigger value="all" className="text-sm data-[state=active]:bg-blue-500/10 dark:data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400">
            全部模型
          </TabsTrigger>
          <TabsTrigger value="recent" className="text-sm data-[state=active]:bg-blue-500/10 dark:data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400" disabled={filteredModels.length === 0}>
            <Clock className="w-4 h-4 mr-1" />
            最近使用
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-0 space-y-1.5">
          {filteredModels.length === 0 ? (
            <div className="p-4 text-sm text-gray-500 text-center">{searchQuery ? '无匹配结果' : '正在加载模型列表...'}</div>
          ) : (
            <ModelList
              models={filteredModels}
              globalDefaultModel={globalDefaultModel}
              currentModelId={currentModelId}
              currentSelection={currentSelection}
              searchQuery={searchQuery}
              onSetDefault={onSetDefault}
              onOpenParameters={onOpenParameters}
            />
          )}
        </TabsContent>
        <TabsContent value="recent" className="mt-0 space-y-1.5">
          <RecentModelsList
            recentModelDetails={recentModelDetails}
            globalDefaultModel={globalDefaultModel}
            currentModelId={currentModelId}
            onSetDefault={onSetDefault}
            onOpenParameters={onOpenParameters}
          />
        </TabsContent>
      </Tabs>
      </SelectContent>
    </TooltipProvider>
  );
} 