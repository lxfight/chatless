"use client";

import { useState, useEffect, useMemo, useCallback, useRef, useDeferredValue } from 'react';
import StorageUtil from '@/lib/storage';
import { useUiPreferences } from '@/store/uiPreferences';
import { cn } from "@/lib/utils";
import {  X, Clock, Star, Flag, RotateCcw, ListPlus } from 'lucide-react';
import { IconButton } from '@/components/ui/icon-button';
// import { SidebarHeader } from './SidebarHeader';
import { ConversationSidebar } from "@/components/chat/ConversationSidebar";
import { useChatStore } from "@/store/chatStore";
import { Message, Conversation } from "@/types/chat";
import { SidebarContext } from "@/contexts/SidebarContext";
import { SearchInput } from '@/components/ui/search-input';

interface ChatLayoutProps {
  children: React.ReactNode;
}

export function ChatLayout({ children }: ChatLayoutProps) {
  const collapseChatSidebar = useUiPreferences((s) => s.collapseChatSidebar);
  const setCollapseChatSidebar = useUiPreferences((s) => s.setCollapseChatSidebar);
  const [isSidebarOpen, setIsSidebarOpen] = useState(!collapseChatSidebar);
  // 侧边栏默认宽度 224px（Tailwind w-56），更加节省空间
  const DEFAULT_SIDEBAR_WIDTH = 224;
  // 首屏消除闪烁：优先使用 localStorage 中的同步宽度作为初始值
  const getInitialSidebarPx = () => {
    try {
      if (typeof window !== 'undefined') {
        const raw = window.localStorage.getItem('ui_chat_sidebar_px');
        const px = raw ? parseInt(raw, 10) : NaN;
        if (!Number.isNaN(px)) return px;
      }
    } catch { /* noop */ }
    return DEFAULT_SIDEBAR_WIDTH;
  };
  const [sidebarWidth, setSidebarWidth] = useState<number>(getInitialSidebarPx());
  const sidebarWidthRef = useRef(sidebarWidth);
  const resetBtnRef = useRef<HTMLButtonElement | null>(null);
  const SIDEBAR_PX_KEY = 'ui_chat_sidebar_px';
  const MIN_SIDEBAR_WIDTH = 200; // 最小宽度
  const MAX_SIDEBAR_WIDTH = 480; // 最大宽度，防止聊天区域过窄
  const [mounted, setMounted] = useState(false);

  // 组件挂载时读取（异步）Tauri Store，完成后标记 mounted 以启用过渡动画
  useEffect(() => {
    (async () => {
      const saved = await StorageUtil.getItem<number>(SIDEBAR_PX_KEY, getInitialSidebarPx(), 'user-preferences.json');
      if (typeof saved === 'number' && saved >= MIN_SIDEBAR_WIDTH && saved <= window.innerWidth - 400) {
        if (saved !== sidebarWidthRef.current) {
          setSidebarWidth(saved);
          sidebarWidthRef.current = saved;
          try { window.localStorage.setItem(SIDEBAR_PX_KEY, String(saved)); } catch { /* noop */ }
        }
      }
      setMounted(true);
    })();
  }, []);

  // 同步 ref
  useEffect(() => {
    sidebarWidthRef.current = sidebarWidth;
  }, [sidebarWidth]);

  const [isDragging, setIsDragging] = useState(false);
  // 拖拽开始位置
  const dragInfo = useRef<{ startX: number; startWidth: number } | null>(null);
  // 记录拖拽开始前 body 的 userSelect 值，方便恢复
  const prevUserSelect = useRef<string | null>(null);

  /**
   * 拖拽侧边栏宽度
   */
  const handleDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    // 如果侧边栏已折叠，不允许拖拽
    if (!isSidebarOpen) return;
    // 阻止默认选区行为
    e.preventDefault();

    dragInfo.current = { startX: e.clientX, startWidth: sidebarWidth };

    // 禁用页面文字选中，避免出现蓝色选区（双保险：内联样式 + Tailwind class）
    prevUserSelect.current = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
    document.body.classList.add('select-none');
    setIsDragging(true);

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragInfo.current) return;
      const delta = ev.clientX - dragInfo.current.startX;
      let newWidth = dragInfo.current.startWidth + delta;
      newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(newWidth, MAX_SIDEBAR_WIDTH, window.innerWidth - 400));
      setSidebarWidth(newWidth);
      sidebarWidthRef.current = newWidth;
    };

    const handleMouseUp = (ev: MouseEvent) => {
      dragInfo.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      // 判断松开位置是否在重置按钮上（仅拖拽状态显示时）
      if (resetBtnRef.current) {
        const rect = resetBtnRef.current.getBoundingClientRect();
        if (
          ev.clientX >= rect.left &&
          ev.clientX <= rect.right &&
          ev.clientY >= rect.top &&
          ev.clientY <= rect.bottom
        ) {
          handleResetWidth();
        } else {
          // 拖拽结束后保存当前宽度
          StorageUtil.setItem<number>(SIDEBAR_PX_KEY, sidebarWidthRef.current, 'user-preferences.json');
          try { window.localStorage.setItem(SIDEBAR_PX_KEY, String(sidebarWidthRef.current)); } catch { /* noop */ }
        }
      } else {
        StorageUtil.setItem<number>(SIDEBAR_PX_KEY, sidebarWidthRef.current, 'user-preferences.json');
        try { window.localStorage.setItem(SIDEBAR_PX_KEY, String(sidebarWidthRef.current)); } catch { /* noop */ }
      }

      // 恢复 userSelect
      if (prevUserSelect.current !== null) {
        document.body.style.userSelect = prevUserSelect.current;
        prevUserSelect.current = null;
      }
      document.body.classList.remove('select-none');
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  const [searchQuery, setSearchQuery] = useState('');
  const deferredQuery = useDeferredValue(searchQuery);
  const [isSearching, setIsSearching] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'recent' | 'favorite' | 'important'>('recent');
  
  const createConversation = useChatStore((state) => state.createConversation);
  const conversations = useChatStore((state) => state.conversations);
  
  const toggleSidebar = () => {
    const nextOpen = !isSidebarOpen;
    setIsSidebarOpen(nextOpen);
  };

  // 同步 collapseChatSidebar 状态
  useEffect(() => {
    setCollapseChatSidebar(!isSidebarOpen);
  }, [isSidebarOpen, setCollapseChatSidebar]);
  
  // 处理搜索输入变化
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    setIsSearching(query.length > 0);
  }, []);
  
  // 清除搜索
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setIsSearching(false);
  }, []);

  // 处理分类筛选
  const handleFilterChange = (filter: 'recent' | 'favorite' | 'important') => {
    setActiveFilter(filter);
    // 如果在搜索模式，清除搜索
    if (isSearching) {
      handleClearSearch();
    }
  };

  // 过滤会话根据搜索关键词和分类筛选
  const filteredConversations = useMemo(() => {
    let result = conversations;
    
    // 首先应用分类筛选
    if (!isSearching) {
      switch (activeFilter) {
        case 'favorite':
          result = conversations.filter((conv: Conversation) => (conv as any)['is_favorite']);
          break;
        case 'important':
          result = conversations.filter((conv: Conversation) => (conv as any)['is_important']);
          break;
        case 'recent':
        default:
          result = conversations; // 显示所有会话，已经按更新时间排序
          break;
      }
    }
    
    // 如果在搜索模式，应用搜索筛选
    if (isSearching) {
      const normalizedQuery = deferredQuery.toLowerCase().trim();
      
      result = result.filter((conv: Conversation) => {
        // 搜索会话标题
        if (conv.title.toLowerCase().includes(normalizedQuery)) return true;
        
        // 搜索消息内容（安全检查messages是否存在）
        if (conv.messages && conv.messages.length > 0) {
          return conv.messages.some((message: Message) => 
            message.content.toLowerCase().includes(normalizedQuery)
          );
        }
        
        return false;
      });
    }
    
    return result;
  }, [conversations, deferredQuery, isSearching, activeFilter]);

  const handleNewChat = async () => {
    const defaultModelId = "default-model";
    const now = new Date();
    const newTitle = `新对话 ${now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute:'2-digit' })}`;
    await createConversation(newTitle, defaultModelId);
    
    // 创建新对话后清除搜索
    if (isSearching) {
      handleClearSearch();
    }
  };

  const handleResetWidth = useCallback(() => {
    setSidebarWidth(DEFAULT_SIDEBAR_WIDTH);
    sidebarWidthRef.current = DEFAULT_SIDEBAR_WIDTH;
    StorageUtil.setItem<number>(SIDEBAR_PX_KEY, DEFAULT_SIDEBAR_WIDTH, 'user-preferences.json');
    try { window.localStorage.setItem(SIDEBAR_PX_KEY, String(DEFAULT_SIDEBAR_WIDTH)); } catch { /* noop */ }
  }, []);

  return (
    <SidebarContext.Provider value={{ isSidebarOpen, toggleSidebar }}>
      <div className="flex min-h-0 h-full relative">
        {/* 左侧会话列表侧边栏 */}
        <aside
          style={{ width: isSidebarOpen ? sidebarWidth : 0 }}
          className={cn(
            "bg-white dark:bg-gray-900 flex flex-col min-h-0 flex-shrink-0",
            mounted ? "transition-all duration-300" : "transition-none",
            isSidebarOpen
              ? "border-r border-slate-200/50 dark:border-slate-800/50 translate-x-0"
              : "-translate-x-full overflow-hidden"
          )}
        >
          {/* 侧边栏头部已隐藏 */}

          {/* 搜索框 + 新建按钮 */}
          <div className="flex-shrink-0 p-2 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-900">
            {/* 搜索框（右侧内置“新建”按钮，保持与主头部对齐的高度和间距） */}
            <div className="flex items-center">
              <div className="flex-1 min-w-0">
                <div className="relative bg-slate-50 dark:bg-slate-800 rounded-lg pl-2.5 pr-9 py-1 focus-within:ring-2 focus-within:ring-blue-500/15 dark:focus-within:ring-blue-400/15 transition-all duration-200 shadow-sm/5 h-9">
                  <SearchInput
                    placeholder="搜索对话..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className="w-full bg-transparent border-none focus:ring-0 text-xs h-7"
                  />
                  {/* 右侧区域：清除 + 新建 */}
                  <div className="absolute top-1/2 -translate-y-1/2 right-1.5 flex items-center gap-1.5">
                    {isSearching && (
                      <button
                        onClick={handleClearSearch}
                        className="p-1 rounded-full hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors"
                        aria-label="清除搜索"
                      >
                        <X className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      </button>
                    )}
                    <IconButton
                      onClick={handleNewChat}
                      title="新建对话"
                      icon={ListPlus}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 对话分类标签 - 统一概念和图标 */}
          {!isSearching && (
            <div className="flex-shrink-0 flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              <div 
                className={cn(
                  "flex-1 text-center py-2 text-xs font-medium cursor-pointer transition-colors duration-200 flex items-center justify-center gap-2",
                  activeFilter === 'recent' 
                    ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-500/10" 
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                )} 
                onClick={() => handleFilterChange('recent')}
              >
                <Clock className="w-3 h-3" />
                <span>最近</span>
              </div>
              <div 
                className={cn(
                  "flex-1 text-center py-2 text-xs font-medium cursor-pointer transition-colors duration-200 flex items-center justify-center gap-2",
                  activeFilter === 'favorite' 
                    ? "text-yellow-600 dark:text-yellow-400 border-b-2 border-yellow-500 dark:border-yellow-400 bg-yellow-50 dark:bg-yellow-500/10" 
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                )} 
                onClick={() => handleFilterChange('favorite')}
              >
                <Star className={cn("w-3 h-3", activeFilter === 'favorite' && "fill-current")} />
                <span>收藏</span>
              </div>
              <div 
                className={cn(
                  "flex-1 text-center py-2 text-xs font-medium cursor-pointer transition-colors duration-200 flex items-center justify-center gap-2",
                  activeFilter === 'important' 
                    ? "text-red-600 border-b-2 border-red-500 bg-red-50" 
                    : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                )} 
                onClick={() => handleFilterChange('important')}
              >
                <Flag className="w-3 h-3" />
                <span>重要</span>
              </div>
            </div>
          )}

          {/* 会话列表 - 传递过滤后的会话 */}
          <div className="flex-1 min-h-0 overflow-hidden bg-white dark:bg-gray-900">
            <ConversationSidebar 
              filteredConversations={filteredConversations}
              isSearching={isSearching}
              searchQuery={searchQuery}
            />
          </div>
        </aside>

        {/* 拖拽分隔条 */}
        {isSidebarOpen && (
          <div
            onMouseDown={handleDragStart}
            className={cn(
              "relative w-1 cursor-col-resize group transition-colors duration-150",
              isDragging ? "bg-blue-500/20" : "dark:bg-slate-900 bg-transparent hover:bg-blue-500/10"
            )}
          >
            {/* 重置按钮，仅在拖拽时显示 */}
            {isDragging && (
              <button
                ref={resetBtnRef}
                title="恢复默认宽度"
                className="absolute -right-3 top-1/2 -translate-y-1/2 p-1 rounded-full bg-white dark:bg-slate-800 shadow-md hover:bg-blue-500 hover:text-white transition-colors pointer-events-none"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* 主内容区域 */}
        <main className="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-slate-900">
          {/* 聊天内容区域 - 使用flex-1和min-h-0确保正确滚动 */}
          <div className="flex-1 min-h-0 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarContext.Provider>
  );
} 