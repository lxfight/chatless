import { DocumentExtractor, DocumentExtractionError, FileReadError } from '../types';
import pdfParse from 'pdf-parse';
import { readFile } from '@tauri-apps/plugin-fs';

/**
 * PDF文档提取器
 * 使用 pdf-parse 库提取PDF文档内容
 */
export class PDFExtractor implements DocumentExtractor {
  supportedTypes = ['pdf'];

  getName(): string {
    return 'PDFExtractor';
  }

  supports(fileType: string): boolean {
    return this.supportedTypes.includes(fileType.toLowerCase());
  }

  async extractText(filePath: string): Promise<string> {
    try {
      console.log(`正在提取PDF文档: ${filePath}`);
      
      // 读取文件内容
      const fileBuffer = await readFile(filePath);
      
      // 使用 pdf-parse 解析PDF
      const pdfData = await pdfParse(fileBuffer);
      
      if (!pdfData.text || pdfData.text.trim().length === 0) {
        console.warn(`PDF文档可能为空或无法提取文本: ${filePath}`);
        return '';
      }

      // 清理文本
      const cleanedText = this.cleanText(pdfData.text);
      
      console.log(`PDF提取完成: ${filePath}, 页数: ${pdfData.numpages}, 文本长度: ${cleanedText.length}`);
      
      return cleanedText;
    } catch (error) {
      console.error(`PDF提取失败: ${filePath}`, error);
      
      if (error instanceof Error) {
        if (error.message.includes('ENOENT') || error.message.includes('not found')) {
          throw new FileReadError(filePath, error);
        } else {
          throw new DocumentExtractionError(
            `PDF解析失败: ${error.message}`,
            'pdf',
            error
          );
        }
      }
      
      throw new DocumentExtractionError(
        `PDF提取过程中发生未知错误: ${String(error)}`,
        'pdf'
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
      // 移除页眉页脚常见模式
      .replace(/^\s*\d+\s*$/gm, '') // 单独的页码行
      // 移除多余的换行
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      // 修复断行的单词
      .replace(/(\w)-\s*\n\s*(\w)/g, '$1$2')
      // 清理首尾空白
      .trim();
  }

  /**
   * 检查PDF文件是否有效
   */
  async validatePDF(filePath: string): Promise<boolean> {
    try {
      const fileBuffer = await readFile(filePath);
      
      // 检查PDF文件头
      const header = new Uint8Array(fileBuffer.slice(0, 5));
      const headerString = String.fromCharCode(...header);
      
      return headerString === '%PDF-';
    } catch {
      return false;
    }
  }

  /**
   * 获取PDF元数据
   */
  async getPDFMetadata(filePath: string): Promise<{
    pages: number;
    title?: string;
    author?: string;
    creator?: string;
    producer?: string;
    creationDate?: Date;
    modificationDate?: Date;
  }> {
    try {
      const fileBuffer = await readFile(filePath);
      const pdfData = await pdfParse(fileBuffer);
      
      return {
        pages: pdfData.numpages,
        title: pdfData.info?.Title,
        author: pdfData.info?.Author,
        creator: pdfData.info?.Creator,
        producer: pdfData.info?.Producer,
        creationDate: pdfData.info?.CreationDate ? new Date(pdfData.info.CreationDate) : undefined,
        modificationDate: pdfData.info?.ModDate ? new Date(pdfData.info.ModDate) : undefined
      };
    } catch (error) {
      console.error(`获取PDF元数据失败: ${filePath}`, error);
      return { pages: 0 };
    }
  }
} 