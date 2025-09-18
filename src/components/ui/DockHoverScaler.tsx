import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';

type Orientation = 'vertical' | 'horizontal';

type DockHoverScalerProps = {
  children: React.ReactNode;
  orientation?: Orientation;
  maxScale?: number;
  influenceRadius?: number;
  threshold?: number;
  transitionMs?: number;
  className?: string;
  style?: React.CSSProperties;
  itemClassName?: string;
  itemStyle?: React.CSSProperties;
  itemTag?: 'div' | 'span' | 'li' | 'a' | 'button' | 'p' | 'section' | 'article' | 'nav' | 'aside';
  recomputeOnResize?: boolean;
  recomputeOnScroll?: boolean;
};

export function DockHoverScaler({
  children,
  orientation = 'vertical',
  maxScale = 1.4,
  influenceRadius = 120,
  threshold = 0.02,
  transitionMs = 150,
  className,
  style,
  itemClassName,
  itemStyle,
  itemTag = 'span',
  recomputeOnResize = true,
  recomputeOnScroll = true,
}: DockHoverScalerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);
  const centersRef = useRef<number[]>([]);
  const tickingRef = useRef(false);
  const prevScalesRef = useRef<number[]>([]);

  const childArray = useMemo(() => React.Children.toArray(children), [children]);

  const setItemRef =
    (index: number) =>
    (el: HTMLElement | null) => {
      itemRefs.current[index] = el;
    };

  const computeCenters = () => {
    const container = containerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const scrollX = container.scrollLeft;
    const scrollY = container.scrollTop;

    centersRef.current = itemRefs.current.map((el) => {
      if (!el) return 0;
      const r = el.getBoundingClientRect();
      if (orientation === 'vertical') {
        return r.top - containerRect.top + scrollY + r.height / 2;
      }
      return r.left - containerRect.left + scrollX + r.width / 2;
    });
  };

  const resetScales = () => {
    itemRefs.current.forEach((el, i) => {
      if (!el) return;
      el.style.transform = 'scale(1)';
      prevScalesRef.current[i] = 1;
    });
  };

  useLayoutEffect(() => {
    computeCenters();
    prevScalesRef.current = itemRefs.current.map(() => 1);

    let ro: ResizeObserver | null = null;
    if ('ResizeObserver' in window) {
      ro = new ResizeObserver(() => computeCenters());
      if (containerRef.current) ro.observe(containerRef.current as Element);
      itemRefs.current.forEach((el) => el && ro?.observe(el));
    }

    return () => {
      ro?.disconnect();
    };
  }, [childArray.length, orientation]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onMouseMove = (e: MouseEvent) => {
      if (tickingRef.current) return;
      tickingRef.current = true;

      requestAnimationFrame(() => {
        const rect = container.getBoundingClientRect();
        const pos = orientation === 'vertical'
          ? e.clientY - rect.top + container.scrollTop
          : e.clientX - rect.left + container.scrollLeft;

        const centers = centersRef.current;
        const items = itemRefs.current;

        for (let i = 0; i < items.length; i++) {
          const el = items[i];
          if (!el) continue;

          const dist = Math.abs(pos - centers[i]);
          const scale = Math.max(1, maxScale - dist / influenceRadius);

          const prev = prevScalesRef.current[i] ?? 1;
          if (Math.abs(scale - prev) > threshold) {
            el.style.transform = `scale(${scale})`;
            prevScalesRef.current[i] = scale;
          }
        }
        tickingRef.current = false;
      });
    };

    const onMouseLeave = () => {
      resetScales();
    };

    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mouseleave', onMouseLeave);

    const onResize = () => recomputeOnResize && computeCenters();
    const onScroll = () => recomputeOnScroll && computeCenters();

    if (recomputeOnResize) window.addEventListener('resize', onResize);
    if (recomputeOnScroll) container.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('mouseleave', onMouseLeave);
      if (recomputeOnResize) window.removeEventListener('resize', onResize);
      if (recomputeOnScroll) container.removeEventListener('scroll', onScroll as any);
    };
  }, [orientation, maxScale, influenceRadius, threshold, recomputeOnResize, recomputeOnScroll]);

  const ItemTag = itemTag as any;

  return (
    <div
      ref={containerRef}
      className={className}
      style={style}
    >
      {childArray.map((child, i) => (
        <ItemTag
          key={(child as any)?.key ?? i}
          ref={setItemRef(i)}
          className={itemClassName}
          style={{
            display: 'inline-block',
            transform: 'scale(1)',
            transition: `transform ${transitionMs}ms ease`,
            willChange: 'transform',
            ...itemStyle,
          }}
        >
          {child}
        </ItemTag>
      ))}
    </div>
  );
}


