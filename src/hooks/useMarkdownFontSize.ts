import { useEffect, useState } from 'react';
import { storage } from '@/lib/storage';

export type MarkdownFontSize = 'small' | 'medium' | 'large';

const STORAGE_KEY = 'markdown_font_size';

/**
 * 自定义 Hook: 获取/设置 Markdown 字体大小偏好
 */
// 会话级同步缓存，避免组件初次挂载时先用默认值再闪回用户配置，造成字号跳动
let cachedFontSize: MarkdownFontSize | null = null;

export function useMarkdownFontSize() {
  // 首次渲染用同步缓存或 <html data-md-size>，避免视觉跳动
  const initial: MarkdownFontSize = (() => {
    if (cachedFontSize) return cachedFontSize;
    try {
      if (typeof document !== 'undefined') {
        const ds = (document.documentElement as any)?.dataset?.mdSize;
        if (ds === 'small' || ds === 'medium' || ds === 'large') return ds;
      }
    } catch { /* noop */ }
    return 'medium';
  })();

  const [size, setSizeState] = useState<MarkdownFontSize>(initial);

  // 初始化：读取存储值
  useEffect(() => {
    (async () => {
      const stored = await storage.getItem(STORAGE_KEY);
      if (stored === 'small' || stored === 'medium' || stored === 'large') {
        cachedFontSize = stored;
        try { if (typeof document !== 'undefined') (document.documentElement as any).dataset.mdSize = stored; } catch { /* noop */ }
        setSizeState(stored);
      }
    })();
  }, []);

  // 更新偏好并写入存储
  const setSize = async (newSize: MarkdownFontSize) => {
    cachedFontSize = newSize;
    try { if (typeof document !== 'undefined') (document.documentElement as any).dataset.mdSize = newSize; } catch { /* noop */ }
    setSizeState(newSize);
    await storage.setItem(STORAGE_KEY, newSize);
  };

  return { size, setSize };
} 