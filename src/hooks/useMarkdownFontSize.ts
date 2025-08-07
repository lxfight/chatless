import { useEffect, useState } from 'react';
import { storage } from '@/lib/storage';

export type MarkdownFontSize = 'small' | 'medium' | 'large';

const STORAGE_KEY = 'markdown_font_size';

/**
 * 自定义 Hook: 获取/设置 Markdown 字体大小偏好
 */
export function useMarkdownFontSize() {
  const [size, setSizeState] = useState<MarkdownFontSize>('medium');

  // 初始化：读取存储值
  useEffect(() => {
    (async () => {
      const stored = await storage.getItem(STORAGE_KEY);
      if (stored === 'small' || stored === 'medium' || stored === 'large') {
        setSizeState(stored);
      }
    })();
  }, []);

  // 更新偏好并写入存储
  const setSize = async (newSize: MarkdownFontSize) => {
    setSizeState(newSize);
    await storage.setItem(STORAGE_KEY, newSize);
  };

  return { size, setSize };
} 