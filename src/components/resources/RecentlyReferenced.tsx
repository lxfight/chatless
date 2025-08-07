'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { FileText, FileJson, FileCode, Clock } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface RecentReference {
  id: string;
  type: string;
  name: string;
  context: string;
  time: string;
  conversationId: string;
}

interface RecentlyReferencedProps {
  references: RecentReference[];
  onNavigate?: (convId: string) => void;
}

// 获取简约图标
const getIcon = (type: string) => {
  const t = type.toLowerCase();
  if (t === 'json') return <FileJson className="h-4 w-4 text-slate-500" />;
  if (['md', 'markdown', 'txt'].includes(t)) return <FileCode className="h-4 w-4 text-slate-500" />;
  return <FileText className="h-4 w-4 text-slate-500" />;
};

export function RecentlyReferenced({ references, onNavigate }: RecentlyReferencedProps) {
  const [hover, setHover] = useState(false);
  const visibleRefs = hover ? references : references.slice(0, 1);

  return (
    <div
      className="group"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <h3 className="font-medium text-sm text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
        <Clock className="h-4 w-4 text-emerald-500" />
        最近引用
      </h3>

      {references.length === 0 ? (
        <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-3 text-center text-xs text-slate-500 dark:text-slate-400">
          暂无最近引用
        </div>
      ) : (
        <ScrollArea className={cn(
          'rounded-lg border border-transparent transition-all',
          hover ? 'h-40' : 'h-11'
        )}>
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {visibleRefs.map(ref => (
              <div
                key={ref.id}
                className="flex items-center gap-3 px-2 py-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                onClick={() => onNavigate && (onNavigate as any)(ref.conversationId)}
              >
                <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-50 dark:bg-emerald-600/20">
                  {getIcon(ref.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-800 dark:text-slate-200">{ref.name}</p>
                  {hover && (
                    <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{ref.context} • {ref.time}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
} 