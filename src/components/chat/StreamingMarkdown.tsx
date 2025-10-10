"use client";

import { useState, useEffect, useRef } from 'react';
import { MemoizedMarkdown } from './MemoizedMarkdown';

interface StreamingMarkdownProps {
  content: string;
  isStreaming: boolean;
  className?: string;
}

/**
 * 流式Markdown渲染组件
 * 在流式输出时也能实时渲染markdown，同时保持字符渐入效果
 */
export function StreamingMarkdown({ content, isStreaming, className }: StreamingMarkdownProps) {
  const [displayContent, setDisplayContent] = useState('');
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const currentIndexRef = useRef<number>(0);
  
  // 控制渲染频率，避免过度渲染
  const UPDATE_INTERVAL = 50; // 每50ms更新一次

  useEffect(() => {
    if (!isStreaming) {
      // 非流式状态，直接显示完整内容
      setDisplayContent(content);
      currentIndexRef.current = content.length;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    // 流式状态：渐进显示内容
    const targetLength = content.length;
    
    if (currentIndexRef.current < targetLength) {
      const animate = () => {
        const now = Date.now();
        if (now - lastUpdateTimeRef.current >= UPDATE_INTERVAL) {
          // 每次增加多个字符以提高性能
          const charsToAdd = Math.min(5, targetLength - currentIndexRef.current);
          currentIndexRef.current = Math.min(currentIndexRef.current + charsToAdd, targetLength);
          setDisplayContent(content.slice(0, currentIndexRef.current));
          lastUpdateTimeRef.current = now;
        }

        if (currentIndexRef.current < targetLength) {
          animationFrameRef.current = requestAnimationFrame(animate);
        }
      };

      animationFrameRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [content, isStreaming]);

  // 重置当前索引，当内容完全改变时
  useEffect(() => {
    if (content.length < currentIndexRef.current) {
      currentIndexRef.current = 0;
      setDisplayContent('');
    }
  }, [content]);

  return (
    <div className={className}>
      <MemoizedMarkdown 
        content={stabilizeStreamingMarkdown(displayContent)}
        className="animate-fadeIn"
      />
    </div>
  );
}

/**
 * 稳定化流式Markdown，处理未闭合的标记
 */
function stabilizeStreamingMarkdown(input: string): string {
  let output = input;

  // 处理未闭合的代码块
  const codeBlockMatches = output.match(/```/g);
  if (codeBlockMatches && codeBlockMatches.length % 2 !== 0) {
    // 有未闭合的代码块，添加临时闭合
    output += '\n```';
  }

  // 处理未闭合的行内代码
  const inlineCodeMatches = output.match(/(?<!\\)`/g);
  if (inlineCodeMatches && inlineCodeMatches.length % 2 !== 0) {
    // 有未闭合的行内代码，添加临时闭合
    output += '`';
  }

  // 处理未闭合的粗体
  const boldMatches = output.match(/(?<!\\)\*\*/g);
  if (boldMatches && boldMatches.length % 2 !== 0) {
    output += '**';
  }

  // 处理未闭合的斜体
  const italicMatches = output.match(/(?<!\\)\*/g);
  if (italicMatches && italicMatches.length % 2 !== 0) {
    output += '*';
  }

  // 处理未闭合的列表（确保有适当的换行）
  if (/^[*\-+]\s/.test(output.split('\n').pop() || '')) {
    // 最后一行是列表项但没有结束，暂时保持
  }

  return output;
}

