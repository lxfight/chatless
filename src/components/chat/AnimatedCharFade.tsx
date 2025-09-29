"use client";

import React, { useEffect, useRef } from "react";
import { useUiPreferences } from '@/store/uiPreferences';

interface AnimatedCharFadeProps {
  text: string;
  className?: string;
  disabled?: boolean; // 关闭动画时回退为一次性渲染
}

/**
 * AnimatedCharFade
 * - 高性能逐字淡入：使用 DocumentFragment 批量创建并一次性插入 DOM
 * - 仅在 text 增长时追加新字符，避免全量重绘
 * - 只在客户端生效；SSR 阶段渲染为空，由上层保证使用时机
 */
export function AnimatedCharFade({ text, className, disabled }: AnimatedCharFadeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastLenRef = useRef<number>(0);
  const intensity = useUiPreferences((s)=> s.charFadeIntensity);

  // 当文本长度减少（例如重新开始渲染）时，清空容器
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (disabled) {
      el.textContent = text;
      lastLenRef.current = text.length;
      return;
    }

    if (text.length < lastLenRef.current) {
      el.innerHTML = "";
      lastLenRef.current = 0;
    }

    // 仅处理新增的部分
    const start = lastLenRef.current;
    const slice = text.slice(start);
    if (!slice) return;

    const fragment = document.createDocumentFragment();
    const createdSpans: HTMLSpanElement[] = [];

    const lines = slice.split("\n");
    lines.forEach((line, idx) => {
      for (const ch of line) {
        const span = document.createElement("span");
        span.className = "cl-char"; // 初始透明
        span.innerHTML = ch === " " ? "&nbsp;" : ch;
        createdSpans.push(span);
        fragment.appendChild(span);
      }
      if (idx < lines.length - 1) fragment.appendChild(document.createElement("br"));
    });

    el.appendChild(fragment);

    // 在微任务中启动动画（确保浏览器完成插入后再触发）
    Promise.resolve().then(() => {
      const cls = intensity === 'off' ? '' : intensity === 'light' ? 'cl-run cl-light' : intensity === 'strong' ? 'cl-run cl-strong' : 'cl-run';
      for (const s of createdSpans) if (cls) s.className += ' ' + cls;
    });

    lastLenRef.current = text.length;
  }, [text, disabled]);

  return <div ref={containerRef} className={className} />;
}

export default AnimatedCharFade;


