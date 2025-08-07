import { DocumentExtractor, DocumentExtractionError, FileReadError } from '../types';
import { readTextFile } from '@tauri-apps/plugin-fs';

/**
 * Markdown文档提取器
 * 处理 .md, .markdown 等Markdown文件
 */
export class MarkdownExtractor implements DocumentExtractor {
  supportedTypes = ['md', 'markdown', 'mdown', 'mkd'];

  getName(): string {
    return 'MarkdownExtractor';
  }

  supports(fileType: string): boolean {
    return this.supportedTypes.includes(fileType.toLowerCase());
  }

  async extractText(filePath: string): Promise<string> {
    try {
      console.log(`正在提取Markdown文档: ${filePath}`);
      
      // 使用 Tauri 的 readTextFile API 读取Markdown文件
      const markdownText = await readTextFile(filePath);
      
      if (!markdownText || markdownText.trim().length === 0) {
        console.warn(`Markdown文档为空: ${filePath}`);
        return '';
      }

      // 清理Markdown语法，提取纯文本
      const cleanedText = this.cleanMarkdown(markdownText);
      
      console.log(`Markdown提取完成: ${filePath}, 文本长度: ${cleanedText.length}`);
      
      return cleanedText;
    } catch (error) {
      console.error(`Markdown提取失败: ${filePath}`, error);
      
      if (error instanceof Error) {
        if (error.message.includes('ENOENT') || error.message.includes('not found')) {
          throw new FileReadError(filePath, error);
        } else {
          throw new DocumentExtractionError(
            `Markdown读取失败: ${error.message}`,
            'md',
            error
          );
        }
      }
      
      throw new DocumentExtractionError(
        `Markdown提取过程中发生未知错误: ${String(error)}`,
        'md'
      );
    }
  }

  /**
   * 清理Markdown语法，提取纯文本
   */
  private cleanMarkdown(markdown: string): string {
    let text = markdown;

    // 移除代码块
    text = text.replace(/```[\s\S]*?```/g, '');
    text = text.replace(/`[^`]*`/g, '');

    // 移除HTML标签
    text = text.replace(/<[^>]*>/g, '');

    // 移除链接，保留链接文本
    text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
    text = text.replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1');

    // 移除图片
    text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
    text = text.replace(/!\[([^\]]*)\]\[[^\]]*\]/g, '$1');

    // 移除标题标记
    text = text.replace(/^#{1,6}\s+/gm, '');

    // 移除列表标记
    text = text.replace(/^\s*[-*+]\s+/gm, '');
    text = text.replace(/^\s*\d+\.\s+/gm, '');

    // 移除引用标记
    text = text.replace(/^\s*>\s*/gm, '');

    // 移除水平线
    text = text.replace(/^[-*_]{3,}$/gm, '');

    // 移除粗体和斜体标记
    text = text.replace(/\*\*([^*]*)\*\*/g, '$1');
    text = text.replace(/\*([^*]*)\*/g, '$1');
    text = text.replace(/__([^_]*)__/g, '$1');
    text = text.replace(/_([^_]*)_/g, '$1');

    // 移除删除线
    text = text.replace(/~~([^~]*)~~/g, '$1');

    // 移除表格分隔符
    text = text.replace(/^\s*\|.*\|\s*$/gm, '');
    text = text.replace(/^\s*[-:|]+\s*$/gm, '');

    // 清理多余的空白
    text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
    text = text.replace(/\s+/g, ' ');

    return text.trim();
  }

  /**
   * 提取Markdown元数据（Front Matter）
   */
  extractFrontMatter(markdown: string): {
    metadata: Record<string, any>;
    content: string;
  } {
    const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = markdown.match(frontMatterRegex);

    if (!match) {
      return {
        metadata: {},
        content: markdown
      };
    }

    const frontMatterText = match[1];
    const content = match[2];
    
    // 简单的YAML解析（仅支持基本的key: value格式）
    const metadata: Record<string, any> = {};
    const lines = frontMatterText.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine && trimmedLine.includes(':')) {
        const [key, ...valueParts] = trimmedLine.split(':');
        const value = valueParts.join(':').trim();
        
        // 移除引号
        const cleanValue = value.replace(/^["']|["']$/g, '');
        metadata[key.trim()] = cleanValue;
      }
    }

    return {
      metadata,
      content
    };
  }

  /**
   * 提取Markdown标题结构
   */
  extractHeadings(markdown: string): Array<{
    level: number;
    text: string;
    line: number;
  }> {
    const headings: Array<{ level: number; text: string; line: number }> = [];
    const lines = markdown.split('\n');

    lines.forEach((line, index) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        headings.push({
          level: match[1].length,
          text: match[2].trim(),
          line: index + 1
        });
      }
    });

    return headings;
  }

  /**
   * 提取Markdown链接
   */
  extractLinks(markdown: string): Array<{
    text: string;
    url: string;
    type: 'link' | 'image';
  }> {
    const links: Array<{ text: string; url: string; type: 'link' | 'image' }> = [];

    // 提取普通链接
    const linkRegex = /\[([^\]]*)\]\(([^)]*)\)/g;
    let match;
    while ((match = linkRegex.exec(markdown)) !== null) {
      links.push({
        text: match[1],
        url: match[2],
        type: 'link'
      });
    }

    // 提取图片链接
    const imageRegex = /!\[([^\]]*)\]\(([^)]*)\)/g;
    while ((match = imageRegex.exec(markdown)) !== null) {
      links.push({
        text: match[1],
        url: match[2],
        type: 'image'
      });
    }

    return links;
  }

  /**
   * 获取Markdown统计信息
   */
  getMarkdownStats(markdown: string): {
    characters: number;
    words: number;
    lines: number;
    headings: number;
    links: number;
    images: number;
    codeBlocks: number;
  } {
    const lines = markdown.split('\n').length;
    const words = markdown.trim().split(/\s+/).filter(word => word.length > 0).length;
    const characters = markdown.length;

    const headings = (markdown.match(/^#{1,6}\s+/gm) || []).length;
    const links = (markdown.match(/\[([^\]]*)\]\([^)]*\)/g) || []).length;
    const images = (markdown.match(/!\[([^\]]*)\]\([^)]*\)/g) || []).length;
    const codeBlocks = (markdown.match(/```[\s\S]*?```/g) || []).length;

    return {
      characters,
      words,
      lines,
      headings,
      links,
      images,
      codeBlocks
    };
  }
} 