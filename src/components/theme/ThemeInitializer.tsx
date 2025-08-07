"use client";

import { useEffect } from 'react';
import { initializeThemeOnStartup } from '@/lib/utils/themeInitializer';

/**
 * 客户端主题初始化组件
 * 在客户端渲染时立即应用主题设置，避免SSR不匹配问题
 */
export function ThemeInitializer() {
  useEffect(() => {
    // 在客户端渲染时立即初始化主题
    initializeThemeOnStartup();
  }, []);

  // 这个组件不渲染任何内容，只负责初始化主题
  return null;
} 