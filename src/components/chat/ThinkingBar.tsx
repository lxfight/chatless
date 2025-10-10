"use client";

import { useState } from 'react';
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
 * 提取思考内容的最后一行
 */
const extractLatestThought = (content: string): string => {
  if (!content) return '';
  const lines = content.trim().split('\n');
  return lines[lines.length - 1];
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

  // 提取最后一行思考内容
  const latestThought = extractLatestThought(thinkingContent);
  
  // 格式化时长
  const formattedDuration = formatDuration(durationSeconds);

  // 判断是否有内容
  const hasContent = thinkingContent.trim().length > 0;

  return (
    <div className={cn(
      "group relative rounded-xl border backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-slate-900/60 transition-all duration-300 overflow-hidden",
      isActive 
        ? "border-green-400/60 bg-gradient-to-r from-green-50/60 to-emerald-50/40 dark:border-green-800/50 dark:from-green-950/30 dark:to-emerald-950/20 shadow-md shadow-green-200/30 dark:shadow-green-900/30 ring-1 ring-green-300/20 dark:ring-green-700/20" 
        : "border-slate-200/70 bg-gradient-to-r from-slate-50/50 to-slate-100/40 dark:border-slate-700/70 dark:from-slate-800/40 dark:to-slate-800/30 shadow-sm"
    )}>
      {/* 单行展示：呼吸动效 + 大脑图标 + 思考内容 + 三点波浪 + 时长 + 展开按钮 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3.5 py-2.5 flex items-center gap-2.5 hover:bg-slate-100/40 dark:hover:bg-slate-800/60 transition-all duration-200 cursor-pointer"
      >
        {/* 绿色呼吸动效指示器 */}
        {isActive && (
          <div className="relative flex items-center justify-center w-2 h-2 flex-shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </div>
        )}
        
        {/* 大脑图标 */}
        <Brain className={cn(
          "w-4 h-4 flex-shrink-0 transition-all duration-200",
          isActive ? "text-green-600 dark:text-green-400 drop-shadow-sm" : "text-slate-500 dark:text-slate-400"
        )} /> 
        
        {/* 思考内容 - 单行显示，带呼吸闪动特效 */}
        <span className={cn(
          "flex-1 text-xs truncate text-left transition-all duration-300 font-medium",
          isActive 
            ? "text-slate-800 dark:text-slate-100 animate-pulse" 
            : "text-slate-700 dark:text-slate-300"
        )}>
          {latestThought || '正在思考'}
        </span>
        
        {/* 三点波浪动画 */}
        {isActive && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <span className="w-1 h-1 bg-green-500 dark:bg-green-400 rounded-full animate-[bounce_1.4s_ease-in-out_infinite]" />
            <span className="w-1 h-1 bg-green-500 dark:bg-green-400 rounded-full animate-[bounce_1.4s_ease-in-out_0.2s_infinite]" />
            <span className="w-1 h-1 bg-green-500 dark:bg-green-400 rounded-full animate-[bounce_1.4s_ease-in-out_0.4s_infinite]" />
          </div>
        )}

        {/* 时长显示 */}
        <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400 flex-shrink-0 font-medium">
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
        <div className="px-3.5 pb-3 border-t border-slate-200/70 dark:border-slate-700/70 pt-2.5 bg-slate-50/30 dark:bg-slate-900/30">
          <div className="prose prose-sm prose-slate dark:prose-invert max-w-none text-slate-700 dark:text-slate-300">
            <MemoizedMarkdown content={thinkingContent} />
          </div>
        </div>
      )}
    </div>
  );
};
