"use client";

import { useState, useEffect } from 'react';
import { ChevronRight, Timer, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MemoizedMarkdown } from './MemoizedMarkdown';

interface ThinkingBarProps {
  thinkingContent: string;
  /** 思考时长（秒），由父组件计算并传入 */
  durationSeconds: number;
  /** 是否正在思考（用于显示动画效果） */
  isActive?: boolean;
}

/**
 * 从思考内容中提取片段（按行分割，过滤空行）
 */
const extractThinkingFragments = (content: string): string[] => {
  if (!content) return [];
  
  // 按行分割，过滤空行和过长的行
  const lines = content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && line.length < 50); // 只保留合适长度的行
  
  // 如果没有合适的行，尝试按句子分割
  if (lines.length === 0 && content.length > 0) {
    const sentences = content
      .split(/[。！？.!?]/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && s.length < 50);
    return sentences.slice(-5); // 最多保留最后5个片段
  }
  
  return lines.slice(-5); // 最多保留最后5行
};

/**
 * 格式化时长显示
 * @param seconds 秒数
 */
const formatDuration = (seconds: number): string => {
  const s = Math.floor(seconds);
  if (s < 60) {
    return `${s}秒`;
  } else if (s < 3600) {
    const minutes = Math.floor(s / 60);
    const remainingSeconds = s % 60;
    return `${minutes}分${remainingSeconds}秒`;
  } else {
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const remainingSeconds = s % 60;
    return `${hours}小时${minutes}分${remainingSeconds}秒`;
  }
};

/**
 * ThinkingBar - 纯展示组件
 * 
 * 设计原则：
 * 1. 所有计时逻辑由父组件负责
 * 2. 本组件只负责展示
 * 3. 没有内部定时器，没有复杂状态管理
 * 4. 单向数据流，简单可靠
 */
export const ThinkingBar = ({
  thinkingContent,
  durationSeconds,
  isActive = false,
}: ThinkingBarProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentFragmentIndex, setCurrentFragmentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // 从思考内容中提取片段
  const thinkingFragments = extractThinkingFragments(thinkingContent);
  
  // 当内容变化时重置索引
  useEffect(() => {
    setCurrentFragmentIndex(0);
  }, [thinkingContent]);
  
  // 动态切换思考片段（从实际内容中提取），带淡入淡出效果
  useEffect(() => {
    if (!isActive || thinkingFragments.length <= 1) {
      setIsTransitioning(false);
      return;
    }
    
    let timeoutId: NodeJS.Timeout | null = null;
    
    const interval = setInterval(() => {
      // 先淡出
      setIsTransitioning(true);
      
      // 400ms后切换内容并淡入
      timeoutId = setTimeout(() => {
        setCurrentFragmentIndex((prev) => (prev + 1) % thinkingFragments.length);
        setIsTransitioning(false);
      }, 400);
    }, 3500); // 每3.5秒切换一次片段
    
    return () => {
      clearInterval(interval);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isActive, thinkingFragments.length]);

  // 格式化时长
  const formattedDuration = formatDuration(durationSeconds);

  // 判断是否有内容
  const hasContent = thinkingContent.trim().length > 0;
  
  // 获取当前显示的思考片段
  const currentFragment = thinkingFragments[currentFragmentIndex] || '思考中';

  return (
    <div className={cn(
      "group relative rounded-xl border backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-slate-900/60 transition-all duration-300 overflow-hidden",
      isActive 
        ? "border-green-400/60 bg-gradient-to-r from-green-50/60 to-emerald-50/40 dark:border-green-800/50 dark:from-green-950/30 dark:to-emerald-950/20 shadow-md shadow-green-200/30 dark:shadow-green-900/30 ring-1 ring-green-300/20 dark:ring-green-700/20" 
        : "border-slate-200/70 bg-gradient-to-r from-slate-50/50 to-slate-100/40 dark:border-slate-700/70 dark:from-slate-800/40 dark:to-slate-800/30 shadow-sm"
    )}>
      {/* 单行展示：大脑图标 + 思考内容 + 波浪三点动画 + 时长 + 展开按钮 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3.5 py-2.5 flex items-center gap-2.5 hover:bg-slate-100/40 dark:hover:bg-slate-800/60 transition-all duration-200 cursor-pointer"
      >
        {/* 大脑图标 */}
        <Brain className={cn(
          "w-4 h-4 flex-shrink-0 transition-all duration-200",
          isActive ? "text-green-600 dark:text-green-400 drop-shadow-sm" : "text-slate-500 dark:text-slate-400"
        )} /> 
        
        {/* 思考状态文字：正在思考时显示"正在思考 · 动态片段"，结束后显示"思考过程" */}
        <div className={cn(
          "flex-1 text-xs text-left flex items-center gap-1.5 min-w-0 overflow-hidden",
          isActive 
            ? "text-slate-700 dark:text-slate-200" 
            : "text-slate-700 dark:text-slate-300"
        )}>
          {isActive ? (
            <>
              <span className="font-medium shrink-0">正在思考</span>
              <span className="text-slate-400 dark:text-slate-500 shrink-0">·</span>
              <div className="relative flex-1 min-w-0 h-5 flex items-center overflow-hidden">
                <span 
                  key={currentFragmentIndex}
                  className={cn(
                    "absolute left-0 right-0 text-slate-500 dark:text-slate-400 truncate transition-all duration-500 ease-out",
                    isTransitioning 
                      ? "opacity-0 translate-y-3" 
                      : "opacity-60 translate-y-0"
                  )}
                >
                  {currentFragment}
                </span>
              </div>
            </>
          ) : (
            <span className="font-medium">思考过程</span>
          )}
        </div>

        {/* 波浪三点动画（仅在思考时显示） */}
        {isActive && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="w-1 h-1 bg-green-500 dark:bg-green-400 rounded-full animate-bounce-wave" style={{ animationDelay: '0s' }} />
            <span className="w-1 h-1 bg-green-500 dark:bg-green-400 rounded-full animate-bounce-wave" style={{ animationDelay: '0.15s' }} />
            <span className="w-1 h-1 bg-green-500 dark:bg-green-400 rounded-full animate-bounce-wave" style={{ animationDelay: '0.3s' }} />
          </div>
        )}

        {/* 时长显示 */}
        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 flex-shrink-0 font-medium">
          <Timer className="w-3.5 h-3.5" />
          <span className="font-mono tabular-nums">{formattedDuration}</span>
        </div>
        
        {/* 展开/收起图标 */}
        {hasContent && (
          <ChevronRight className={cn(
            "w-4 h-4 transition-transform text-slate-400 dark:text-slate-500 flex-shrink-0",
            isExpanded && "rotate-90"
          )} />
        )}
      </button>

      {/* 完整思考内容（展开时） */}
      {isExpanded && hasContent && (
        <div className="px-3.5 p-1.5 text-xs border-t border-slate-200/70 dark:border-slate-700/70 pt-2.5 bg-slate-50/30 dark:bg-slate-900/30">
          <div className="markdown-content-area text-slate-700 dark:text-slate-300">
            <MemoizedMarkdown content={thinkingContent} sizeOverride='small' />
          </div>
        </div>
      )}
    </div>
  );
};
