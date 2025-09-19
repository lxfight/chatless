"use client";

import { memo, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
// 移除 rehype-raw，避免 HTML 注入并提升稳定性
import rehypeSanitize from 'rehype-sanitize';
import { defaultSchema } from 'hast-util-sanitize';
import rehypeKatex from 'rehype-katex';
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

      // 特殊：表格代码块支持
      const lang = (match?.[1] || '').toLowerCase();
      if (lang === 'table' || lang === 'csv' || lang === 'tsv' || lang === 'json-table') {
        try {
          if (lang === 'json-table') {
            const obj = JSON.parse(codeString);
            const headers: string[] = obj.headers || [];
            const rows: any[][] = obj.rows || [];
            return (
              <div className="overflow-x-auto my-3">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>{headers.map((h, i)=>(<th key={i} className="border-b px-3 py-1.5 text-left font-semibold">{h}</th>))}</tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i)=>(
                      <tr key={i}>{r.map((c: any, j: number)=>(<td key={j} className="border-b px-3 py-1.5 align-top">{String(c)}</td>))}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
          const rows = codeString.trim().split(/\r?\n/).filter(Boolean);
          const cells = rows.map(raw => {
            const line = raw.trim();
            if (lang === 'tsv') return line.split('\t');
            if (lang === 'csv') return line.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/);
            // table: 兼容用竖线/空白分隔。仅当首/尾确有竖线时才丢弃首尾空单元
            if (line.includes('|')) {
              const parts = line.split('|').map(s => s.trim());
              const shouldTrimEdges = line.startsWith('|') || line.endsWith('|');
              return shouldTrimEdges ? parts.filter((_, i, arr) => !(i === 0 || i === arr.length - 1)) : parts;
            }
            return line.split(/\s{2,}/); // 两个以上空格视为分列
          });
          const header = cells[0] || [];
          const body = cells.slice(1);
          return (
            <div className="overflow-x-auto my-3">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>{header.map((h, i)=>(<th key={i} className="border-b px-3 py-1.5 text-left font-semibold">{h}</th>))}</tr>
                </thead>
                <tbody>
                  {body.map((r, i)=>(
                    <tr key={i}>{r.map((c: any, j: number)=>(<td key={j} className="border-b px-3 py-1.5 align-top">{String(c)}</td>))}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        } catch {
          // 回退到常规代码块
        }
      }
      // 支持 json 语言：若包含 headers/rows 即按结构化表格渲染
      if (lang === 'json') {
        try {
          const obj = JSON.parse(codeString);
          if (obj && Array.isArray(obj.headers) && Array.isArray(obj.rows)) {
            const headers: string[] = obj.headers || [];
            const rows: any[][] = obj.rows || [];
            return (
              <div className="overflow-x-auto my-3">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>{headers.map((h, i)=>(<th key={i} className="border-b px-3 py-1.5 text-left font-semibold">{h}</th>))}</tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i)=>(
                      <tr key={i}>{r.map((c: any, j: number)=>(<td key={j} className="border-b px-3 py-1.5 align-top">{String(c)}</td>))}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
        } catch { /* 回退 */ }
      }

      return <CodeBlock language={lang || null} code={codeString} />;
    },
    // 原生表格样式（GFM表格）
    table: ({ node, className, children, ...props }) => (
      <table className={cn('w-full border-collapse text-sm', className)} {...props}>{children}</table>
    ),
    th: ({ node, className, children, ...props }) => (
      <th className={cn('border-b px-3 py-1.5 text-left font-semibold', className)} {...props}>{children}</th>
    ),
    td: ({ node, className, children, ...props }) => (
      <td className={cn('border-b px-3 py-1.5 align-top', className)} {...props}>{children}</td>
    ),
    img: ({ node, className, src, alt, ...props }) => (
      <img
        src={String(src || '')}
        alt={String(alt || '')}
        className={cn('max-w-full h-auto', className)}
        onError={(e:any)=>{
          try {
            const ph = encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='120' height='80'><rect width='100%' height='100%' fill='${encodeURIComponent('#1f2937')}'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='12'>图片不可用</text></svg>`);
            e.currentTarget.src = `data:image/svg+xml;charset=utf-8,${ph}`;
          } catch {/* noop */}
        }}
        {...props}
      />
    ),
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

  // HTML 换行 <br> 预处理 → Markdown 硬换行
  function convertHtmlBreaksToMd(input: string): string {
    return input
      .replace(/<br\s*\/>/gi, '  \n')
      .replace(/<br\s*>/gi, '  \n');
  }

  // 流式Markdown稳定渲染：在未闭合时临时中和标记，避免抖动
  function stabilizeStreamingMarkdown(input: string): string {
    // 简单状态机：忽略 fenced code（```）与 inline code（`...`）内的内容
    let out = '';
    let i = 0;
    let inFence = false;
    let inInline = false;
    while (i < input.length) {
      // 尝试匹配三反引号
      if (!inInline && input.startsWith('```', i)) {
        inFence = !inFence;
        out += '```';
        i += 3;
        continue;
      }
      // 尝试匹配行内反引号（排除在 fenced code 中）
      if (!inFence && input[i] === '`') {
        inInline = !inInline;
        out += '`';
        i += 1;
        continue;
      }
      out += input[i++];
    }

    // 若存在未闭合 fenced code，则暂时转义最后一个开头，避免把后续内容吸入代码块
    if (inFence) {
      const lastFence = out.lastIndexOf('```');
      if (lastFence >= 0) {
        out = out.slice(0, lastFence) + '\\`\\`\\`' + out.slice(lastFence + 3);
      }
    }
    // 若存在未闭合 inline code，则转义最后一个反引号
    if (inInline) {
      const lastTick = out.lastIndexOf('`');
      if (lastTick >= 0) {
        out = out.slice(0, lastTick) + '\\`' + out.slice(lastTick + 1);
      }
    }

    // 处理中粗体/斜体标记：仅在不在代码块内时考虑（上面已排除代码内容的副作用）
    // 简化规则：当 ** / __ 数量为奇数时，转义最后一个
    const escapeLastUnpaired = (s: string, marker: string) => {
      const count = (s.match(new RegExp(marker.replace(/([*_/`\\])/g, '\\$1'), 'g')) || []).length;
      if (count % 2 === 1) {
        const idx = s.lastIndexOf(marker);
        if (idx >= 0) {
          return s.slice(0, idx) + marker.replace(/[*_]/g, (m) => `\\${m}`) + s.slice(idx + marker.length);
        }
      }
      return s;
    };

    out = escapeLastUnpaired(out, '**');
    out = escapeLastUnpaired(out, '__');
    // 可选：单星/单下划线（斜体）
    const countChar = (s: string, ch: string) => (s.match(new RegExp(`\\${ch}`, 'g')) || []).length;
    if (countChar(out, '*') % 2 === 1) {
      const idx = out.lastIndexOf('*'); if (idx >= 0) out = out.slice(0, idx) + '\\*' + out.slice(idx + 1);
    }
    if (countChar(out, '_') % 2 === 1) {
      const idx = out.lastIndexOf('_'); if (idx >= 0) out = out.slice(0, idx) + '\\_' + out.slice(idx + 1);
    }

    // 处理分割线（hr）：避免在流式期间从普通字符瞬时变为 <hr> 造成跳动
    // Markdown 规则：仅由 *, -, _ 组成且数量≥3 的一行会成为 <hr>
    // 策略：若当前文本末尾存在仅由这些符号组成的行，且不满足“确认结束”（后面没有空行或仍在输入），暂时转义一个符号
    const lines = out.split(/\r?\n/);
    const isPotentialHr = (line: string) => /^(?:\s*[*_-]\s*){1,}$/.test(line.trim());
    const countMarkers = (line: string) => (line.match(/[*_-]/g) || []).length;
    const lastIdx = lines.length - 1;
    if (lastIdx >= 0) {
      const line = lines[lastIdx];
      if (isPotentialHr(line)) {
        const markers = countMarkers(line);
        // 1-2 个标记：一定不是 hr，保持原样；3 个及以上标记：仅在“已闭合（后续已出现非空行或已有空行）”时生效
        if (markers >= 3) {
          // 判断是否“已确认结束”：当前文本是否以双换行结尾（表示块结束）
          const confirmed = /\n\s*\n\s*$/.test(input);
          if (!confirmed) {
            // 临时中和：转义最后一个标记，避免被识别为 hr
            const pos = line.lastIndexOf('*') >= 0 ? line.lastIndexOf('*') : (line.lastIndexOf('-') >= 0 ? line.lastIndexOf('-') : line.lastIndexOf('_'));
            if (pos >= 0) {
              const l = line.slice(0, pos) + '\\' + line[pos] + line.slice(pos + 1);
              lines[lastIdx] = l;
              out = lines.join('\n');
            }
          }
        }
      }
    }

    return out;
  }

  const contentForRender = stabilizeStreamingMarkdown(convertHtmlBreaksToMd(sanitizedContent));

  // 动态注入 KaTeX 样式（避免在全局CSS中额外导入）
  useEffect(() => {
    try {
      if (typeof document === 'undefined') return;
      const id = 'katex-css';
      if (!document.getElementById(id)) {
        const link = document.createElement('link');
        link.id = id;
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
        link.crossOrigin = 'anonymous';
        link.referrerPolicy = 'no-referrer';
        document.head.appendChild(link);
      }
    } catch { /* noop */ }
  }, []);

  //关键修复：whitespace-normal,这可以避免whitespace-pre出现奇怪的间距问题，需要特殊控制时则由特定的组件自行覆盖
  // rehype-sanitize 安全白名单（允许有限HTML：br、table相关、span(class) 供 KaTeX 使用）
  const sanitizeSchema: any = {
    ...defaultSchema,
    attributes: {
      ...defaultSchema.attributes,
      span: [
        ...(defaultSchema.attributes?.span || []),
        ['className'],
      ],
      div: [
        ...(defaultSchema.attributes?.div || []),
        ['className'],
      ],
    },
    tagNames: [
      ...(defaultSchema.tagNames || []),
      'br','table','thead','tbody','tr','th','td','span','div','sup','sub'
    ]
  };

  return (
    <div className={cn(sizeClass,"whitespace-normal", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeSanitize, sanitizeSchema], [rehypeKatex, { throwOnError: false, strict: false }]]}
        skipHtml={false}
        components={renderers}
      >
        {contentForRender}
      </ReactMarkdown>
    </div>
  );
}); 