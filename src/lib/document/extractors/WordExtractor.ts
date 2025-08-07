import { DocumentExtractor, DocumentExtractionError, FileReadError } from '../types';
import * as mammoth from 'mammoth';
import { readFile } from '@tauri-apps/plugin-fs';

/**
 * Word文档提取器
 * 使用 mammoth 库提取Word文档内容
 */
export class WordExtractor implements DocumentExtractor {
  supportedTypes = ['doc', 'docx'];

  getName(): string {
    return 'WordExtractor';
  }

  supports(fileType: string): boolean {
    return this.supportedTypes.includes(fileType.toLowerCase());
  }

  async extractText(filePath: string): Promise<string> {
    try {
      console.log(`正在提取Word文档: ${filePath}`);
      
      // 读取文件内容
      const fileBuffer = await readFile(filePath);
      
      // 使用 mammoth 解析Word文档
      const result = await mammoth.extractRawText({ 
        buffer: Buffer.from(fileBuffer) 
      });
      
      if (result.messages && result.messages.length > 0) {
        console.warn(`Word文档解析警告: ${filePath}`, result.messages);
      }

      if (!result.value || result.value.trim().length === 0) {
        console.warn(`Word文档可能为空或无法提取文本: ${filePath}`);
        return '';
      }

      // 清理文本
      const cleanedText = this.cleanText(result.value);
      
      console.log(`Word提取完成: ${filePath}, 文本长度: ${cleanedText.length}`);
      
      return cleanedText;
    } catch (error) {
      console.error(`Word提取失败: ${filePath}`, error);
      
      if (error instanceof Error) {
        if (error.message.includes('ENOENT') || error.message.includes('not found')) {
          throw new FileReadError(filePath, error);
        } else {
          throw new DocumentExtractionError(
            `Word解析失败: ${error.message}`,
            this.getFileType(filePath),
            error
          );
        }
      }
      
      throw new DocumentExtractionError(
        `Word提取过程中发生未知错误: ${String(error)}`,
        this.getFileType(filePath)
      );
    }
  }

  /**
   * 提取Word文档为HTML格式
   */
  async extractHTML(filePath: string): Promise<string> {
    try {
      const fileBuffer = await readFile(filePath);
      
      const result = await mammoth.convertToHtml({ 
        buffer: Buffer.from(fileBuffer) 
      });
      
      if (result.messages && result.messages.length > 0) {
        console.warn(`Word转HTML警告: ${filePath}`, result.messages);
      }

      return result.value;
    } catch (error) {
      console.error(`Word转HTML失败: ${filePath}`, error);
      throw new DocumentExtractionError(
        `Word转HTML失败: ${error instanceof Error ? error.message : String(error)}`,
        this.getFileType(filePath),
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 清理提取的文本
   */
  private cleanText(text: string): string {
    return text
      // 移除多余的空白字符
      .replace(/\s+/g, ' ')
      // 移除多余的换行
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      // 清理首尾空白
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
   * 检查Word文件是否有效
   */
  async validateWordFile(filePath: string): Promise<boolean> {
    try {
      const fileBuffer = await readFile(filePath);
      const fileType = this.getFileType(filePath);
      
      if (fileType === 'docx') {
        // DOCX文件是ZIP格式，检查ZIP文件头
        const header = new Uint8Array(fileBuffer.slice(0, 4));
        return header[0] === 0x50 && header[1] === 0x4B; // PK
      } else if (fileType === 'doc') {
        // DOC文件检查OLE文件头
        const header = new Uint8Array(fileBuffer.slice(0, 8));
        return header[0] === 0xD0 && header[1] === 0xCF && 
               header[2] === 0x11 && header[3] === 0xE0;
      }
      
      return false;
    } catch {
      return false;
    }
  }
} 