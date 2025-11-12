"use client";

import { cn } from "@/lib/utils";
import { 
  SlidersHorizontal, 
  ShieldCheck, 
  Bot, 
  Settings,
  Database,
  Info,
  Plug,
  Globe
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { shouldShowAboutBlueDot, UPDATE_AVAILABILITY_EVENT, checkForUpdatesSilently } from '@/lib/update/update-notifier';

const settingsTabs = [
  { id: 'general', name: '常规', icon: SlidersHorizontal },
  { id: 'localModels', name: 'AI模型', icon: Bot },
  { id: 'knowledgeBase', name: '知识库', icon: Database },
  { id: 'webSearch', name: '网络搜索', icon: Globe },
  { id: 'mcpServers', name: 'MCP 服务器', icon: Plug },
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
      try { await checkForUpdatesSilently(); } catch {}
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
    <div className="w-60 border-r border-gray-200/60 dark:border-gray-800/50 overflow-y-auto custom-scrollbar bg-gradient-to-b from-white/95 to-gray-50/90 dark:from-gray-900/95 dark:to-gray-950/90 backdrop-blur-md flex flex-col h-full select-none shadow-sm">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-gray-200/60 dark:border-gray-800/50 flex-shrink-0">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">设置</h3>
      </div>
      
      {/* Settings Tabs */}
      <div className="flex-1 p-3 space-y-1.5">
        {settingsTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          const isAbout = tab.id === 'aboutSupport';
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all duration-200 border",
                isActive 
                  ? "bg-gradient-to-r from-blue-50 to-indigo-50/80 dark:from-blue-900/30 dark:to-indigo-900/25 text-blue-700 dark:text-blue-300 border-blue-300/60 dark:border-blue-600/50 shadow-md font-semibold" 
                  : "text-gray-700 dark:text-gray-400 hover:bg-gradient-to-r hover:from-gray-100/80 hover:to-slate-100/60 dark:hover:from-gray-800/60 dark:hover:to-slate-800/50 hover:text-gray-900 dark:hover:text-gray-200 border-transparent hover:shadow-sm"
              )}
            >
              <Icon className={cn(
                "w-4 h-4 flex-shrink-0 transition-transform",
                isActive ? "text-blue-600 dark:text-blue-400 scale-110" : "text-gray-500 dark:text-gray-400"
              )} />
              <span className="truncate flex items-center gap-2 flex-1">
                {tab.name}
                {isAbout && showAboutDot && !isActive && (
                  <span
                    className="ml-auto inline-flex items-center rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 px-2 py-0.5 text-[9px] font-semibold leading-tight text-white shadow-md"
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