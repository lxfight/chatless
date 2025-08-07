import { DocumentExtractor, DocumentExtractionError, FileReadError } from '../types';
import { readTextFile } from '@tauri-apps/plugin-fs';

/**
 * 纯文本文档提取器
 * 处理 .txt 等纯文本文件
 */
export class TextExtractor implements DocumentExtractor {
  supportedTypes = ['txt', 'text', 'log', 'csv', 'json', 'xml', 'html', 'css', 'js', 'ts', 'py', 'java', 'cpp', 'c', 'h'];

  getName(): string {
    return 'TextExtractor';
  }

  supports(fileType: string): boolean {
    return this.supportedTypes.includes(fileType.toLowerCase());
  }

  async extractText(filePath: string): Promise<string> {
    try {
      console.log(`正在提取文本文档: ${filePath}`);
      
      // 使用 Tauri 的 readTextFile API 读取文本文件
      const text = await readTextFile(filePath);
      
      if (!text || text.trim().length === 0) {
        console.warn(`文本文档为空: ${filePath}`);
        return '';
      }

      // 清理文本
      const cleanedText = this.cleanText(text);
      
      console.log(`文本提取完成: ${filePath}, 文本长度: ${cleanedText.length}`);
      
      return cleanedText;
    } catch (error) {
      console.error(`文本提取失败: ${filePath}`, error);
      
      if (error instanceof Error) {
        if (error.message.includes('ENOENT') || error.message.includes('not found')) {
          throw new FileReadError(filePath, error);
        } else if (error.message.includes('encoding') || error.message.includes('decode')) {
          throw new DocumentExtractionError(
            `文本编码错误: ${error.message}`,
            this.getFileType(filePath),
            error
          );
        } else {
          throw new DocumentExtractionError(
            `文本读取失败: ${error.message}`,
            this.getFileType(filePath),
            error
          );
        }
      }
      
      throw new DocumentExtractionError(
        `文本提取过程中发生未知错误: ${String(error)}`,
        this.getFileType(filePath)
      );
    }
  }

  /**
   * 清理提取的文本
   */
  private cleanText(text: string): string {
    const fileType = this.getFileType(text);
    
    // 根据文件类型进行特殊处理
    switch (fileType) {
      case 'json':
        return this.cleanJSON(text);
      case 'xml':
      case 'html':
        return this.cleanMarkup(text);
      case 'csv':
        return this.cleanCSV(text);
      case 'js':
      case 'ts':
      case 'py':
      case 'java':
      case 'cpp':
      case 'c':
      case 'h':
        return this.cleanCode(text);
      default:
        return this.cleanPlainText(text);
    }
  }

  /**
   * 清理普通文本
   */
  private cleanPlainText(text: string): string {
    return text
      // 标准化换行符
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // 移除多余的空白行
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      // 清理首尾空白
      .trim();
  }

  /**
   * 清理JSON文本
   */
  private cleanJSON(text: string): string {
    try {
      // 尝试解析JSON并重新格式化
      const parsed = JSON.parse(text);
      return JSON.stringify(parsed, null, 2);
    } catch {
      // 如果解析失败，按普通文本处理
      return this.cleanPlainText(text);
    }
  }

  /**
   * 清理标记语言文本（HTML/XML）
   */
  private cleanMarkup(text: string): string {
    return text
      // 移除HTML/XML标签，保留内容
      .replace(/<[^>]*>/g, ' ')
      // 解码HTML实体
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // 清理多余空白
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 清理CSV文本
   */
  private cleanCSV(text: string): string {
    return text
      // 标准化换行符
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // 移除空行
      .split('\n')
      .filter(line => line.trim().length > 0)
      .join('\n')
      .trim();
  }

  /**
   * 清理代码文本
   */
  private cleanCode(text: string): string {
    return text
      // 标准化换行符
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // 保持代码格式，只清理首尾空白
      .trim();
  }

  /**
   * 获取文件类型
   */
  private getFileType(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase();
    return extension || '';
  }

  /**
   * 检测文本编码
   */
  async detectEncoding(filePath: string): Promise<string> {
    try {
      // 简单的编码检测
      // 在实际应用中，可能需要更复杂的编码检测库
      const text = await readTextFile(filePath);
      
      // 检查是否包含中文字符
      if (/[\u4e00-\u9fff]/.test(text)) {
        return 'utf-8';
      }
      
      return 'utf-8'; // 默认返回UTF-8
    } catch {
      return 'utf-8';
    }
  }

  /**
   * 获取文本统计信息
   */
  getTextStats(text: string): {
    characters: number;
    words: number;
    lines: number;
    paragraphs: number;
  } {
    const lines = text.split('\n').length;
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
    const words = text.trim().split(/\s+/).filter(word => word.length > 0).length;
    const characters = text.length;

    return {
      characters,
      words,
      lines,
      paragraphs
    };
  }
} 