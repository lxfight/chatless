/**
 * Markdown主题样式配置
 * 每个主题定义了标题、段落、列表等元素的样式
 */

import type { MarkdownTheme } from '@/hooks/useMarkdownTheme';

export interface ThemeStyles {
  // 标题样式 [h1, h2, h3]
  headings: {
    h1: string;
    h2: string;
    h3: string;
    h4: string;
    h5: string;
    h6: string;
  };
  // 段落样式
  paragraph: string;
  // 列表样式
  list: {
    ul: string;
    ol: string;
    li: string;
  };
  // 引用样式
  blockquote: string;
  // 代码样式
  code: {
    inline: string;
    block: string;
  };
  // 链接样式
  link: string;
  // 分隔线
  hr: string;
  // 表格样式
  table: {
    table: string;
    th: string;
    td: string;
  };
  // 强调
  strong: string;
}

// 瑞士简约风格 - 注重排版、留白和层次
const swissTheme: ThemeStyles = {
  headings: {
    h1: 'mt-8 mb-4 font-light text-3xl tracking-tight text-gray-900 dark:text-gray-50',
    h2: 'mt-6 mb-3 font-light text-2xl tracking-tight text-gray-900 dark:text-gray-50',
    h3: 'mt-5 mb-2 font-normal text-xl text-gray-900 dark:text-gray-50',
    h4: 'mt-4 mb-2 font-normal text-lg text-gray-800 dark:text-gray-100',
    h5: 'mt-3 mb-1.5 font-medium text-base text-gray-800 dark:text-gray-100',
    h6: 'mt-3 mb-1.5 font-medium text-sm text-gray-700 dark:text-gray-200',
  },
  paragraph: 'mb-4 leading-7 text-gray-700 dark:text-gray-300',
  list: {
    ul: 'my-4 ml-6 space-y-2 list-disc text-gray-700 dark:text-gray-300',
    ol: 'my-4 ml-6 space-y-2 list-decimal text-gray-700 dark:text-gray-300',
    li: 'leading-7',
  },
  blockquote: 'my-6 pl-5 border-l-[3px] border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 italic',
  code: {
    inline: 'px-1.5 py-0.5 rounded text-[0.875em] bg-gray-100 dark:bg-gray-800 text-pink-600 dark:text-pink-400 font-mono',
    block: 'my-4',
  },
  link: 'text-blue-600 dark:text-blue-400 underline decoration-blue-300 dark:decoration-blue-700 underline-offset-2 hover:decoration-blue-500 dark:hover:decoration-blue-500 transition-colors',
  hr: 'my-8 border-0 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-700 to-transparent',
  table: {
    table: 'my-6 w-full border-collapse',
    th: 'border-b-2 border-gray-300 dark:border-gray-600 px-4 py-2.5 text-left font-medium text-gray-900 dark:text-gray-100',
    td: 'border-b border-gray-200 dark:border-gray-700 px-4 py-2.5 text-gray-700 dark:text-gray-300',
  },
  strong: 'font-semibold text-gray-900 dark:text-gray-100',
};

// 极简主义风格 - 最小化装饰，突出内容
const minimalTheme: ThemeStyles = {
  headings: {
    h1: 'mt-10 mb-5 font-normal text-3xl text-black dark:text-white',
    h2: 'mt-8 mb-4 font-normal text-2xl text-black dark:text-white',
    h3: 'mt-6 mb-3 font-normal text-xl text-black dark:text-white',
    h4: 'mt-5 mb-2 font-normal text-lg text-black dark:text-white',
    h5: 'mt-4 mb-2 font-normal text-base text-black dark:text-white',
    h6: 'mt-4 mb-2 font-normal text-sm text-black dark:text-white',
  },
  paragraph: 'mb-5 leading-8 text-gray-800 dark:text-gray-200',
  list: {
    ul: 'my-5 ml-5 space-y-2.5 list-none text-gray-800 dark:text-gray-200',
    ol: 'my-5 ml-5 space-y-2.5 list-decimal text-gray-800 dark:text-gray-200',
    li: 'leading-8 before:content-["—"] before:mr-2 before:text-gray-400',
  },
  blockquote: 'my-6 pl-6 border-l-2 border-black dark:border-white text-gray-700 dark:text-gray-300',
  code: {
    inline: 'px-1 py-0.5 bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-mono text-sm',
    block: 'my-5',
  },
  link: 'text-black dark:text-white underline hover:no-underline',
  hr: 'my-10 border-0 h-px bg-gray-300 dark:bg-gray-700',
  table: {
    table: 'my-6 w-full',
    th: 'border-b border-gray-900 dark:border-gray-100 px-3 py-2 text-left font-medium',
    td: 'border-b border-gray-200 dark:border-gray-800 px-3 py-2',
  },
  strong: 'font-medium',
};

// 现代简洁风格 - 清晰层次，现代感
const modernTheme: ThemeStyles = {
  headings: {
    h1: 'mt-8 mb-4 font-bold text-3xl text-slate-900 dark:text-slate-50',
    h2: 'mt-6 mb-3 font-bold text-2xl text-slate-900 dark:text-slate-50',
    h3: 'mt-5 mb-2.5 font-semibold text-xl text-slate-800 dark:text-slate-100',
    h4: 'mt-4 mb-2 font-semibold text-lg text-slate-800 dark:text-slate-100',
    h5: 'mt-3 mb-1.5 font-semibold text-base text-slate-700 dark:text-slate-200',
    h6: 'mt-3 mb-1.5 font-semibold text-sm text-slate-700 dark:text-slate-200',
  },
  paragraph: 'mb-4 leading-7 text-slate-700 dark:text-slate-300',
  list: {
    ul: 'my-4 ml-6 space-y-1.5 list-disc marker:text-blue-500 text-slate-700 dark:text-slate-300',
    ol: 'my-4 ml-6 space-y-1.5 list-decimal marker:text-blue-500 text-slate-700 dark:text-slate-300',
    li: 'leading-7 pl-1',
  },
  blockquote: 'my-5 pl-4 border-l-4 border-blue-500 dark:border-blue-400 bg-slate-50 dark:bg-slate-900/50 py-3 text-slate-600 dark:text-slate-400',
  code: {
    inline: 'px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-rose-600 dark:text-rose-400 font-mono text-[0.9em]',
    block: 'my-4',
  },
  link: 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline decoration-1 underline-offset-2',
  hr: 'my-6 border-t-2 border-slate-200 dark:border-slate-800',
  table: {
    table: 'my-5 w-full border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden',
    th: 'bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-2.5 text-left font-semibold text-slate-900 dark:text-slate-100',
    td: 'border-b border-slate-100 dark:border-slate-800 px-4 py-2.5 text-slate-700 dark:text-slate-300',
  },
  strong: 'font-semibold text-slate-900 dark:text-slate-50',
};

// 经典书籍风格 - 传统排版，适合长文阅读
const classicTheme: ThemeStyles = {
  headings: {
    h1: 'mt-12 mb-6 font-serif font-bold text-4xl text-gray-900 dark:text-gray-50 text-center',
    h2: 'mt-10 mb-5 font-serif font-semibold text-3xl text-gray-900 dark:text-gray-50',
    h3: 'mt-8 mb-4 font-serif font-semibold text-2xl text-gray-800 dark:text-gray-100',
    h4: 'mt-6 mb-3 font-serif font-medium text-xl text-gray-800 dark:text-gray-100',
    h5: 'mt-5 mb-2 font-serif font-medium text-lg text-gray-700 dark:text-gray-200',
    h6: 'mt-4 mb-2 font-serif font-medium text-base text-gray-700 dark:text-gray-200',
  },
  paragraph: 'mb-5 leading-8 text-justify text-gray-800 dark:text-gray-200 indent-8 first-letter:text-2xl first-letter:font-bold first-letter:mr-1',
  list: {
    ul: 'my-5 ml-8 space-y-2 list-disc text-gray-800 dark:text-gray-200',
    ol: 'my-5 ml-8 space-y-2 list-decimal text-gray-800 dark:text-gray-200',
    li: 'leading-8',
  },
  blockquote: 'my-6 px-6 py-4 border-l-4 border-amber-600 dark:border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-gray-700 dark:text-gray-300 italic font-serif',
  code: {
    inline: 'px-2 py-1 rounded bg-stone-100 dark:bg-stone-800 text-amber-800 dark:text-amber-300 font-mono text-sm',
    block: 'my-5',
  },
  link: 'text-amber-700 dark:text-amber-400 underline decoration-dotted underline-offset-4 hover:decoration-solid',
  hr: 'my-8 border-0 text-center after:content-["***"] after:text-gray-400 after:text-2xl after:tracking-widest',
  table: {
    table: 'my-6 w-full border-t border-b border-gray-300 dark:border-gray-700',
    th: 'border-b-2 border-gray-400 dark:border-gray-600 px-4 py-3 text-left font-serif font-semibold text-gray-900 dark:text-gray-100',
    td: 'border-b border-gray-200 dark:border-gray-800 px-4 py-3 text-gray-800 dark:text-gray-200',
  },
  strong: 'font-bold',
};

// GitHub风格 - 熟悉的GitHub Markdown样式
const githubTheme: ThemeStyles = {
  headings: {
    h1: 'mt-6 mb-4 pb-2 font-semibold text-3xl text-gray-900 dark:text-gray-100 border-b border-gray-300 dark:border-gray-700',
    h2: 'mt-6 mb-4 pb-2 font-semibold text-2xl text-gray-900 dark:text-gray-100 border-b border-gray-300 dark:border-gray-700',
    h3: 'mt-6 mb-4 font-semibold text-xl text-gray-900 dark:text-gray-100',
    h4: 'mt-6 mb-4 font-semibold text-lg text-gray-900 dark:text-gray-100',
    h5: 'mt-6 mb-4 font-semibold text-base text-gray-900 dark:text-gray-100',
    h6: 'mt-6 mb-4 font-semibold text-sm text-gray-600 dark:text-gray-400',
  },
  paragraph: 'mb-4 leading-6 text-gray-700 dark:text-gray-300',
  list: {
    ul: 'my-4 ml-6 space-y-0.5 list-disc text-gray-700 dark:text-gray-300',
    ol: 'my-4 ml-6 space-y-0.5 list-decimal text-gray-700 dark:text-gray-300',
    li: 'leading-6',
  },
  blockquote: 'my-4 pl-4 border-l-4 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400',
  code: {
    inline: 'px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-mono text-[0.85em]',
    block: 'my-4',
  },
  link: 'text-blue-600 dark:text-blue-400 hover:underline',
  hr: 'my-6 border-t border-gray-300 dark:border-gray-700',
  table: {
    table: 'my-4 w-full border-collapse',
    th: 'border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-left font-semibold text-gray-900 dark:text-gray-100',
    td: 'border border-gray-300 dark:border-gray-700 px-3 py-2 text-gray-700 dark:text-gray-300',
  },
  strong: 'font-semibold',
};

// 主题映射
export const themes: Record<MarkdownTheme, ThemeStyles> = {
  swiss: swissTheme,
  minimal: minimalTheme,
  modern: modernTheme,
  classic: classicTheme,
  github: githubTheme,
};

/**
 * 获取指定主题的样式
 */
export function getThemeStyles(theme: MarkdownTheme): ThemeStyles {
  return themes[theme] || themes.swiss;
}

