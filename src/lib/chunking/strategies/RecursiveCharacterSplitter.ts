import { ChunkingStrategy, TextChunk, ChunkingOptions } from '../types';

export interface RecursiveCharacterSplitterOptions extends ChunkingOptions {
  separators?: string[];
  keepSeparator?: boolean;
  lengthFunction?: (text: string) => number;
}

export class RecursiveCharacterSplitter implements ChunkingStrategy {
  private readonly defaultSeparators = [
    '\n\n',    // 段落分隔
    '\n',      // 行分隔
    ' ',       // 空格分隔
    '',        // 字符分隔
  ];

  private options: RecursiveCharacterSplitterOptions;

  constructor(options: Partial<RecursiveCharacterSplitterOptions> = {}) {
    this.options = {
      chunkSize: 1000,
      overlap: 200,
      separators: this.defaultSeparators,
      keepSeparator: false,
      lengthFunction: (text: string) => text.length,
      ...options,
    };
  }

  chunkText(text: string, options: ChunkingOptions): TextChunk[] {
    // 合并选项
    const mergedOptions: RecursiveCharacterSplitterOptions = { 
      ...this.options, 
      ...options 
    };
    
    const chunks: TextChunk[] = [];
    const splits = this.splitText(text, mergedOptions);
    
    let currentChunk = '';
    let currentStart = 0;
    let chunkIndex = 0;

    for (let i = 0; i < splits.length; i++) {
      const split = splits[i];
      const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + split;
      
      if (this.getLength(potentialChunk, mergedOptions) <= mergedOptions.chunkSize) {
        currentChunk = potentialChunk;
      } else {
        // 当前块已满，保存并开始新块
        if (currentChunk) {
          chunks.push(this.createChunk(
            currentChunk,
            currentStart,
            chunkIndex++
          ));
        }

        // 处理重叠
        const overlapText = this.getOverlapText(currentChunk, mergedOptions);
        currentChunk = overlapText + (overlapText ? ' ' : '') + split;
        currentStart = this.findTextPosition(text, currentChunk, currentStart);
      }
    }

    // 添加最后一个块
    if (currentChunk) {
      chunks.push(this.createChunk(
        currentChunk,
        currentStart,
        chunkIndex
      ));
    }

    return chunks;
  }

  getName(): string {
    return 'recursive-character';
  }

  getDefaultOptions(): ChunkingOptions {
    return {
      chunkSize: 1000,
      overlap: 200,
    };
  }

  private splitText(text: string, options: RecursiveCharacterSplitterOptions): string[] {
    const separators = options.separators || this.defaultSeparators;
    return this.recursiveSplit(text, separators, options);
  }

  private recursiveSplit(text: string, separators: string[], options: RecursiveCharacterSplitterOptions): string[] {
    if (separators.length === 0) {
      return [text];
    }

    const [separator, ...remainingSeparators] = separators;
    const splits: string[] = [];

    if (separator === '') {
      // 字符级分割
      return text.split('');
    }

    const parts = text.split(separator);
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      
      if (this.getLength(part, options) > options.chunkSize) {
        // 部分仍然太大，使用下一个分隔符
        const subSplits = this.recursiveSplit(part, remainingSeparators, options);
        splits.push(...subSplits);
      } else {
        if (options.keepSeparator && i < parts.length - 1) {
          splits.push(part + separator);
        } else {
          splits.push(part);
        }
      }
    }

    return splits.filter(split => split.trim().length > 0);
  }

  private getLength(text: string, options: RecursiveCharacterSplitterOptions): number {
    return options.lengthFunction ? options.lengthFunction(text) : text.length;
  }

  private getOverlapText(text: string, options: RecursiveCharacterSplitterOptions): string {
    const overlapSize = options.overlap || 0;
    if (overlapSize === 0 || text.length <= overlapSize) {
      return text;
    }

    // 尝试在单词边界处截断
    const overlapText = text.slice(-overlapSize);
    const spaceIndex = overlapText.indexOf(' ');
    
    if (spaceIndex > 0) {
      return overlapText.slice(spaceIndex + 1);
    }
    
    return overlapText;
  }

  private findTextPosition(
    fullText: string,
    chunkText: string,
    startFrom: number
  ): number {
    const cleanChunk = chunkText.trim();
    const index = fullText.indexOf(cleanChunk, startFrom);
    return index >= 0 ? index : startFrom;
  }

  private createChunk(
    content: string,
    startIndex: number,
    chunkIndex: number
  ): TextChunk {
    const cleanContent = content.trim();
    return {
      id: `chunk-${chunkIndex}`,
      content: cleanContent,
      startIndex,
      endIndex: startIndex + cleanContent.length,
      metadata: {
        chunkIndex,
        wordCount: cleanContent.split(/\s+/).length,
        characterCount: cleanContent.length,
        overlap: this.options.overlap,
        createdAt: new Date(),
      },
    };
  }
} 