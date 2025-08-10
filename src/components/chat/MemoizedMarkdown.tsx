"use client";

import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import type { Components } from 'react-markdown';
// 移除专用 CodeProps 类型，使用 any 以避免版本兼容问题
import { CodeBlock } from '@/components/chat/CodeBlock';
import { useMarkdownFontSize } from '@/hooks/useMarkdownFontSize';

interface MemoizedMarkdownProps {
  content: string;
  className?: string;
  // 可选：覆盖全局字号（用于“思考过程”等需要缩小一号的场景）
  sizeOverride?: 'small' | 'medium' | 'large';
}

// 根据字号动态生成渲染器
function createRenderers(size: 'small' | 'medium' | 'large'): Partial<Components> {
  // 映射不同字号下的标题大小
  const headingSizeMap = {
    small: ['text-3xl', 'text-2xl', 'text-xl'],
    medium: ['text-4xl', 'text-3xl', 'text-2xl'],
    large: ['text-5xl', 'text-4xl', 'text-3xl'],
  } as const;

  const paragraphSizeMap = {
    small: 'text-sm leading-6',
    medium: 'text-base leading-7',
    large: 'text-lg leading-8',
  } as const;

  const [h1Class, h2Class, h3Class] = headingSizeMap[size];
  const pClass = paragraphSizeMap[size];

  return {
    // 标题
    h1: ({ node, className, children, ...props }) => (
      <h1
        className={cn('mt-8 mb-4 font-black text-black tracking-tight', h1Class, className)}
        {...props}
      >
        {children}
      </h1>
    ),
    h2: ({ node, className, children, ...props }) => (
      <h2
        className={cn('mt-6 mb-2 font-black text-black dark:text-gray-200 tracking-tight', h2Class, className)}
        {...props}
      >
        {children}
      </h2>
    ),
    h3: ({ node, className, children, ...props }) => (
      <h3
        className={cn('mt-5 mb-2 font-black text-black dark:text-gray-200 tracking-tight', h3Class, className)}
        {...props}
      >
        {children}
      </h3>
    ),

    // 段落
    p: ({ node, className, children, ...props }) => (
      <p className={cn('mb-5 text-black dark:text-gray-200', pClass, className)} {...props}>
        {children}
      </p>
    ),

    // 列表
    ul: ({ node, className, children, ...props }) => (
      <ul className={cn('list-disc ml-6 space-y-2 text-black dark:text-gray-200', className)} {...props}>
        {children}
      </ul>
    ),
    ol: ({ node, className, children, ...props }) => (
      <ol className={cn('list-decimal ml-6 space-y-2 text-black dark:text-gray-200', className)} {...props}>
        {children}
      </ol>
    ),
    li: ({ node, className, children, ...props }) => (
      <li className={cn('text-black dark:text-gray-200', className)} {...props}>{children}</li>
    ),

    // 引用
    blockquote: ({ node, className, children, ...props }) => (
      <blockquote
        className={cn('pl-6 border-l-4 border-[#007aff] dark:border-gray-600 text-black dark:text-gray-300 italic my-6', className)}
        {...props}
      >
        {children}
      </blockquote>
    ),

    // 链接
    a: ({ node, className, children, href, ...props }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn('text-[#007aff] dark:text-blue-400 hover:underline hover:underline-offset-2', className)}
        style={{ textDecoration: 'none' }}
        {...props}
      >
        {children}
      </a>
    ),

    // 代码自定义保留不变（引用现有实现）
    code: ({ node, inline, className, children, ...props }: any) => {
      const codeString = String(children).replace(/\n$/, "");

      // 条件 1：inline=true —— 标准行内代码
      // 条件 2：即便 inline=false，但没有 language 类名且不包含换行，也强制按行内代码渲染，
      //        以修复 "- `index`" 被误识别为代码块的问题。
      const shouldRenderInline = inline || (!/language-/.test(className || '') && !codeString.includes('\n'));

      if (shouldRenderInline) {
        return (
          <code
            className={cn('px-1 py-0.5 rounded-sm bg-[#f0f0f0] dark:bg-gray-700 font-mono text-[#d63384] dark:text-pink-300 text-[0.9rem]', className)}
            {...props}
          >
            {children}
          </code>
        );
      }

      const match = /language-(\w+)/.exec(className || "");
      return <CodeBlock language={match?.[1] || null} code={codeString} />;
    },
  };
}

export const MemoizedMarkdown = memo(({ content, className, sizeOverride }: MemoizedMarkdownProps) => {
  const { size } = useMarkdownFontSize();

  const effectiveSize = sizeOverride ?? size;

  const sizeClass = effectiveSize === 'small' ? 'text-sm' : effectiveSize === 'large' ? 'text-lg' : 'text-base';

  const renderers = createRenderers(effectiveSize);

  return (
    <div className={cn(sizeClass, className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={renderers}>
        {content}
      </ReactMarkdown>
    </div>
  );
}); 