'use client';

import { SidebarNavButton } from '@/components/ui/SidebarNavButton';
import { Wrench } from "lucide-react";
import { 
  HomeIcon, 
  ChatIcon, 
  FolderIcon, 
  DatabaseIcon, 
  HistoryIcon, 
  AnalyticsIcon, 
  SettingsIcon,
  BookmarkIcon,
} from '@/components/icons/SidebarIcons';
import { shouldShowDevTools } from '@/lib/utils/environment';
import { useEffect, useState } from 'react';

// 基础侧边栏导航项
const baseNavItems = [
  { href: '/', label: '首页', icon: HomeIcon },
  { href: '/chat', label: '聊天会话', icon: ChatIcon },
  { href: '/prompts', label: '提示词库', icon: BookmarkIcon },
  { href: '/resources', label: '知识资源', icon: FolderIcon },
  { href: '/knowledge', label: '知识库', icon: DatabaseIcon },
  { href: '/history', label: '历史记录', icon: HistoryIcon },
  { href: '/analytics', label: '数据统计', icon: AnalyticsIcon },
  { href: '/settings', label: '设置', icon: SettingsIcon },
];

// 开发工具导航项
const devNavItems = [
  { href: '/dev-tools', label: '开发工具', icon: Wrench },
];

export function Sidebar() {
  const [showDevTools, setShowDevTools] = useState(false);
  
  useEffect(() => {
    // 客户端检测是否显示开发工具
    setShowDevTools(shouldShowDevTools());
  }, []);
  
  // 合并导航项
  const navItems = showDevTools ? [...baseNavItems, ...devNavItems] : baseNavItems;
  
  return (
    <div
      className="fixed left-0 top-0 h-screen bg-white dark:bg-gray-900 border-r border-slate-200/60 dark:border-slate-800/60 flex flex-col items-center pt-3 pb-4 z-50"
      style={{ width: 'var(--sidebar-width, 4.5rem)' }}
    >
      <div className="flex-1 flex flex-col items-center gap-4 overflow-y-auto py-2 no-scrollbar">
        {navItems.map((item) => {
          return (
            <SidebarNavButton
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              dev={item.href === '/dev-tools'}
            />
          );
        })}
      </div>
    </div>
  );
} 