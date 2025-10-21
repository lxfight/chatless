"use client";

import { useState, useEffect } from 'react';
import { storage } from '@/lib/storage';

export type MarkdownTheme = 'swiss' | 'minimal' | 'modern' | 'classic' | 'github';

const STORAGE_KEY = 'markdown_theme';

// 会话级同步缓存，避免初次渲染闪烁
let cachedTheme: MarkdownTheme | null = null;

/**
 * Markdown主题配置Hook
 * 提供多种渲染风格，默认使用瑞士简约风格
 */
export function useMarkdownTheme() {
  // 首次渲染用同步缓存或 document attribute，避免视觉跳动
  const initial: MarkdownTheme = (() => {
    if (cachedTheme) return cachedTheme;
    try {
      if (typeof document !== 'undefined') {
        const ds = (document.documentElement as any)?.dataset?.mdTheme;
        if (ds === 'swiss' || ds === 'minimal' || ds === 'modern' || ds === 'classic' || ds === 'github') {
          return ds;
        }
      }
    } catch { /* noop */ }
    return 'swiss'; // 默认瑞士简约风格
  })();

  const [theme, setThemeState] = useState<MarkdownTheme>(initial);

  // 初始化：读取存储值
  useEffect(() => {
    (async () => {
      const stored = await storage.getItem(STORAGE_KEY);
      if (stored === 'swiss' || stored === 'minimal' || stored === 'modern' || stored === 'classic' || stored === 'github') {
        cachedTheme = stored;
        try { 
          if (typeof document !== 'undefined') {
            (document.documentElement as any).dataset.mdTheme = stored;
          }
        } catch { /* noop */ }
        setThemeState(stored);
      }
    })();
  }, []);

  // 更新主题并写入存储
  const setTheme = async (newTheme: MarkdownTheme) => {
    cachedTheme = newTheme;
    try { 
      if (typeof document !== 'undefined') {
        (document.documentElement as any).dataset.mdTheme = newTheme;
      }
    } catch { /* noop */ }
    setThemeState(newTheme);
    await storage.setItem(STORAGE_KEY, newTheme);
  };

  return { theme, setTheme };
}

/**
 * 主题元数据
 */
export const MARKDOWN_THEMES = {
  swiss: {
    name: '瑞士简约',
    description: '优雅简洁，注重排版与留白',
    icon: '🇨🇭'
  },
  minimal: {
    name: '极简主义',
    description: '最小化设计，专注内容本身',
    icon: '✨'
  },
  modern: {
    name: '现代简洁',
    description: '现代感设计，清晰易读',
    icon: '🎨'
  },
  classic: {
    name: '经典书籍',
    description: '传统书籍排版风格',
    icon: '📖'
  },
  github: {
    name: 'GitHub风格',
    description: 'GitHub Markdown样式',
    icon: '🐙'
  }
} as const;

