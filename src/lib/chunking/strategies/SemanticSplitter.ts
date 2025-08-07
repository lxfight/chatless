import { ChunkingStrategy, TextChunk, ChunkingOptions } from '../types';

export interface SemanticSplitterOptions extends ChunkingOptions {
  sentenceEnders?: string[];
  paragraphSeparators?: string[];
  preserveFormatting?: boolean;
  minSentenceLength?: number;
}

export class SemanticSplitter implements ChunkingStrategy {
  private readonly defaultSentenceEnders = ['.', '!', '?', '。', '！', '？'];
  private readonly defaultParagraphSeparators = ['\n\n', '\r\n\r\n'];

  private options: SemanticSplitterOptions;

  constructor(options: Partial<SemanticSplitterOptions> = {}) {
    this.options = {
      chunkSize: 1000,
      overlap: 200,
      sentenceEnders: this.defaultSentenceEnders,
      paragraphSeparators: this.defaultParagraphSeparators,
      preserveFormatting: true,
      minSentenceLength: 10,
      ...options,
    };
  }

  chunkText(text: string, options: ChunkingOptions): TextChunk[] {
    const mergedOptions: SemanticSplitterOptions = { 
      ...this.options, 
      ...options 
    };

    // 首先按段落分割
    const paragraphs = this.splitIntoParagraphs(text, mergedOptions);
    const chunks: TextChunk[] = [];
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
      if (paragraph.content.length <= mergedOptions.chunkSize) {
        // 段落足够小，直接作为一个块
        chunks.push(this.createChunk(
          paragraph.content,
          paragraph.startIndex,
          chunkIndex++
        ));
      } else {
        // 段落太大，需要进一步分割
        const paragraphChunks = this.splitParagraphIntoChunks(
          paragraph,
          mergedOptions,
          chunkIndex
        );
        chunks.push(...paragraphChunks);
        chunkIndex += paragraphChunks.length;
      }
    }

    return this.addOverlap(chunks, mergedOptions);
  }

  getName(): string {
    return 'semantic';
  }

  getDefaultOptions(): ChunkingOptions {
    return {
      chunkSize: 1000,
      overlap: 200,
      preserveSentences: true,
      preserveParagraphs: true,
    };
  }

  private splitIntoParagraphs(text: string, options: SemanticSplitterOptions): Array<{content: string, startIndex: number}> {
    const paragraphs: Array<{content: string, startIndex: number}> = [];
    const separators = options.paragraphSeparators || this.defaultParagraphSeparators;
    
    let currentIndex = 0;
    let lastIndex = 0;

    // 使用正则表达式找到所有段落分隔符
    const separatorRegex = new RegExp(separators.map(sep => 
      sep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    ).join('|'), 'g');

    let match;
    while ((match = separatorRegex.exec(text)) !== null) {
      const paragraphContent = text.slice(lastIndex, match.index).trim();
      if (paragraphContent) {
        paragraphs.push({
          content: paragraphContent,
          startIndex: lastIndex
        });
      }
      lastIndex = match.index + match[0].length;
    }

    // 添加最后一个段落
    const lastParagraph = text.slice(lastIndex).trim();
    if (lastParagraph) {
      paragraphs.push({
        content: lastParagraph,
        startIndex: lastIndex
      });
    }

    return paragraphs;
  }

  private splitParagraphIntoChunks(
    paragraph: {content: string, startIndex: number},
    options: SemanticSplitterOptions,
    startChunkIndex: number
  ): TextChunk[] {
    const sentences = this.splitIntoSentences(paragraph.content, options);
    const chunks: TextChunk[] = [];
    let currentChunk = '';
    let currentSentences: string[] = [];
    let chunkIndex = startChunkIndex;

    for (const sentence of sentences) {
      const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;
      
      if (potentialChunk.length <= options.chunkSize) {
        currentChunk = potentialChunk;
        currentSentences.push(sentence);
      } else {
        // 当前块已满，保存并开始新块
        if (currentChunk) {
          chunks.push(this.createChunk(
            currentChunk,
            paragraph.startIndex,
            chunkIndex++
          ));
        }

        // 开始新块
        currentChunk = sentence;
        currentSentences = [sentence];
      }
    }

    // 添加最后一个块
    if (currentChunk) {
      chunks.push(this.createChunk(
        currentChunk,
        paragraph.startIndex,
        chunkIndex
      ));
    }

    return chunks;
  }

  private splitIntoSentences(text: string, options: SemanticSplitterOptions): string[] {
    const sentences: string[] = [];
    const sentenceEnders = options.sentenceEnders || this.defaultSentenceEnders;
    
    // 创建句子结束符的正则表达式
    const enderRegex = new RegExp(`[${sentenceEnders.map(e => 
      e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    ).join('')}]`, 'g');

    let lastIndex = 0;
    let match;

    while ((match = enderRegex.exec(text)) !== null) {
      const sentence = text.slice(lastIndex, match.index + 1).trim();
      if (sentence.length >= (options.minSentenceLength || 10)) {
        sentences.push(sentence);
      }
      lastIndex = match.index + 1;
    }

    // 添加最后一个句子（如果没有以句号结尾）
    const lastSentence = text.slice(lastIndex).trim();
    if (lastSentence && lastSentence.length >= (options.minSentenceLength || 10)) {
      sentences.push(lastSentence);
    }

    return sentences.filter(s => s.length > 0);
  }

  private addOverlap(chunks: TextChunk[], options: SemanticSplitterOptions): TextChunk[] {
    if (!options.overlap || options.overlap === 0 || chunks.length <= 1) {
      return chunks;
    }

    const overlappedChunks: TextChunk[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      let content = chunk.content;

      // 添加前一个块的重叠内容
      if (i > 0) {
        const prevChunk = chunks[i - 1];
        const overlapText = this.getOverlapText(prevChunk.content, options.overlap);
        content = overlapText + ' ' + content;
      }

      overlappedChunks.push({
        ...chunk,
        content,
        metadata: {
          ...chunk.metadata,
          overlap: options.overlap,
        }
      });
    }

    return overlappedChunks;
  }

  private getOverlapText(text: string, overlapSize: number): string {
    if (text.length <= overlapSize) {
      return text;
    }

    // 尝试在句子边界处截断
    const overlapText = text.slice(-overlapSize);
    const sentenceEnders = this.options.sentenceEnders || this.defaultSentenceEnders;
    
    for (const ender of sentenceEnders) {
      const lastIndex = overlapText.lastIndexOf(ender);
      if (lastIndex > 0) {
        return overlapText.slice(lastIndex + 1).trim();
      }
    }

    // 如果没有找到句子边界，在单词边界处截断
    const spaceIndex = overlapText.indexOf(' ');
    if (spaceIndex > 0) {
      return overlapText.slice(spaceIndex + 1);
    }

    return overlapText;
  }

  private createChunk(
    content: string,
    startIndex: number,
    chunkIndex: number
  ): TextChunk {
    const cleanContent = content.trim();
    return {
      id: `semantic-chunk-${chunkIndex}`,
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