"use client";

import { useEffect, useState, useMemo } from 'react';
import type { Message as MessageType } from '@/types/chat';
import { parseMessageContent, parseMessageWithThinking } from '@/lib/utils/messageParser';
import { ThinkingBar } from './ThinkingBar';
import { MemoizedMarkdown } from './MemoizedMarkdown';
import { messageParseCache } from '@/lib/chat/MessageParseCache';
import { cn } from '@/lib/utils';

interface ExtendedParsed {
  hasThinking: boolean;
  thinkingContent: string;
  responseContent: string;
  isThinkingComplete: boolean;
  // 兼容 legacy 字段，避免其他地方直接使用
  nonCodeParts?: string[];
  codeParts?: any[];
}

interface MessageProps {
  message: MessageType;
  className?: string;
}

export function Message({ message, className }: MessageProps) {
  // 使用缓存的消息解析结果，优先处理think标签
  const parsedMessage = useMemo(() => {
    return messageParseCache.get(message.content, (content) => {
      // 首先检查是否包含think标签（只要检测到<think>就开始显示思考栏）
      if (content.includes('<think>')) {
        const parsed = parseMessageWithThinking(content);
        return parsed;
      }
      
      // 如果没有think标签但有thinking_duration，说明是历史消息，需要显示思考栏
      if (message.thinking_duration && message.thinking_duration > 0) {
        return {
          hasThinking: true,
          thinkingContent: `思考时长：${message.thinking_duration}秒`,
          responseContent: content,
          isThinkingComplete: true,
        };
      }
      
      // 如果没有think标签，使用原有的代码块解析
      const legacyParsed = parseMessageContent(content);
      return {
        hasThinking: false,
        thinkingContent: "",
        responseContent: content,
        isThinkingComplete: true,
        nonCodeParts: legacyParsed.nonCodeParts,
        codeParts: legacyParsed.codeParts,
      };
    });
  }, [message.content, message.id, message.thinking_duration, message.role]);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {parsedMessage.hasThinking && (
        <ThinkingBar 
          thinkingContent={parsedMessage.thinkingContent}
          isActive={!parsedMessage.isThinkingComplete}
          durationSeconds={message.thinking_duration || 0}
        />
      )}
      {parsedMessage.responseContent && (
        <MemoizedMarkdown
          content={parsedMessage.responseContent}
          className={cn(
            "prose prose-sm max-w-none dark:prose-invert",
            message.role === "assistant" ? "prose-blue" : "prose-neutral"
          )}
        />
      )}
    </div>
  );
} 