import { KnowledgeFilterBar } from "./KnowledgeFilterBar";
import { KnowledgeTabs } from "./KnowledgeTabs";

export interface KnowledgeLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tabId: string) => void;
  activeFilter: string;
  onFilterChange: (filterId: string) => void;
  sortBy: string;
  onSortChange: (sortValue: string) => void;
  onCreateKnowledgeBase?: () => void;
}

export function KnowledgeLayout({
  children,
  activeTab,
  onTabChange,
  activeFilter,
  onFilterChange,
  sortBy,
  onSortChange,
  onCreateKnowledgeBase,
}: KnowledgeLayoutProps) {
  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-white/95 to-gray-50/90 dark:from-gray-900/95 dark:to-gray-950/90 backdrop-blur-md border border-gray-200/60 dark:border-gray-800/60 overflow-hidden shadow-lg overflow-x-hidden">
      {/* 顶栏已移除，创建功能移动至筛选栏菜单 */}
      <KnowledgeTabs activeTab={activeTab} onTabChange={onTabChange} />
      <KnowledgeFilterBar 
        activeFilter={activeFilter} 
        onFilterChange={onFilterChange}
        sortBy={sortBy}
        onSortChange={onSortChange}
        onCreateKnowledgeBase={onCreateKnowledgeBase}
      />
      <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 custom-scrollbar bg-gradient-to-br from-gray-50/80 to-slate-50/60 dark:from-gray-950/80 dark:to-slate-950/60">
        {children}
      </main>
    </div>
  );
} 