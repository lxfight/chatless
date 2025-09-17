import { pinyin } from 'pinyin-pro';

/**
 * 中文转拼音工具函数
 * 用于将中文提供商名称转换为拼音，生成安全的ID
 */

/**
 * 检测字符串是否包含中文字符
 * @param str 待检测的字符串
 * @returns 是否包含中文
 */
export function containsChinese(str: string): boolean {
  return /[\u4e00-\u9fff]/.test(str);
}

/**
 * 将中文转换为拼音
 * @param text 包含中文的文本
 * @param options 转换选项
 * @returns 拼音字符串
 */
export function toPinyin(text: string, options: {
  /** 是否保留非中文字符 */
  keepNonChinese?: boolean;
  /** 分隔符 */
  separator?: string;
  /** 是否转换为小写 */
  toLowerCase?: boolean;
  /** 是否去除声调 */
  toneType?: 'none' | 'num' | 'symbol';
} = {}): string {
  const {
    keepNonChinese = true,
    separator = '-',
    toLowerCase = true,
    toneType = 'none'
  } = options;

  if (!containsChinese(text)) {
    return toLowerCase ? text.toLowerCase() : text;
  }

  // 转换中文为拼音
  const pinyinResult = pinyin(text, {
    toneType,
    type: 'string',
    nonZh: keepNonChinese ? 'consecutive' : 'removed'
  });

  // 处理结果
  let result = pinyinResult;
  
  if (separator) {
    // 用分隔符连接拼音
    result = result.replace(/\s+/g, separator);
  }
  
  if (toLowerCase) {
    result = result.toLowerCase();
  }

  return result;
}

/**
 * 生成安全的ID（基于拼音转换）
 * @param text 原始文本
 * @returns 安全的ID字符串
 */
export function generateSafeId(text: string): string {
  if (!text || text.trim() === '') {
    return '';
  }

  const trimmed = text.trim();
  
  // 如果包含中文，转换为拼音
  if (containsChinese(trimmed)) {
    const pinyinText = toPinyin(trimmed, {
      keepNonChinese: true,
      separator: '-',
      toLowerCase: true,
      toneType: 'none'
    });
    
    // 清理拼音结果，只保留字母、数字和连字符
    return pinyinText
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '')
      .slice(0, 64); // 限制长度
  }
  
  // 如果不包含中文，使用原有的清理逻辑
  let s = trimmed.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  s = s.replace(/-+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
  if (s.length > 64) s = s.slice(0, 64);
  return s;
}

/**
 * 验证提供商名称是否有效
 * @param name 提供商名称
 * @returns 验证结果
 */
export function validateProviderName(name: string): {
  isValid: boolean;
  error?: string;
  suggestion?: string;
} {
  if (!name || name.trim() === '') {
    return {
      isValid: false,
      error: '名称不能为空'
    };
  }

  const trimmed = name.trim();
  
  // 检查长度
  if (trimmed.length < 2) {
    return {
      isValid: false,
      error: '名称过短',
      suggestion: '请使用至少 2 个字符'
    };
  }

  // 限制最大长度为 20 个字符
  if (trimmed.length > 20) {
    return {
      isValid: false,
      error: '名称过长',
      suggestion: '请使用不超过 20 个字符'
    };
  }

  // 检查是否包含非法字符：仅允许中文、英文、数字和空格（不支持特殊符号）
  const validPattern = /^[\u4e00-\u9fffA-Za-z0-9 ]+$/;
  if (!validPattern.test(trimmed)) {
    return {
      isValid: false,
      error: '名称包含非法字符',
      suggestion: '仅支持中文、英文、数字和空格，不允许特殊符号'
    };
  }

  return {
    isValid: true
  };
}
