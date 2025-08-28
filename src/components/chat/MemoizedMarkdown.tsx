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
  // 更克制的标题字号映射（聊天场景不宜过大）
  const headingSizeMap = {
    // h3 在各档位都略大于正文，且明显小于 h2
    small: ['text-lg', 'text-base', 'text-[0.95rem]'],
    medium: ['text-xl', 'text-lg', 'text-[1.05rem]'],
    large: ['text-2xl', 'text-xl', 'text-[1.2rem]'],
  } as const;

  const paragraphSizeMap = {
    small: 'text-sm leading-6',
    medium: 'text-base leading-7',
    large: 'text-lg leading-8',
  } as const;

  const [h1Class, h2Class, h3Class] = headingSizeMap[size];
  const pClass = paragraphSizeMap[size];

  return {
    // 标题（更轻的字重与更小的上下间距）
    h1: ({ node, className, children, ...props }) => (
      <h1
        className={cn('mt-4 mb-3 font-semibold text-black dark:text-gray-100', h1Class, className)}
        {...props}
      >
        {children}
      </h1>
    ),
    h2: ({ node, className, children, ...props }) => (
      <h2
        className={cn('mt-3 mb-2 font-semibold text-black dark:text-gray-100', h2Class, className)}
        {...props}
      >
        {children}
      </h2>
    ),
    h3: ({ node, className, children, ...props }) => (
      <h3
        className={cn('mt-2.5 mb-1.5 font-semibold text-black dark:text-gray-100', h3Class, className)}
        {...props}
      >
        {children}
      </h3>
    ),
    h4: ({ node, className, children, ...props }) => (
      <h4 className={cn('mt-2 mb-1 font-medium text-black dark:text-gray-100', size === 'large' ? 'text-base' : size === 'small' ? 'text-sm' : 'text-sm', className)} {...props}>{children}</h4>
    ),
    h5: ({ node, className, children, ...props }) => (
      <h5 className={cn('mt-2 mb-1 font-medium text-black dark:text-gray-100', size === 'large' ? 'text-sm' : 'text-xs', className)} {...props}>{children}</h5>
    ),
    h6: ({ node, className, children, ...props }) => (
      <h6 className={cn('mt-2 mb-1 font-medium text-black dark:text-gray-100 text-xs', className)} {...props}>{children}</h6>
    ),

    // 段落
    p: ({ node, className, children, ...props }) => (
      <p className={cn('mb-5 text-black dark:text-gray-200', pClass, className)} {...props}>
        {children}
      </p>
    ),

    // 列表
    ul: ({ node, className, children, ...props }) => (
      <ul className={cn('list-disc ml-5 space-y-1.5 text-black dark:text-gray-200', className)} {...props}>
        {children}
      </ul>
    ),
    ol: ({ node, className, children, ...props }) => (
      <ol className={cn('list-decimal ml-5 space-y-1.5 text-black dark:text-gray-200', className)} {...props}>
        {children}
      </ol>
    ),
    li: ({ node, className, children, ...props }) => (
      <li className={cn('text-black dark:text-gray-200', className)} {...props}>{children}</li>
    ),

    // 引用
    blockquote: ({ node, className, children, ...props }) => (
      <blockquote
        className={cn('pl-4 border-l-2 border-[#007aff] dark:border-gray-600 text-black dark:text-gray-300 italic my-4', className)}
        {...props}
      >
        {children}
      </blockquote>
    ),

    // 分隔线
    hr: ({ node, className, ...props }) => (
      <hr className={cn('my-4 border-t border-gray-200 dark:border-gray-700', className)} {...props} />
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

    // 强调（加粗）——保持字号不变，仅提升字重，避免与 h3 视觉等大
    strong: ({ node, className, children, ...props }) => (
      <strong className={cn('font-semibold', className)} {...props}>{children}</strong>
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

  // 处理“只有自定义HTML标签一行”的情况（如 </final_answer> 被当作 HTML 丢弃导致视觉缺行）
  // 将整行仅包含的自定义标签转义成文本呈现
  const sanitizedContent = content.replace(/^(<\/?[\w:-]+>)\s*$/gm, (_m, tag) =>
    String(tag).replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  );

  return (
    <div className={cn(sizeClass, className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={renderers}>
        {sanitizedContent}
      </ReactMarkdown>
    </div>
  );
}); 