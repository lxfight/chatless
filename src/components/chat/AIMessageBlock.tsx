"use client";

import { useEffect, useRef, useState, useMemo } from 'react';
import { MemoizedMarkdown } from './MemoizedMarkdown';
import { ThinkingBar } from '@/components/chat/ThinkingBar';
import { MessageStreamParser } from '@/lib/chat/streaming/MessageStreamParser';
import { Brain, Loader2 } from 'lucide-react';
import { ToolCallCard } from '@/components/chat/ToolCallCard';

interface AIMessageBlockProps {
  content: string;
  isStreaming: boolean;
  thinkingDuration?: number;
  onStreamingComplete?: (duration: number) => void;
  id?: string; // for inline retry in ToolCallCard
}

export function AIMessageBlock({
  content,
  isStreaming,
  thinkingDuration,
  onStreamingComplete,
  id
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

  // 提前解析 <tool_call>，或 JSON 格式的 {"type":"tool_call",...}
  const hasToolCallEarly = useMemo(() => content.includes('<tool_call>') || /"type"\s*:\s*"tool_call"/i.test(content), [content]);
  const earlyCardData = useMemo(() => {
    if (!hasToolCallEarly) return null;
    // 1) XML 包裹
    const mXml = content.match(/<tool_call>([\s\S]*?)<\/tool_call>/i);
    if (mXml && mXml[1]) {
      try {
        const obj = JSON.parse(mXml[1]);
        return { server: obj.server, tool: obj.tool, args: obj.parameters || obj.args || {} };
      } catch { /* ignore */ }
    }
    // 2) 代码块/纯文本 JSON
    try {
      // 尝试抓取最短含有 server/tool 的片段
      const mJson = content.match(/\{[\s\S]*?"type"\s*:\s*"tool_call"[\s\S]*?\}/i);
      if (mJson && mJson[0]) {
        const obj = JSON.parse(mJson[0]);
        return { server: obj.server || obj.mcp, tool: obj.tool || obj.tool_name, args: obj.parameters || obj.args || {} };
      }
    } catch { /* ignore */ }
    return null;
  }, [content, hasToolCallEarly]);

  // 提取已嵌入的卡片标记（可支持多次调用）
  const embeddedCards = useMemo(() => {
    const cards: Array<any> = [];
    const re = /\{\"__tool_call_card__\":\{[\s\S]*?\}\}/g;
    try {
      const all = content.match(re);
      if (all && all.length) {
        for (const s of all) {
          try { const obj = JSON.parse(s); if (obj && obj.__tool_call_card__) cards.push(obj.__tool_call_card__); } catch {}
        }
      }
    } catch {}
    return cards;
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

  // 将一条 AI 消息中的多种片段（普通文本、<think> 块、工具卡片）按出现顺序混合渲染，避免“消息粘连”
  const mixedSegments = useMemo(() => {
    const raw = String(state?.regularContent ?? content ?? '');
    const segments: Array<{ type: 'card'; data: any } | { type: 'think'; text: string } | { type: 'text'; text: string }> = [];
    if (!raw) return segments;

    // 1) 先按工具卡片标记切分
    const cardRe = /\{\"__tool_call_card__\":\{[\s\S]*?\}\}/g;
    let lastIndex = 0;
    const parts: Array<{ kind: 'text' | 'card'; value: string }> = [];
    for (const m of raw.matchAll(cardRe)) {
      const idx = m.index ?? 0;
      if (idx > lastIndex) parts.push({ kind: 'text', value: raw.slice(lastIndex, idx) });
      parts.push({ kind: 'card', value: m[0] });
      lastIndex = idx + m[0].length;
    }
    if (lastIndex < raw.length) parts.push({ kind: 'text', value: raw.slice(lastIndex) });

    // 2) 逐段处理：文本再按 <think>..</think> 切分；卡片直接解析
    const thinkRe = /<think>[\s\S]*?<\/think>/g;
    for (const p of parts) {
      if (p.kind === 'card') {
        try {
          const obj = JSON.parse(p.value);
          if (obj && obj.__tool_call_card__) segments.push({ type: 'card', data: obj.__tool_call_card__ });
        } catch {}
        continue;
      }
      const text = p.value;
      if (!text) continue;
      let tLast = 0;
      for (const m of text.matchAll(thinkRe)) {
        const i = m.index ?? 0;
        if (i > tLast) segments.push({ type: 'text', text: text.slice(tLast, i) });
        const block = m[0];
        const inner = block.replace(/^<think>/i, '').replace(/<\/think>$/i, '');
        segments.push({ type: 'think', text: inner });
        tLast = i + block.length;
      }
      if (tLast < text.length) segments.push({ type: 'text', text: text.slice(tLast) });
    }

    // 清理空白段，避免“粘连”
    return segments.filter(s => (s.type === 'text' ? s.text.trim().length > 0 : true));
  }, [content, state?.regularContent]);

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

      {/* 消息内容（混合片段顺序渲染） */}
      {(state?.regularContent || (!hasNoContent && !isStreaming)) && (
        <div className="relative min-w-0 max-w-full w-full">
          {mixedSegments.length > 0 ? (
            <div className="flex flex-col gap-2">
              {mixedSegments.map((seg, idx) => {
                if (seg.type === 'card') {
                  const d = seg.data;
                  return (
                    <ToolCallCard
                      key={d.id || idx}
                      server={d.server}
                      tool={d.tool}
                      status={d.status}
                      args={d.args}
                      resultPreview={d.resultPreview}
                      errorMessage={d.errorMessage}
                      schemaHint={d.schemaHint}
                      messageId={id}
                    />
                  );
                }
                if (seg.type === 'think') {
                  // 仅在非流式阶段把历史中的多段思考内容展开为多个思考栏
                  if (!isStreaming) {
                    return (
                      <ThinkingBar
                        key={`think-${idx}`}
                        thinkingContent={seg.text}
                        isThinking={false}
                        elapsedTime={0}
                      />
                    );
                  }
                  return null;
                }
                return <MemoizedMarkdown key={`md-${idx}`} content={seg.text} />;
              })}
              {/* 流式阶段：若尚未写入卡片标记，但已提前探测到工具调用，则给出“调用中”占位 */}
              {mixedSegments.every(s => s.type !== 'card') && earlyCardData && isStreaming && (
                <ToolCallCard server={earlyCardData.server} tool={earlyCardData.tool} status={'running'} args={earlyCardData.args} messageId={id} />
              )}
            </div>
          ) : (
            // 回退：纯文本
            <MemoizedMarkdown content={state?.regularContent || ''} />
          )}
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