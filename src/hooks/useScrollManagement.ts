import { useState, useRef, useCallback, useEffect } from 'react';

// 优化后的滚动阈值 - 为流式期间查看历史消息优化
const SCROLL_BOTTOM_THRESHOLD = 150; // 接近底部的判定距离
const USER_SCROLL_TIMEOUT = 1500; // 用户停止滚动后的超时时间（加长，避免误判）

export const useScrollManagement = (
    messagesContainerRef: React.RefObject<HTMLDivElement | null>, 
    messages: any[] | undefined,
    currentConversationId: string | null,
    _isLoading: boolean
) => {
  const messageRefs = useRef<{ [key: string]: HTMLDivElement }>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [_isUserScrolling, setIsUserScrolling] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [hasNewMessageWhileAway, setHasNewMessageWhileAway] = useState(false); // 查看历史时有新消息
  
  const userScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollTopRef = useRef(0);
  const previousConversationIdRef = useRef<string | null>(null);
  const isManualScrollRef = useRef(false); // 标记是否是用户主动滚动
  const lastMessageCountRef = useRef(0); // 记录上次消息数量

  const isNearBottom = useCallback((container: HTMLElement) => {
    const { scrollTop, scrollHeight, clientHeight } = container;
    return scrollHeight - scrollTop - clientHeight <= SCROLL_BOTTOM_THRESHOLD;
  }, []);

  // 智能自动滚动：只在用户没有主动向上滚动时才跟随新消息
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const isNewConversation = previousConversationIdRef.current !== currentConversationId;
    const messageCount = messages?.length || 0;
    const hasNewMessage = messageCount > lastMessageCountRef.current;

    // 更新消息计数
    lastMessageCountRef.current = messageCount;

    if (isNewConversation) {
      // 切换会话：重置状态
      setShouldAutoScroll(true);
      setIsUserScrolling(false);
      setShowScrollToBottom(false);
      setHasNewMessageWhileAway(false);
      isManualScrollRef.current = false;
      previousConversationIdRef.current = currentConversationId;
      return;
    }

    // 如果有新消息但用户正在查看历史，显示新消息指示器
    if (hasNewMessage && isManualScrollRef.current) {
      setHasNewMessageWhileAway(true);
    }

    // 关键改进：只有在用户明确在底部且没有主动向上滚动时才自动跟随
    // 这样即使在流式回复期间，用户向上滚动后也不会被拉回底部
    if (hasNewMessage && shouldAutoScroll && !isManualScrollRef.current) {
      // 使用 requestAnimationFrame 确保 DOM 更新后再滚动
      requestAnimationFrame(() => {
        // 双重检查：再次确认用户没有主动滚动且仍在底部
        if (container && !isManualScrollRef.current && isNearBottom(container)) {
          const target = container.scrollHeight - container.clientHeight;
          container.scrollTop = target;
        }
      });
    }

    previousConversationIdRef.current = currentConversationId;
  }, [messages, currentConversationId, shouldAutoScroll, messagesContainerRef, isNearBottom]);

  // 优化的滚动监听：更智能地检测用户意图
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const scrollDiff = scrollTop - lastScrollTopRef.current;
      const nearBottom = isNearBottom(container);
      
      // 更新"回到底部"按钮显示状态
      setShowScrollToBottom(!nearBottom);
      
      // 清除之前的超时
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current);
      }
      
      // 关键优化：降低触发阈值，更快响应用户的向上滚动
      if (Math.abs(scrollDiff) > 3) { // 从 8px 降低到 3px，更灵敏
        const isScrollingUp = scrollDiff < 0;
        
        // 用户向上滚动 -> 立即停止自动滚动（即使还接近底部）
        // 这是关键改进：不管是否在底部，只要向上滚动就停止跟随
        if (isScrollingUp) {
          isManualScrollRef.current = true;
          setIsUserScrolling(true);
          setShouldAutoScroll(false);
        }
        
        // 用户滚动到底部 -> 恢复自动滚动
        if (nearBottom && !isScrollingUp) {
          // 只有向下滚动到底部才恢复，向上滚动即使到底部也不恢复
          isManualScrollRef.current = false;
          setShouldAutoScroll(true);
          
          userScrollTimeoutRef.current = setTimeout(() => {
            setIsUserScrolling(false);
          }, 200);
        } else {
          // 不在底部时，设置超时清除滚动状态
          userScrollTimeoutRef.current = setTimeout(() => {
            setIsUserScrolling(false);
          }, USER_SCROLL_TIMEOUT);
        }
      }
      
      lastScrollTopRef.current = scrollTop;
    };

    // 鼠标滚轮事件：立即响应用户的滚动意图
    const handleWheel = (event: WheelEvent) => {
      const nearBottom = isNearBottom(container);
      
      // 向上滚动 -> 立即停止自动跟随（不管是否在底部）
      // 这确保用户在流式回复期间任何时候向上滚动都能立即生效
      if (event.deltaY < 0) {
        isManualScrollRef.current = true;
        setIsUserScrolling(true);
        setShouldAutoScroll(false);
      }
      
      // 向下滚动到底部 -> 恢复自动跟随
      if (event.deltaY > 0 && nearBottom) {
        isManualScrollRef.current = false;
        setShouldAutoScroll(true);
      }
    };

    // 触摸事件：移动端支持
    let touchStartY = 0;
    const handleTouchStart = (event: TouchEvent) => {
      touchStartY = event.touches[0].clientY;
    };

    const handleTouchMove = (event: TouchEvent) => {
      const touchY = event.touches[0].clientY;
      const diff = touchY - touchStartY;
      const nearBottom = isNearBottom(container);
      
      // 向上滑动（看历史）-> 立即停止自动跟随
      // 降低阈值，更快响应
      if (diff > 10) {
        isManualScrollRef.current = true;
        setShouldAutoScroll(false);
      }
      
      // 向下滑动到底部 -> 恢复自动跟随
      if (diff < -10 && nearBottom) {
        isManualScrollRef.current = false;
        setShouldAutoScroll(true);
      }
    };

    // 键盘事件：支持 PageUp/PageDown/方向键等
    const handleKeyDown = (event: KeyboardEvent) => {
      // 检查是否是滚动相关的按键
      const scrollKeys = ['PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
      if (scrollKeys.includes(event.key)) {
        const nearBottom = isNearBottom(container);
        
        // PageUp, ArrowUp, Home -> 向上滚动，停止自动跟随
        if (['PageUp', 'ArrowUp', 'Home'].includes(event.key)) {
          isManualScrollRef.current = true;
          setShouldAutoScroll(false);
        }
        
        // End 或向下到底部 -> 恢复自动跟随
        if (event.key === 'End' || (['PageDown', 'ArrowDown'].includes(event.key) && nearBottom)) {
          isManualScrollRef.current = false;
          setShouldAutoScroll(true);
        }
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    container.addEventListener('wheel', handleWheel, { passive: true });
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('keydown', handleKeyDown, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('keydown', handleKeyDown);
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current);
      }
    };
  }, [isNearBottom, messagesContainerRef]);

  const handleNavigateToMessage = useCallback((messageId: string) => {
    const messageElement = messageRefs.current[messageId];
    if (messageElement && messagesContainerRef.current) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [messagesContainerRef]);

  const handleScrollToTop = useCallback(() => {
    messagesContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [messagesContainerRef]);

  const handleScrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    // 重置手动滚动标记，恢复自动跟随
    isManualScrollRef.current = false;
    setShouldAutoScroll(true);
    setShowScrollToBottom(false);
    setHasNewMessageWhileAway(false); // 清除新消息提示
    
    // 平滑滚动到底部
    const target = container.scrollHeight - container.clientHeight;
    container.scrollTo({ top: target, behavior: 'smooth' });
  }, [messagesContainerRef]);

  const ensureBottomIfNear = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    if (isNearBottom(container)) {
      const target = container.scrollHeight - container.clientHeight;
      container.scrollTop = target;
    }
  }, [messagesContainerRef, isNearBottom]);

  return {
    messageRefs,
    messagesEndRef,
    handleNavigateToMessage,
    handleScrollToTop,
    handleScrollToBottom,
    ensureBottomIfNear,
    showScrollToBottom, // 导出按钮显示状态
    isAtBottom: !showScrollToBottom, // 是否在底部
    hasNewMessageWhileAway, // 查看历史时是否有新消息
    // 仅当用户未主动向上滚动且确实位于底部附近时，才允许 Virtuoso 跟随
    shouldFollowOutput: (!isManualScrollRef.current) && (!showScrollToBottom),
  };
}; 