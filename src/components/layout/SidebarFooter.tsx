"use client";

import { Keyboard, History, Bookmark, FolderOpen, Settings } from 'lucide-react';
import Link from 'next/link';
import { cn } from "@/lib/utils";

const footerItems = [
  { name: '历史记录', href: '/history', icon: History },
  { name: '提示词库', href: '/prompts', icon: Bookmark },
  { name: '知识资源', href: '/resources', icon: FolderOpen },
  { name: '设置', href: '/settings', icon: Settings },
];

interface SidebarFooterProps {
  className?: string;
}

export function SidebarFooter({ className }: SidebarFooterProps) {
  // TODO: Add keyboard shortcut functionality
  
  return (
    <div className={cn(
      "border-t border-slate-200 dark:border-slate-700 p-3",
      className
    )}>
      <div className="mb-2">
        <button className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-1.5 rounded-lg text-sm w-full transition-colors duration-200">
          <Keyboard className="w-4 h-4 text-blue-500 dark:text-blue-400" />
          <span>快捷键</span>
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1 text-sm">
        {footerItems.map((item) => (
          <Link 
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 text-slate-600 dark:text-slate-400",
              "hover:bg-slate-100 dark:hover:bg-slate-800 p-2 rounded-lg",
              "cursor-pointer transition-all duration-200",
              "hover:text-blue-600 dark:hover:text-blue-400"
            )}
            title={item.name}
          >
            <item.icon className="w-4 h-4" />
            <span>{item.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
} 