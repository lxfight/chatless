import { useState, useRef, useCallback, useEffect } from 'react';

const SCROLL_BOTTOM_THRESHOLD = 50; 

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

  const isNearBottom = useCallback((container: HTMLElement) => {
    const { scrollTop, scrollHeight, clientHeight } = container;
    return scrollHeight - scrollTop - clientHeight <= SCROLL_BOTTOM_THRESHOLD;
  }, []);

  useEffect(() => {
    const isNewConversation = previousConversationIdRef.current !== currentConversationId;
    
    if (isNewConversation) {
      setShouldAutoScroll(true);
      setIsUserScrolling(false);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      }, 100);
    } else if (shouldAutoScroll && !isUserScrolling && isLoading) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    
    previousConversationIdRef.current = currentConversationId;
  }, [messages, currentConversationId, shouldAutoScroll, isUserScrolling, isLoading]);

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
    // 优先使用 scrollIntoView
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    
    // 备用方案：直接滚动容器到底部
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messagesContainerRef]);

  return {
    messageRefs,
    messagesEndRef,
    handleNavigateToMessage,
    handleScrollToTop,
    handleScrollToBottom
  };
}; 