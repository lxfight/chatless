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
      // 新会话首次定位到底部，无动画，防止突兀
      requestAnimationFrame(() => {
        endEl.scrollIntoView({ behavior: 'auto' });
      });
    } else if (shouldAutoScroll && !isUserScrolling && isLoading) {
      // 正在流式生成时，始终使用自定义“跟随到底部”动画（短距离也动画），避免瞬时跳变
      const container = messagesContainerRef.current;
      if (container) {
        // 根据个性化设置映射速度
        const base = scrollSpeed === 'calm' ? 650 : scrollSpeed === 'fast' ? 260 : 420;
        followStateRef.current.duration = base;
        // 个性化映射：越平缓速度上限越低、最小步长越小
        if (scrollSpeed === 'calm') { followStateRef.current.maxVel = 900; followStateRef.current.minMove = 0.8; }
        else if (scrollSpeed === 'fast') { followStateRef.current.maxVel = 1800; followStateRef.current.minMove = 1.2; }
        else { followStateRef.current.maxVel = 1300; followStateRef.current.minMove = 1; }
        const st = followStateRef.current;
        const target = container.scrollHeight - container.clientHeight;
        // 小距离直接对齐，避免轻微闪动
        if (Math.abs(target - container.scrollTop) <= st.minMove) {
          container.scrollTop = target;
          return;
        }
        if (!st.animating) {
          st.animating = true;
          st.from = container.scrollTop;
          st.start = performance.now();
          st.last = st.start;
          st.to = target;
          const ease = (t:number) => 1 - Math.pow(1 - t, 3); // easeOutCubic
          const step = (now:number) => {
            const p = Math.min(1, (now - st.start) / st.duration);
            const yWanted = st.from + (st.to - st.from) * ease(p);
            const current = container.scrollTop;
            const dt = Math.max(1, now - st.last); // ms
            const maxDelta = (st.maxVel * dt) / 1000; // px
            const rawDelta = yWanted - current;
            const delta = Math.abs(rawDelta) > maxDelta ? Math.sign(rawDelta) * maxDelta : rawDelta;
            container.scrollTop = current + delta;
            st.last = now;
            if (p < 1 && Math.abs(container.scrollTop - st.to) > 1) {
              st.raf = requestAnimationFrame(step);
            } else {
              container.scrollTop = st.to;
              st.animating = false;
              st.raf = null;
            }
          };
          st.raf = requestAnimationFrame(step);
        } else {
          // 动画进行中，刷新目标，让跟随更顺滑
          st.to = target;
        }
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
      container.scrollTo({ top: target, behavior: 'smooth' });
      return;
    }
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
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