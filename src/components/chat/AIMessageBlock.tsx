"use client";

import { useEffect, useRef, useState, useMemo } from 'react';
import { MemoizedMarkdown } from './MemoizedMarkdown';
import { ThinkingBar } from '@/components/chat/ThinkingBar';
// MessageStreamParser 已移除
import FoldingLoader from '../ui/FoldingLoader';
import { ToolCallCard } from '@/components/chat/ToolCallCard';

interface AIMessageBlockProps {
  content: string;
  isStreaming: boolean;
  thinkingDuration?: number;
  thinking_start_time?: number; // 思考开始时间戳（毫秒）
  onStreamingComplete?: (duration: number) => void;
  id?: string; // for inline retry in ToolCallCard
  // 优先渲染结构化段（阶段B最小适配）
  segments?: Array<
    | { kind: 'text'; text: string }
    | { kind: 'think'; text: string }
    | { kind: 'toolCard'; id: string; server: string; tool: string; args?: Record<string, unknown>; status: 'running' | 'success' | 'error'; resultPreview?: string; errorMessage?: string; schemaHint?: string; messageId: string }
  >;
  // 只读视图模型（优先级最高）
  viewModel?: {
    items: Array<any>;
    flags: { isThinking: boolean; isComplete: boolean; hasToolCalls: boolean };
  };
}

export function AIMessageBlock({
  content,
  isStreaming,
  thinkingDuration,
  thinking_start_time,
  onStreamingComplete,
  id,
  segments,
  viewModel
}: AIMessageBlockProps) {
  const [streamedState, _setStreamedState] = useState<null | {
    thinkingContent: string;
    regularContent: string;
    isThinking: boolean;
    elapsedTime: number;
    isFinished: boolean;
  }>(null);
  // 历史解析器已废弃：不再使用 MessageStreamParser，渲染完全依赖 segments。
  // const parserRef = useRef(new MessageStreamParser());
  const prevContentLength = useRef(0);
  const prevIsStreaming = useRef(isStreaming);
  const onStreamingCompleteRef = useRef(onStreamingComplete);
  
  // 统一跟踪状态变化，避免双 effect 竞争造成误触发
  useEffect(() => {
    const wasStreaming = prevIsStreaming.current;
    prevIsStreaming.current = isStreaming;
    if (wasStreaming && !isStreaming) {
      // 刚从流式结束
      prevContentLength.current = 0;
      if (streamedState && !streamedState.isFinished) {
        onStreamingCompleteRef.current?.(Math.floor(streamedState.elapsedTime / 1000));
      }
    }
  }, [isStreaming, streamedState]);
  
  // 更新ref的值
  useEffect(() => {
    onStreamingCompleteRef.current = onStreamingComplete;
  }, [onStreamingComplete]);

  // 检查内容是否包含think标签 - 只要检测到<think>就开始显示思考栏
  const hasThinkTags = useMemo(() => content.includes('<think>'), [content]);

      // 提前解析工具调用格式：<use_mcp_tool>（推荐）或 <tool_call>（兼容）或 JSON 格式的 {"type":"tool_call",...}
  const hasToolCallEarly = useMemo(() => content.includes('<tool_call>') || /"type"\s*:\s*"tool_call"/i.test(content), [content]);
  useMemo(() => {
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
  useMemo(() => {
    // 渲染阶段统一在 mixedSegments 内处理
    return null;
  }, [content]);

  // 已去除非必要的状态写入，避免在流式阶段造成更新环

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

  // 计算实时经过的时间
  const realTimeElapsed = useMemo(() => {
    // 如果正在流式处理且有thinking_start_time，基于实际时间计算
    if (isStreaming && thinking_start_time) {
      return Date.now() - thinking_start_time;
    }
    // 如果有thinkingDuration，使用已计算好的时间
    if (thinkingDuration && thinkingDuration > 0) {
      return thinkingDuration * 1000; // 转换为毫秒
    }
    return 0;
  }, [isStreaming, thinking_start_time, thinkingDuration]);

  const state = streamedState ?? historicalState;
  


  // 检查是否没有任何内容（初始加载状态）—— segments 路径下以 segments 是否为空为准
  const hasNoContent = isStreaming && (!Array.isArray(segments) || segments.length === 0) && !content;

  // 从 segments 中提取思考内容，替代旧的 MessageStreamParser 机制
  const thinkTextFromSegments = useMemo(() => {
    const src: any[] = Array.isArray(viewModel?.items) ? (viewModel?.items) : (Array.isArray(segments) ? (segments as any[]) : []);
    let acc = '';
    for (const s of src) {
      // s 为 any，直接访问
      if (s && s.kind === 'think') acc += String(s.text || '');
    }
    return acc;
  }, [segments, viewModel?.items]);

  // 将一条 AI 消息中的多种片段（普通文本、<think> 块、工具卡片）按出现顺序混合渲染，避免“消息粘连”
  const mixedSegments = useMemo(() => {
    const src: any[] = Array.isArray(viewModel?.items) ? (viewModel?.items) : (Array.isArray(segments) ? (segments as any[]) : []);
    if (Array.isArray(src) && src.length > 0) {
      const list: Array<{ type: 'card'|'think'|'text'; text?: string; data?: any }> = [];
      for (const s of src) {
        if (s && s.kind === 'toolCard') list.push({ type: 'card', data: s });
        else if (s && s.kind === 'think') list.push({ type: 'think', text: s.text || '' });
        else if (s && s.kind === 'text') list.push({ type: 'text', text: s.text || '' });
      }
      // 调试开关，默认关闭
      const DEBUG_MIXED = false;
      if (DEBUG_MIXED) {
        try { console.log('[UI:mixedSegments]', { id, total: list.length, cards: list.filter(s=>s.type==='card').length, thinks: list.filter(s=>s.type==='think').length, texts: list.filter(s=>s.type==='text').length }); } catch { /* noop */ }
      }
      return list;
    }
    return [];
  }, [content, segments, state?.regularContent, viewModel?.items]);

  return (
    <div className="group prose prose-slate dark:prose-invert w-full max-w-full min-w-0 rounded-lg rounded-tl-sm bg-white dark:bg-slate-900/60 p-2 shadow-sm">
   
      {/* 初始加载状态 - 当AI还没有任何响应时显示 */}
      {hasNoContent && (
        <div className="flex items-center gap-3 py-2">
          <div className="flex items-center gap-2">
            <FoldingLoader size={22} />
          </div>
          <span className="text-xs italic text-slate-500 dark:text-slate-400">等待响应...</span>
        </div>
      )}

      {/* 思考进度条：始终独立显示，不与正文混排 */}
      {( (!!viewModel && viewModel.flags?.isThinking) || (!!thinkTextFromSegments) || (!!state && !!state.thinkingContent)) && (
        <ThinkingBar
          thinkingContent={thinkTextFromSegments || state?.thinkingContent || ''}
          // 仅在“流式进行中”或显式标记为思考中时显示进行态；
          // 非流式/历史消息即使包含 think 文本，也视为已完成（绿色）。
          isThinking={ (viewModel?.flags?.isThinking !== undefined) ? !!viewModel?.flags?.isThinking : !!isStreaming }
          elapsedTime={realTimeElapsed}
        />
      )}

      {/* 消息内容（混合片段顺序渲染） */}
      {(mixedSegments.length > 0) && (
        <div className="relative min-w-0 max-w-full w-full">
          {mixedSegments.length > 0 ? (
            <div className="flex flex-col gap-2">
              {mixedSegments.map((seg, idx) => {
                // 关键调试：仅当准备渲染工具卡片时打印一次，帮助确认UI层已收到segments
                // 默认关闭的日志
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
                    />
                  );
                }
                // 不在正文中渲染 think 段，思考内容统一由上方思考栏呈现
                if (seg.type === 'think') return null;
                const prevType = idx > 0 ? mixedSegments[idx - 1]?.type : null;
                const needSoftDivider = prevType === 'card';
                return (
                  <div key={`md-wrap-${idx}`} className={needSoftDivider ? 'pt-2 border-t border-dashed border-slate-200/60 dark:border-slate-700/60' : undefined}>
                    {/* 逐字平滑淡入：仅在流式期间启用，降低不必要的动画开销 */}
                    <div className={isStreaming ? 'animate-[fadeInChar_20ms_linear_1_forwards] [--char-delay:14ms]' : undefined}>
                      <MemoizedMarkdown key={`md-${idx}`} content={seg.text || ''} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
          {/* 思考结束到卡片出现的过渡期占位：当仍在流式但暂无任何片段时显示 */}
          {isStreaming && !hasNoContent && mixedSegments.length === 0 && (
            <div className="flex items-center gap-3 py-2">
              <div className="flex items-center gap-2">
                <FoldingLoader size={22} />
              </div>
              <span className="text-xs italic text-slate-500 dark:text-slate-400">正在准备工具调用…</span>
            </div>
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

      {/* 当没有任何结构化片段时，回退为渲染纯正文（兼容非流式RAG或历史消息） */}
      {(mixedSegments.length === 0) && !!(state?.regularContent || content) && (
        <div className="relative min-w-0 max-w-full w-full">
          <MemoizedMarkdown content={(state?.regularContent || content)} />
        </div>
      )}
    </div>
  );
} 