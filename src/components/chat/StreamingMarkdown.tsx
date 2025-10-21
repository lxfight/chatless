"use client";

import { Streamdown } from 'streamdown';
import { useMarkdownFontSize } from '@/hooks/useMarkdownFontSize';
import { useMarkdownTheme } from '@/hooks/useMarkdownTheme';
import { getThemeStyles } from '@/lib/markdown/themes';
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
  const { theme } = useMarkdownTheme();
  const themeStyles = getThemeStyles(theme);
  const renderers = createMarkdownRenderers(size, themeStyles);

  return (
    <div className={className}>
      <Streamdown isAnimating={isStreaming} components={renderers}>
        {content}
      </Streamdown>
    </div>
  );
}

