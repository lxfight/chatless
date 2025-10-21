"use client";

import { memo } from 'react';
import { Streamdown } from 'streamdown';
import { cn } from '@/lib/utils';
import { useMarkdownFontSize } from '@/hooks/useMarkdownFontSize';
import { useMarkdownTheme } from '@/hooks/useMarkdownTheme';
import { getThemeStyles } from '@/lib/markdown/themes';
import { createMarkdownRenderers } from '@/lib/markdown/renderers';

interface MemoizedMarkdownProps {
  content: string;
  className?: string;
  // 可选：覆盖全局字号（用于"思考过程"等需要缩小一号的场景）
  sizeOverride?: 'small' | 'medium' | 'large';
}


export const MemoizedMarkdown = memo(({ content, className, sizeOverride }: MemoizedMarkdownProps) => {
  const { size } = useMarkdownFontSize();
  const { theme } = useMarkdownTheme();

  const effectiveSize = sizeOverride ?? size;
  
  // 获取主题样式
  const themeStyles = getThemeStyles(theme);

  const renderers = createMarkdownRenderers(effectiveSize, themeStyles);

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

  return (
    <div className={cn("whitespace-normal", className)}>
      <Streamdown components={renderers}>
        {contentForRender}
      </Streamdown>
    </div>
  );
}); 