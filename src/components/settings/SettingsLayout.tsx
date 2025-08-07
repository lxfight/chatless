"use client";

import { SettingsSidebar } from "./SettingsSidebar";
import { useProviderManagement } from '@/hooks/useProviderManagement';

interface SettingsLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function SettingsLayout({ children, activeTab, onTabChange }: SettingsLayoutProps) {
  // 进入设置界面即预加载 AI 提供商状态，避免首次点击时出现 "未知" 状态
  useProviderManagement();
  return (
    <div className="flex flex-col h-full bg-gray-50/50 dark:bg-gray-900/50 overflow-hidden">
        {/* 头部暂时隐藏以保持简洁 */}
        <div className="flex flex-1 overflow-hidden">
             {/* 设置侧边栏 */}
             <SettingsSidebar activeTab={activeTab} onTabChange={onTabChange} />
             {/* 设置内容区域 */}
             <main className="flex-1 overflow-y-auto p-8 dark:bg-gray-900 custom-scrollbar text-sm">
               {children}
             </main>
        </div>
    </div>
  );
} 