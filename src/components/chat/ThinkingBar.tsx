"use client";

import { useState } from 'react';
import { ChevronRight, Timer, Loader2 } from 'lucide-react';
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

  // 格式化时长
  const formattedDuration = formatDuration(durationSeconds);

  // 判断是否有内容
  const hasContent = thinkingContent.trim().length > 0;
  
  // 提取最后一行作为预览（思考中时只显示最新一行）
  const getLastLine = (text: string): string => {
    if (!text) return '';
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    return lines[lines.length - 1] || '';
  };
  
  const displayText = isActive ? getLastLine(thinkingContent) : thinkingContent;

  return (
    <div 
      onClick={() => setIsExpanded(!isExpanded)}
      className={cn(
        "rounded-lg border-l-[3px] border transition-all duration-300 cursor-pointer",
        isActive 
          ? "bg-blue-50/40 dark:bg-blue-950/20 border-blue-300/60 border-r-blue-200/40 border-t-blue-200/40 border-b-blue-200/40 dark:border-l-blue-800/60 dark:border-r-blue-900/30 dark:border-t-blue-900/30 dark:border-b-blue-900/30 hover:bg-blue-50/60 dark:hover:bg-blue-950/30" 
          : "bg-slate-50/40 dark:bg-slate-800/40 border-slate-300/50 border-r-slate-200/40 border-t-slate-200/40 border-b-slate-200/40 dark:border-l-slate-600/50 dark:border-r-slate-700/40 dark:border-t-slate-700/40 dark:border-b-slate-700/40 hover:bg-slate-50/60 dark:hover:bg-slate-800/60"
      )}
    >
      <div className="p-3.5">
        {/* 状态指示行 */}
        <div className="w-full flex items-center gap-2.5 group">
          {/* 旋转加载图标（思考中）或静态圆点（完成） */}
          <div className="relative flex items-center justify-center flex-shrink-0">
            {isActive ? (
              <>
                {/* 外圈光环效果 */}
                <div className="absolute w-5 h-5 rounded-full bg-blue-400/20 dark:bg-blue-400/10 animate-ping" />
                {/* 旋转图标 */}
                <Loader2 className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 relative z-10" 
                  style={{ animation: 'spin 1s linear infinite' }} />
              </>
            ) : (
              <div className="w-2 h-2 rounded-full bg-slate-400/70 flex-shrink-0" />
            )}
          </div>
          
          <span className={cn(
            "text-xs font-medium flex-shrink-0",
            isActive 
              ? "text-blue-600 dark:text-blue-400" 
              : "text-slate-500 dark:text-slate-400"
          )}>
            {isActive ? '正在思考' : '思考完成'}
          </span>

          {/* 时长显示 */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">
            <Timer className="w-3 h-3" />
            <span className="font-mono tabular-nums">{formattedDuration}</span>
          </div>
          
          {/* 展开/收起图标 */}
          {hasContent && (
            <ChevronRight className={cn(
              "w-3.5 h-3.5 transition-transform text-slate-400 dark:text-slate-500 flex-shrink-0 ml-auto",
              isExpanded && "rotate-90"
            )} />
          )}
        </div>
        
        {/* 思考内容预览（思考中显示最新一行，完成后收起） */}
        <div 
          className={cn(
            "overflow-hidden transition-all duration-500 ease-in-out",
            isActive && !isExpanded && hasContent 
              ? "mt-3 max-h-20 opacity-100" 
              : "mt-0 max-h-0 opacity-0"
          )}
        >
          <div className="text-sm text-slate-600/80 dark:text-slate-300/70 leading-relaxed truncate">
            <div className="relative">
              <span key={displayText} className="animate-in fade-in-0 slide-in-from-right-2 duration-300">
                {displayText}
              </span>
              {isActive && (
                <span className="inline-block w-0.5 h-4 bg-blue-500/60 dark:bg-blue-400/60 ml-0.5 animate-pulse align-middle" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 完整思考内容（展开时） */}
      {isExpanded && hasContent && (
        <div className="px-3.5 pb-3.5 text-sm border-t border-slate-200/50 dark:border-slate-700/50 pt-3 animate-in fade-in-0 slide-in-from-top-2 duration-200">
          <div className="markdown-content-area text-slate-700 dark:text-slate-300">
            <MemoizedMarkdown content={thinkingContent} sizeOverride='small' />
          </div>
        </div>
      )}
    </div>
  );
};
