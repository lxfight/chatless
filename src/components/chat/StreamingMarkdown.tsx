"use client";

import { Streamdown } from 'streamdown';
import { useMarkdownFontSize } from '@/hooks/useMarkdownFontSize';
// 主题系统已禁用 - 使用Streamdown原生渲染
// import { useMarkdownTheme } from '@/hooks/useMarkdownTheme';
// import { getThemeStyles } from '@/lib/markdown/themes';
import { createMarkdownRenderers } from '@/lib/markdown/renderers';

interface StreamingMarkdownProps {
  content: string;
  isStreaming: boolean;
  className?: string;
}

/**
 * 流式Markdown渲染组件
 * 使用 Streamdown 以在流式输出时稳定解析未闭合的 Markdown
 */
export function StreamingMarkdown({ content, isStreaming, className }: StreamingMarkdownProps) {
  const { size } = useMarkdownFontSize();
  // 主题系统已禁用
  // const { theme } = useMarkdownTheme();
  // const themeStyles = getThemeStyles(theme);
  const themeStyles = { headings: { h1: '', h2: '', h3: '', h4: '', h5: '', h6: '' }, paragraph: '', list: { ul: '', ol: '', li: '' }, blockquote: '', code: { inline: '', block: '' }, link: '', hr: '', table: { table: '', th: '', td: '' }, strong: '' };
  const { renderers, containerClass } = createMarkdownRenderers(size, themeStyles);

  return (
    <div className={`${containerClass} ${className || ''}`}>
      <Streamdown isAnimating={isStreaming} components={renderers}>
        {content}
      </Streamdown>
    </div>
  );
}

