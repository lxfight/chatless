import React, { useState, useRef, useEffect, useMemo } from 'react';
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { UserIcon, BotIcon, ClockIcon } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  model?: string;
}

interface ChatNavigatorProps {
  messages: Message[];
  onNavigateToMessage: (messageId: string) => void;
  currentScrollPosition?: number;
  totalScrollHeight?: number;
  className?: string;
}

export function ChatNavigator({ 
  messages, 
  onNavigateToMessage, 
  currentScrollPosition = 0,
  totalScrollHeight = 0,
  className 
}: ChatNavigatorProps) {
  const [hoveredMessage, setHoveredMessage] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const navigatorRef = useRef<HTMLDivElement>(null);

  // 计算每条消息在缩略图中的位置
  const messagePositions = useMemo(() => {
    return messages.map((message, index) => ({
      ...message,
      position: (index / Math.max(messages.length - 1, 1)) * 100,
      index
    }));
  }, [messages]);

  // 计算当前滚动位置的百分比
  const scrollPercentage = useMemo(() => {
    if (totalScrollHeight <= 0) return 0;
    return Math.min((currentScrollPosition / totalScrollHeight) * 100, 100);
  }, [currentScrollPosition, totalScrollHeight]);

  // 自动显示/隐藏导航器 - 降低门槛到5条消息
  useEffect(() => {
    const shouldShow = messages.length >= 5;
    console.log(`[ChatNavigator] 消息数量: ${messages.length}, 是否显示: ${shouldShow}`);
    setIsVisible(shouldShow);
  }, [messages.length]);

  // 处理点击导航到指定消息
  const handleMessageClick = (messageId: string, event: React.MouseEvent) => {
    event.preventDefault();
    console.log(`[ChatNavigator] 导航到消息: ${messageId}`);
    onNavigateToMessage(messageId);
  };

  // 获取消息预览文本
  const getMessagePreview = (content: string) => {
    return content.length > 100 ? content.substring(0, 100) + '...' : content;
  };

  // 获取消息类型的颜色
  const getMessageColor = (role: string) => {
    return role === 'user' 
      ? 'bg-blue-500 hover:bg-blue-600' 
      : 'bg-green-500 hover:bg-green-600';
  };

  // 添加调试信息
  console.log(`[ChatNavigator] isVisible: ${isVisible}, messages: ${messages.length}`);

  if (!isVisible || messages.length === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <div 
        ref={navigatorRef}
        className={cn(
          "fixed right-4 top-1/2 -translate-y-1/2 w-3 h-96 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-lg shadow-sm z-50",
          "block", // 移除xl:block限制，在所有屏幕上都显示
          className
        )}
        style={{ top: 'calc(50% + 20px)' }} // 稍微往下移动20px
      >
        {/* 滚动位置指示器 */}
        <div className="relative w-full h-full p-1">
          {/* 背景轨道 */}
          <div className="absolute inset-1 bg-gray-100 rounded opacity-50" />
          
          {/* 当前滚动位置指示器 */}
          <div 
            className="absolute left-0.5 w-1.5 h-3 bg-blue-500 rounded opacity-60 transition-all duration-200"
            style={{ top: `${Math.max(4, Math.min(scrollPercentage * 0.95, 95))}%` }}
          />
          
          {/* 消息指示点 */}
          <div className="relative w-full h-full">
            {messagePositions.map((message) => (
              <Tooltip key={message.id}>
                <TooltipTrigger asChild>
                  <button
                    className={cn(
                      "absolute left-0.5 w-2.5 h-1.5 rounded-sm transition-all duration-200 transform hover:scale-125",
                      getMessageColor(message.role),
                      hoveredMessage === message.id && "scale-125 ring-2 ring-primary/50"
                    )}
                    style={{ 
                      top: `${message.position}%`,
                      transform: 'translateY(-50%)'
                    }}
                    onClick={(e) => handleMessageClick(message.id, e)}
                    onMouseEnter={() => setHoveredMessage(message.id)}
                    onMouseLeave={() => setHoveredMessage(null)}
                  />
                </TooltipTrigger>
                <TooltipContent 
                  side="left" 
                  align="center"
                  className="max-w-80 p-3"
                  sideOffset={10}
                >
                  <div className="space-y-2">
                    {/* 消息头部信息 */}
                    <div className="flex items-center gap-2 text-xs">
                      {message.role === 'user' ? (
                        <UserIcon className="w-3 h-3 text-blue-500" />
                      ) : (
                        <BotIcon className="w-3 h-3 text-green-500" />
                      )}
                      <span className="font-medium">
                        {message.role === 'user' ? '用户' : 'AI助手'}
                      </span>
                      {message.model && (
                        <span className="text-muted-foreground">
                          ({message.model})
                        </span>
                      )}
                    </div>
                    
                    {/* 消息内容预览 */}
                    <div className="text-sm text-foreground">
                      {getMessagePreview(message.content)}
                    </div>
                    
                    {/* 时间信息 */}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ClockIcon className="w-3 h-3" />
                      <span>
                        {formatDistanceToNow(new Date(message.createdAt), { 
                          addSuffix: true, 
                          locale: zhCN 
                        })}
                      </span>
                    </div>
                    
                    {/* 位置信息 */}
                    <div className="text-xs text-muted-foreground border-t pt-1">
                      消息 {message.index + 1} / {messages.length}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
        
        {/* 导航器标签 */}
        <div className="absolute -left-1.5 top-0 -translate-y-1/2">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-1.5 h-6 bg-primary rounded-l text-primary-foreground flex items-center justify-center">
                <div className="w-0.5 h-3 bg-primary-foreground rounded" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>聊天导航</p>
              <p className="text-xs text-muted-foreground">
                点击快速跳转到指定消息
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
} 