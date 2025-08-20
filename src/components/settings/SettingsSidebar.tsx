"use client";

import { cn } from "@/lib/utils";
import { 
  SlidersHorizontal, 
  ShieldCheck, 
  Bot, 
  Settings,
  Database,
  Info
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { shouldShowAboutBlueDot, UPDATE_AVAILABILITY_EVENT, checkForUpdatesSilently } from '@/lib/update/update-notifier';

const settingsTabs = [
  { id: 'general', name: '常规', icon: SlidersHorizontal },
  { id: 'localModels', name: 'AI模型', icon: Bot },
  { id: 'knowledgeBase', name: '知识库', icon: Database },
  { id: 'privacySecurity', name: '安全', icon: ShieldCheck },
  { id: 'advanced', name: '高级', icon: Settings },
  { id: 'aboutSupport', name: '关于', icon: Info },
];

interface SettingsSidebarProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function SettingsSidebar({ activeTab, onTabChange }: SettingsSidebarProps) {
  const [showAboutDot, setShowAboutDot] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const show = await shouldShowAboutBlueDot();
        if (mounted) setShowAboutDot(show);
      } catch {}
      // 进入设置页时主动触发一次静默检查，避免首次加载竞态
      try { await checkForUpdatesSilently(true); } catch {}
    })();
    const onChanged = async () => {
      const show = await shouldShowAboutBlueDot();
      if (mounted) setShowAboutDot(show);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener(UPDATE_AVAILABILITY_EVENT, onChanged as EventListener);
    }
    return () => {
      mounted = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener(UPDATE_AVAILABILITY_EVENT, onChanged as EventListener);
      }
    };
  }, []);

  // 进入“关于”标签时立刻隐藏蓝点（并由 settings/page.ts 记录查看时间）
  useEffect(() => {
    if (activeTab === 'aboutSupport') {
      setShowAboutDot(false);
    }
  }, [activeTab]);
  return (
    <div className="w-56 border-r border-slate-200 dark:border-slate-700 overflow-y-auto custom-scrollbar bg-white dark:bg-gray-900 flex flex-col h-full select-none">
      {/* Header */}
      <div className="p-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
        <h3 className="font-medium text-slate-700 dark:text-slate-300 text-sm">设置</h3>
      </div>
      
      {/* Settings Tabs */}
      <div className="flex-1 p-2 space-y-1">
        {settingsTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          const isAbout = tab.id === 'aboutSupport';
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors duration-200 border border-transparent",
                isActive 
                  ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/40 font-medium" 
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              <Icon className={cn(
                "w-4 h-4 flex-shrink-0",
                isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400"
              )} />
              <span className="truncate flex items-center gap-2">
                {tab.name}
                {isAbout && showAboutDot && !isActive && (
                  <span
                    className="ml-1 inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-1 py-[1px] text-[9px] leading-[12px] text-blue-600 dark:text-blue-400 align-middle"
                  >
                    NEW
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
} 