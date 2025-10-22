/**
 * Markdown主题系统
 * 
 * 当前状态：已禁用
 * 说明：不再使用主题系统，完全依赖Streamdown原生渲染
 */

import type { MarkdownTheme } from '@/hooks/useMarkdownTheme';

// 保留接口定义以兼容现有代码，但不再使用
export interface ThemeStyles {
  headings: { h1: string; h2: string; h3: string; h4: string; h5: string; h6: string };
  paragraph: string;
  list: { ul: string; ol: string; li: string };
  blockquote: string;
  code: { inline: string; block: string };
  link: string;
  hr: string;
  table: { table: string; th: string; td: string };
  strong: string;
}

// 空主题对象（不再使用，仅保留以兼容现有代码）
const emptyTheme: ThemeStyles = {
  headings: { h1: '', h2: '', h3: '', h4: '', h5: '', h6: '' },
  paragraph: '',
  list: { ul: '', ol: '', li: '' },
  blockquote: '',
  code: { inline: '', block: '' },
  link: '',
  hr: '',
  table: { table: '', th: '', td: '' },
  strong: '',
};

// 主题映射（已禁用，所有主题返回空对象）
export const themes: Record<MarkdownTheme, ThemeStyles> = {
  swiss: emptyTheme,
  minimal: emptyTheme,
  modern: emptyTheme,
  classic: emptyTheme,
  github: emptyTheme,
};

/**
 * 获取指定主题的样式
 * 注意：当前返回空主题，不应用任何样式
 */
export function getThemeStyles(_theme: MarkdownTheme): ThemeStyles {
  return emptyTheme;
}

