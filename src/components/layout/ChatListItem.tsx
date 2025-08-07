"use client";

import { MessageSquare, Star, MoreHorizontal, FolderOpen } from 'lucide-react';
import { cn } from "@/lib/utils";

interface ChatListItemProps {
  id: string;
  title: string;
  model?: string;
  time?: string;
  tags?: string[];
  category?: string;
  isActive?: boolean;
  isUnread?: boolean;
  isStarred?: boolean;
  onSelect: (id: string) => void;
  onStarToggle?: (id: string) => void;
  onMoreActions?: (id: string) => void;
}

export function ChatListItem({
  id,
  title,
  model,
  time,
  tags,
  category,
  isActive = false,
  isUnread = false,
  isStarred = false,
  onSelect,
  onStarToggle,
  onMoreActions
}: ChatListItemProps) {
  if (category) {
    return (
      <div className="flex items-center py-2 px-2 mt-2">
        <FolderOpen className="w-4 h-4 text-secondary dark:text-secondary mr-2" />
        <span className="text-sm font-medium text-secondary dark:text-secondary">{category}</span>
      </div>
    );
  }
  
  return (
    <div
      className={cn(
        "chat-list-item flex items-center p-2 rounded-md mb-1 cursor-pointer transition-all duration-200 group",
        isActive
          ? "bg-gradient-to-r from-indigo-50 to-purple-50 dark:bg-gray-700/80 hover:shadow-md scale-[1.01]"
          : "bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700/60 hover:scale-[1.02] hover:shadow-sm",
        isUnread && !isActive && "bg-gradient-to-r from-orange-50 to-red-50 dark:bg-gradient-to-r dark:from-orange-900/60 dark:to-red-900/60 relative"
      )}
      onClick={() => onSelect(id)}
    >
      <div className="text-secondary dark:text-primary mr-2">
        <MessageSquare className="w-5 h-5" />
      </div>
      <div className="flex-1 overflow-hidden">
        <div className={cn(
          "truncate font-medium text-[13px] sm:text-sm",
          isActive ? "text-gray-800 dark:text-white" : "text-gray-800 dark:text-gray-200"
        )}>{title}</div>
        <div className="flex flex-wrap items-center text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 gap-x-2 gap-y-0.5 mt-0.5 max-w-full">
          {time && <span>{time}</span>}
          {model && <span className="text-secondary dark:text-primary font-medium">{model}</span>}
        </div>
        {tags && tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {tags.map((tag, index) => (
              <span 
                key={index}
                className="inline-block text-xs bg-gradient-to-r from-blue-100 to-indigo-100 dark:bg-gradient-to-r dark:from-blue-800/50 dark:to-indigo-800/50 px-1.5 py-0.5 rounded text-indigo-700 dark:text-indigo-200 shadow-sm dark:shadow-none"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        {onStarToggle && (
          <button 
            className={cn(
              "p-1 rounded transition-colors duration-200 cursor-pointer",
              isStarred 
                ? "text-accent dark:text-yellow-400 hover:bg-red-100/50 dark:hover:bg-red-800/40"
                : "text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600/70 hover:text-gray-600 dark:hover:text-gray-300"
            )}
            title="收藏"
            onClick={(e) => { e.stopPropagation(); onStarToggle(id); }}
          >
            <Star className="w-4 h-4" />
          </button>
        )}
        {onMoreActions && (
          <button 
            className="p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600/70 rounded transition-colors duration-200 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
            title="更多"
            onClick={(e) => { e.stopPropagation(); onMoreActions(id); }}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        )}
      </div>
      {isUnread && !isActive && (
        <div className="unread-dot absolute top-1.5 right-1.5 bg-red-500 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-800 animate-pulse opacity-80"></div>
      )}
    </div>
  );
} 