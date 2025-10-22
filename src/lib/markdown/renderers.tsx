import type { ThemeStyles } from '@/lib/markdown/themes';

/**
 * Markdown渲染器
 * 
 * 当前状态：移除所有自定义样式，恢复Streamdown原生渲染
 * 参数保留以兼容现有代码，但不再应用主题样式
 */
export function createMarkdownRenderers(
  _size: 'small' | 'medium' | 'large',
  _themeStyles: ThemeStyles
): { renderers: Partial<Record<string, any>>; containerClass: string } {
  
  // 不再应用任何容器样式类
  const containerClass = '';

  // 返回空的renderers对象，让Streamdown使用默认渲染
  const renderers = {};

  return { renderers, containerClass };
}


