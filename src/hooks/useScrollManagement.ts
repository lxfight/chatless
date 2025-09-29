import { useState, useRef, useCallback, useEffect } from 'react';
import { useUiPreferences } from '@/store/uiPreferences';

// 放宽“接近底部”的阈值，减少来回切换造成的跳屏
// 提高阈值，确保滚动到底部后不会被底部信息条遮挡
const SCROLL_BOTTOM_THRESHOLD = 220; 

export const useScrollManagement = (
    messagesContainerRef: React.RefObject<HTMLDivElement | null>, 
    messages: any[] | undefined,
    currentConversationId: string | null,
    isLoading: boolean
) => {
  const messageRefs = useRef<{ [key: string]: HTMLDivElement }>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const userScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollTopRef = useRef(0);
  const previousConversationIdRef = useRef<string | null>(null);
  // 跟随底部动画状态
  const followStateRef = useRef<{
    raf: number | null;
    animating: boolean;
    start: number;
    from: number;
    to: number;
    duration: number;
    last: number;
    minMove: number; // 最小位移阈值（px）
    maxVel: number;  // 速度上限（px/s）
  }>({ raf: null, animating: false, start: 0, from: 0, to: 0, duration: 450, last: 0, minMove: 1.5, maxVel: 1200 });
  const scrollSpeed = useUiPreferences((s)=> s.chatScrollSpeed);

  const isNearBottom = useCallback((container: HTMLElement) => {
    const { scrollTop, scrollHeight, clientHeight } = container;
    return scrollHeight - scrollTop - clientHeight <= SCROLL_BOTTOM_THRESHOLD;
  }, []);

  useEffect(() => {
    const isNewConversation = previousConversationIdRef.current !== currentConversationId;
    const endEl = messagesEndRef.current;
    if (!endEl) {
      previousConversationIdRef.current = currentConversationId;
      return;
    }

    if (isNewConversation) {
      setShouldAutoScroll(true);
      setIsUserScrolling(false);
      // 初次进入会话：不自动滚动，由上层决定定位（如最后一条用户消息）
    } else if (shouldAutoScroll && !isUserScrolling && isLoading) {
      // 轻量策略：仅当用户已在底部附近时，才把视图对齐到底部；不做持续动画跟随
      const container = messagesContainerRef.current;
      if (container && isNearBottom(container)) {
        const target = container.scrollHeight - container.clientHeight;
        container.scrollTop = target; // 直接对齐，不使用平滑动画，减少视觉干扰
      }
    }
    previousConversationIdRef.current = currentConversationId;
  }, [messages, currentConversationId, shouldAutoScroll, isUserScrolling, isLoading, messagesContainerRef]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const isScrollingUp = scrollTop < lastScrollTopRef.current;
      const nearBottom = isNearBottom(container);
      
      if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current);
      
      if (Math.abs(scrollTop - lastScrollTopRef.current) > 5) {
        if (isScrollingUp && !nearBottom) {
          setIsUserScrolling(true);
          setShouldAutoScroll(false);
        }
        
        if (nearBottom && !shouldAutoScroll) {
          setShouldAutoScroll(true);
          setIsUserScrolling(false);
        }
      }
      
      userScrollTimeoutRef.current = setTimeout(() => setIsUserScrolling(false), 300);
      lastScrollTopRef.current = scrollTop;
    };

    const handleWheel = (event: WheelEvent) => {
      if (!isLoading) return;
      if (event.deltaY < 0 && !isNearBottom(container)) {
        setIsUserScrolling(true);
        setShouldAutoScroll(false);
      }
    };

    container.addEventListener('scroll', handleScroll);
    container.addEventListener('wheel', handleWheel, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
      container.removeEventListener('wheel', handleWheel);
      if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current);
    };
  }, [messages, isNearBottom, isLoading, messagesContainerRef]);

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
    // 目标位置：底部再上移一个安全距离，避免被底部工具栏/行内信息遮挡
    const SAFE_OFFSET = 28; // px
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      const target = Math.max(0, container.scrollHeight - container.clientHeight - SAFE_OFFSET);
      container.scrollTo({ top: target, behavior: 'auto' });
      return;
    }
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
    }
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
    ensureBottomIfNear
  };
}; 