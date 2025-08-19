"use client";

import { useEffect, useRef, useState, useMemo } from 'react';
import { MemoizedMarkdown } from './MemoizedMarkdown';
import { ThinkingBar } from '@/components/chat/ThinkingBar';
import { MessageStreamParser } from '@/lib/chat/streaming/MessageStreamParser';
import { Brain, Loader2 } from 'lucide-react';

interface AIMessageBlockProps {
  content: string;
  isStreaming: boolean;
  thinkingDuration?: number;
  onStreamingComplete?: (duration: number) => void;
}

export function AIMessageBlock({
  content,
  isStreaming,
  thinkingDuration,
  onStreamingComplete
}: AIMessageBlockProps) {
  const [streamedState, setStreamedState] = useState<null | {
    thinkingContent: string;
    regularContent: string;
    isThinking: boolean;
    elapsedTime: number;
    isFinished: boolean;
  }>(null);
  const parserRef = useRef(new MessageStreamParser());
  const prevContentLength = useRef(0);
  const prevIsStreaming = useRef(isStreaming);
  const onStreamingCompleteRef = useRef(onStreamingComplete);
  
  // 重置解析器状态
  useEffect(() => {
    if (!isStreaming && prevIsStreaming.current) {
      // 流式结束，重置解析器
      parserRef.current.reset();
      prevContentLength.current = 0;
    }
    prevIsStreaming.current = isStreaming;
  }, [isStreaming]);

  // 处理流式结束时的回调
  useEffect(() => {
    if (!isStreaming && prevIsStreaming.current) {
      // 流式意外结束，强制停止计时器
      if (streamedState && !streamedState.isFinished) {
        parserRef.current.forceStop();
        
        // 确保调用完成回调，将毫秒转换为秒
        if (onStreamingCompleteRef.current) {
          onStreamingCompleteRef.current(Math.floor(streamedState.elapsedTime / 1000));
        }
      }
    }
  }, [isStreaming, streamedState]);
  
  // 更新ref的值
  useEffect(() => {
    onStreamingCompleteRef.current = onStreamingComplete;
  }, [onStreamingComplete]);

  // 检查内容是否包含think标签 - 只要检测到<think>就开始显示思考栏
  const hasThinkTags = useMemo(() => {
    return content.includes('<think>');
  }, [content]);

  useEffect(() => {
    // 如果内容不包含think标签，使用简化的纯文本处理
    if (!hasThinkTags) {
      if (isStreaming) {
        // 流式状态：直接使用当前内容作为regularContent
        setStreamedState(prevState => {
          // 只有当内容真正发生变化时才更新状态
          if (prevState?.regularContent !== content) {
            return {
              thinkingContent: '',
              regularContent: content,
              isThinking: false,
              elapsedTime: 0,
              isFinished: false
            };
          }
          return prevState;
        });
      } else {
        // 非流式状态：内容已完成
        setStreamedState(prevState => {
          // 只有当内容真正发生变化时才更新状态
          if (prevState?.regularContent !== content || !prevState?.isFinished) {
            return {
              thinkingContent: '',
              regularContent: content,
              isThinking: false,
              elapsedTime: 0,
              isFinished: true
            };
          }
          return prevState;
        });
      }
      return;
    }

    // 包含think标签的内容使用原有的MessageStreamParser逻辑
    if (!isStreaming) {
      if (prevIsStreaming.current) {
        // 处理仍未解析的最后一段文本，防止流尾内容丢失
        const remainingChunk = content.substring(prevContentLength.current);
        if (remainingChunk.length > 0) {
          parserRef.current.process(remainingChunk);
          prevContentLength.current = content.length;
        }

        const finalState = parserRef.current.process(null);
        setStreamedState(finalState);
        if (onStreamingCompleteRef.current && finalState.thinkingContent) {
          // 将毫秒转换为秒传递给回调
          onStreamingCompleteRef.current(Math.floor(finalState.elapsedTime / 1000));
        }
      }
      prevIsStreaming.current = false;
      return;
    }

    prevIsStreaming.current = true;
    const newChunk = content.substring(prevContentLength.current);
    const newState = parserRef.current.process(newChunk);
    setStreamedState(prevState => {
      // 使用浅比较替代JSON.stringify，提高性能
      if (!prevState || 
          prevState.thinkingContent !== newState.thinkingContent ||
          prevState.regularContent !== newState.regularContent ||
          prevState.isThinking !== newState.isThinking ||
          prevState.isFinished !== newState.isFinished) {
        return newState;
      }
      return prevState;
    });
    prevContentLength.current = content.length;
  }, [content, isStreaming, hasThinkTags]);

  const historicalState = useMemo(() => {
    if (isStreaming) return null;
    

    
    // 如果内容不包含think标签但有thinking_duration，说明是历史消息，需要显示思考栏
    if (!hasThinkTags && thinkingDuration && thinkingDuration > 0) {
      const result = {
        regularContent: content,
        thinkingContent: `思考时长：${thinkingDuration}秒`,
        elapsedTime: thinkingDuration * 1000, // 转换为毫秒
        isThinking: false,
        isFinished: true
      };

      return result;
    }
    
    // 如果内容不包含think标签，直接返回纯文本状态
    if (!hasThinkTags) {
      const result = {
        regularContent: content,
        thinkingContent: '',
        elapsedTime: 0,
        isThinking: false,
        isFinished: true
      };

      return result;
    }
    
    // 包含think标签的内容使用原有逻辑
    const thinkStart = content.indexOf('<think>');
    const thinkEnd = content.indexOf('</think>');
    
    // 如果只有开始标签，提取思考内容到结尾
    if (thinkStart !== -1 && thinkEnd === -1) {
      const thinkingContent = content.substring(thinkStart + 7);
      const regularContent = content.substring(0, thinkStart);
      const result = {
        regularContent,
        thinkingContent,
        elapsedTime: (thinkingDuration ?? 0) * 1000, // 转换为毫秒
        isThinking: false,
        isFinished: true
      };

      return result;
    }
    
    // 如果有完整的think标签
    if (thinkStart !== -1 && thinkEnd !== -1) {
      const thinkingContent = content.substring(thinkStart + 7, thinkEnd);
      // 确保正确处理换行符，避免内容丢失
      const regularContent = (content.substring(0, thinkStart) + content.substring(thinkEnd + 8)).trim();
      const result = {
        regularContent,
        thinkingContent,
        elapsedTime: (thinkingDuration ?? 0) * 1000, // 转换为毫秒
        isThinking: false,
        isFinished: true
      };

      return result;
    }
    
    // 如果没有think标签
    const result = {
      regularContent: content,
      thinkingContent: '',
      elapsedTime: 0,
      isThinking: false,
      isFinished: true
    };
    
    return result;
  }, [content, isStreaming, thinkingDuration, hasThinkTags]);

  const state = streamedState ?? historicalState;
  


  // 检查是否没有任何内容（初始加载状态）
  const hasNoContent = !content && isStreaming && (!state || (!state.thinkingContent && !state.regularContent));

  return (
    <div className="group prose prose-slate dark:prose-invert w-full max-w-full min-w-0 rounded-lg rounded-tl-sm bg-white dark:bg-slate-900/60 p-4 shadow-sm overflow-hidden">
      {/* 初始加载状态 - 当AI还没有任何响应时显示 */}
      {hasNoContent && (
        <div className="flex items-center gap-3 py-2">
          <div className="flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
          </div>
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400">等待模型响应...</span>
        </div>
      )}

      {/* 思考进度条 */}
      {state && state.thinkingContent && (
        <ThinkingBar
          thinkingContent={state.thinkingContent}
          isThinking={state.isThinking}
          elapsedTime={state.elapsedTime}
        />
      )}

      {/* 消息内容 */}
      {(state?.regularContent || (!hasNoContent && !isStreaming)) && (
        <div className="relative min-w-0 max-w-full w-full">
          <MemoizedMarkdown content={state?.regularContent || ''} />
          {/* 悬浮显示字数 */}
          {/* <div className="absolute -right-2 -top-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-[11px] text-gray-400 bg-gray-50/80 dark:bg-gray-800/60 backdrop-blur px-1.5 py-0.5 rounded select-none pointer-events-none">
            {(() => {
              const text = state?.regularContent || '';
              return `字数: ${text.replace(/\s+/g,'').length}`;
            })()}
          </div> */}
        </div>
      )}
    </div>
  );
} 