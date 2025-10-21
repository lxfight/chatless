import type { ThemeStyles } from '@/lib/markdown/themes';
import { cn } from '@/lib/utils';

// 统一的 Markdown 渲染器，供普通与流式渲染复用
export function createMarkdownRenderers(
  size: 'small' | 'medium' | 'large',
  themeStyles: ThemeStyles
): Partial<Record<string, any>> {
  const sizeModifier = size === 'small' ? '0.9em' : size === 'large' ? '1.1em' : '1em';
  const lineHeightModifier = size === 'small' ? 'leading-6' : size === 'large' ? 'leading-8' : 'leading-7';

  return {
    h1: ({ className, children, ...props }: any) => (
      <h1 className={cn(themeStyles.headings.h1, className)} style={{ fontSize: sizeModifier }} {...props}>
        {children}
      </h1>
    ),
    h2: ({ className, children, ...props }: any) => (
      <h2 className={cn(themeStyles.headings.h2, className)} style={{ fontSize: `calc(${sizeModifier} * 0.85)` }} {...props}>
        {children}
      </h2>
    ),
    h3: ({ className, children, ...props }: any) => (
      <h3 className={cn(themeStyles.headings.h3, className)} style={{ fontSize: `calc(${sizeModifier} * 0.75)` }} {...props}>
        {children}
      </h3>
    ),
    h4: ({ className, children, ...props }: any) => (
      <h4 className={cn(themeStyles.headings.h4, className)} style={{ fontSize: `calc(${sizeModifier} * 0.65)` }} {...props}>
        {children}
      </h4>
    ),
    h5: ({ className, children, ...props }: any) => (
      <h5 className={cn(themeStyles.headings.h5, className)} style={{ fontSize: `calc(${sizeModifier} * 0.55)` }} {...props}>
        {children}
      </h5>
    ),
    h6: ({ className, children, ...props }: any) => (
      <h6 className={cn(themeStyles.headings.h6, className)} style={{ fontSize: `calc(${sizeModifier} * 0.5)` }} {...props}>
        {children}
      </h6>
    ),

    p: ({ className, children, ...props }: any) => (
      <p className={cn(themeStyles.paragraph, lineHeightModifier, className)} {...props}>{children}</p>
    ),

    ul: ({ className, children, ...props }: any) => (
      <ul className={cn(themeStyles.list.ul, className)} {...props}>{children}</ul>
    ),
    ol: ({ className, children, ...props }: any) => (
      <ol className={cn(themeStyles.list.ol, className)} {...props}>{children}</ol>
    ),
    li: ({ className, children, ...props }: any) => (
      <li className={cn(themeStyles.list.li, className)} {...props}>{children}</li>
    ),

    blockquote: ({ className, children, ...props }: any) => (
      <blockquote className={cn(themeStyles.blockquote, className)} {...props}>{children}</blockquote>
    ),

    hr: ({ className, ...props }: any) => (
      <hr className={cn(themeStyles.hr, className)} {...props} />
    ),

    a: ({ className, children, href, ...props }: any) => (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cn(themeStyles.link, className)} {...props}>
        {children}
      </a>
    ),

    strong: ({ className, children, ...props }: any) => (
      <strong className={cn(themeStyles.strong, className)} {...props}>{children}</strong>
    ),

    code: ({ inline, className, children, ...props }: any) => {
      if (inline) {
        return <code className={cn(themeStyles.code.inline, className)} {...props}>{children}</code>;
      }
      return <code className={className} {...props}>{children}</code>;
    },

    table: ({ className, children, ...props }: any) => (
      <table className={cn(themeStyles.table.table, className)} {...props}>{children}</table>
    ),
    th: ({ className, children, ...props }: any) => (
      <th className={cn(themeStyles.table.th, className)} {...props}>{children}</th>
    ),
    td: ({ className, children, ...props }: any) => (
      <td className={cn(themeStyles.table.td, className)} {...props}>{children}</td>
    ),

    img: ({ className, src, alt, ...props }: any) => (
      <img
        src={String(src || '')}
        alt={String(alt || '')}
        className={cn('max-w-full h-auto rounded-md my-4', className)}
        {...props}
      />
    ),
  };
}


