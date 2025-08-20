"use client";

import { SettingsSidebar } from "./SettingsSidebar";
import { useProviderManagement } from '@/hooks/useProviderManagement';
import { useEffect, useRef } from "react";

interface SettingsLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function SettingsLayout({ children, activeTab, onTabChange }: SettingsLayoutProps) {
  // 进入设置界面即预加载 AI 提供商状态，避免首次点击时出现 "未知" 状态
  useProviderManagement();
  // 保持滚动位置（按 tab 维度）
  const mainRef = useRef<HTMLDivElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const key = `settings_scroll_${activeTab}`;
      const saved = typeof window !== 'undefined' ? window.sessionStorage.getItem(key) : null;
      if (saved && mainRef.current) {
        const y = parseInt(saved, 10);
        if (!Number.isNaN(y)) mainRef.current.scrollTop = y;
      }
    } catch {}
  }, [activeTab]);

  const handleScroll = () => {
    if (!mainRef.current) return;
    const key = `settings_scroll_${activeTab}`;
    const save = () => {
      try { window.sessionStorage.setItem(key, String(mainRef.current!.scrollTop)); } catch {}
    };
    // 简单节流，避免频繁写入
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(save, 120);
  };

  // 监听内容结构变化，若出现滚动位置被重置为 0，则恢复到上次位置
  useEffect(() => {
    const el = mainRef.current;
    if (!el || typeof window === 'undefined') return;
    const key = `settings_scroll_${activeTab}`;
    const observer = new MutationObserver(() => {
      try {
        const saved = window.sessionStorage.getItem(key);
        const y = saved ? parseInt(saved, 10) : 0;
        // 当存在历史位置且当前被重置到顶部时恢复（避免干扰用户主动回到顶部）
        if (y > 0 && el.scrollTop <= 2) {
          el.scrollTop = y;
        }
      } catch {}
    });
    observer.observe(el, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [activeTab]);
  return (
    <div className="flex flex-col h-full bg-gray-50/50 dark:bg-gray-900/50 overflow-hidden">
        {/* 头部暂时隐藏以保持简洁 */}
        <div className="flex flex-1 overflow-hidden">
             {/* 设置侧边栏 */}
             <SettingsSidebar activeTab={activeTab} onTabChange={onTabChange} />
             {/* 设置内容区域 */}
             <main ref={mainRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-8 dark:bg-gray-900 custom-scrollbar text-sm">
               {children}
             </main>
        </div>
    </div>
  );
} 