"use client";

import { useState, useMemo, useEffect } from 'react';
import { ChevronRight, Timer, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MemoizedMarkdown } from './MemoizedMarkdown';

interface ThinkingBarProps {
  thinkingContent: string;
  isThinking: boolean;
  elapsedTime: number;
}

const formatDuration = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}秒`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds}秒`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${hours}小时${minutes}分${remainingSeconds}秒`;
  }
};

export const ThinkingBar = ({
  thinkingContent,
  isThinking,
  elapsedTime,
}: ThinkingBarProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentElapsedTime, setCurrentElapsedTime] = useState(elapsedTime);

             // 监听 elapsedTime 变化，确保 currentElapsedTime 同步
           useEffect(() => {
             setCurrentElapsedTime(elapsedTime);
           }, [elapsedTime, isThinking, thinkingContent]);

  // 实时更新计时器
  useEffect(() => {
    if (isThinking) {
      // 每秒更新一次
      const interval = setInterval(() => {
        setCurrentElapsedTime(prev => prev + 1000);
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [isThinking]);

  const latestThought = useMemo(() => {
    if (!thinkingContent) return '';
    const lines = thinkingContent.trim().split('\n');
    return lines[lines.length - 1];
  }, [thinkingContent]);

  const hasContent = thinkingContent && thinkingContent.trim().length > 0;

  return (
    <div className={cn(
      "mb-3 max-w-full transition-all duration-300 ease-out",
      isExpanded 
        ? "bg-gray-50 dark:bg-slate-800/40 rounded-xl shadow-sm" 
        : isThinking
          ? "bg-gradient-to-r from-emerald-50/50 to-teal-50/50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl animate-pulse"
        : "bg-transparent"
    )}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full text-left transition-all duration-300 ease-out",
          isExpanded ? "p-2.5" : "py-1.5 px-2",
          isThinking 
            ? "hover:bg-emerald-100/30 dark:hover:bg-emerald-800/20"
            : "hover:bg-slate-100/50 dark:hover:bg-slate-700/30",
          "rounded-xl"
        )}
        disabled={!hasContent}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 min-w-0">
          <div className="flex items-center shrink-0 text-slate-600 dark:text-slate-300">
            <ChevronRight
              className={cn(
                'w-3.5 h-3.5 mr-1.5 transition-transform duration-200 ease-out',
                isExpanded && 'rotate-90'
              )}
            />
            <Brain className={cn(
              "w-3.5 h-3.5 mr-1.5 transition-all duration-300",
              isThinking && "text-emerald-600 dark:text-emerald-400 animate-pulse"
            )} />
            <span className={cn(
              "text-xs font-medium transition-colors duration-300",
              isThinking && "text-emerald-700 dark:text-emerald-300"
            )}>
              {isExpanded ? '隐藏思考过程' : '思考过程'}
            </span>
          </div>
          
          {!isExpanded && hasContent && (
            <div className="flex items-center min-w-0 flex-1 transition-all duration-300 ease-out">
              <span className={cn(
                "text-xs break-all line-clamp-1 italic transition-all duration-300 ease-out",
                isThinking 
                  ? "text-emerald-600 dark:text-emerald-400" 
                  : "text-slate-500 dark:text-slate-400"
              )}>
                {latestThought}
              </span>
            </div>
          )}

          <div className="flex items-center text-xs shrink-0 sm:ml-auto transition-all duration-300 ease-out">
            <Timer className={cn(
              "w-3 h-3 mr-1 transition-colors duration-300",
              isThinking 
                ? "text-emerald-500 dark:text-emerald-400" 
                : "text-slate-500 dark:text-slate-400"
            )} />
            {currentElapsedTime > 0 && (
              <span
                className={cn(
                  "transition-all duration-300 ease-out",
                  isThinking
                    ? "text-emerald-600 dark:text-emerald-300"
                    : "text-slate-500 dark:text-slate-400"
                )}
              >
                {formatDuration(currentElapsedTime)}
              </span>
            )}
            
            {isThinking && (
              <div className="ml-1.5 flex items-center gap-1">
                <div className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce"></div>
              </div>
            )}
          </div>
        </div>
      </button>
      
      {isExpanded && hasContent && (
        <div className="px-3 pb-3 transition-all duration-300 ease-out">
          <div className="prose prose-sm dark:prose-invert max-w-full">
            <MemoizedMarkdown content={thinkingContent} />
          </div>
        </div>
      )}
    </div>
  );
}; 