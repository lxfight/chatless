/**
 * 简化的 Tokenizer 实现
 * 用于 ONNX 嵌入模型的文本预处理
 */

export interface TokenizerResult {
  inputIds: number[];
  attentionMask: number[];
  tokenTypeIds: number[];
}

export class SimpleTokenizer {
  private vocab: Map<string, number> = new Map();
  private readonly maxLength: number;
  private readonly padTokenId: number = 0;
  private readonly clsTokenId: number = 101;
  private readonly sepTokenId: number = 102;
  private readonly unkTokenId: number = 100;

  constructor(maxLength: number = 512) {
    this.maxLength = maxLength;
    this.initializeVocab();
  }

  /**
   * 初始化简化的词汇表
   */
  private initializeVocab() {
    // 特殊 tokens
    this.vocab.set('[PAD]', 0);
    this.vocab.set('[UNK]', 100);
    this.vocab.set('[CLS]', 101);
    this.vocab.set('[SEP]', 102);
    
    // 基本字符和常用词汇
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?-';
    for (let i = 0; i < chars.length; i++) {
      this.vocab.set(chars[i], 1000 + i);
    }

    // 常用英文单词
    const commonWords = [
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'can', 'may', 'might', 'must',
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
      'this', 'that', 'these', 'those', 'what', 'which', 'who', 'when', 'where', 'why', 'how',
      'not', 'no', 'yes', 'all', 'any', 'some', 'many', 'much', 'few', 'little',
      'good', 'bad', 'big', 'small', 'new', 'old', 'first', 'last', 'long', 'short',
      'about', 'after', 'before', 'during', 'through', 'over', 'under', 'up', 'down',
      'here', 'there', 'now', 'then', 'today', 'tomorrow', 'yesterday',
      'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'
    ];

    for (let i = 0; i < commonWords.length; i++) {
      this.vocab.set(commonWords[i], 2000 + i);
    }
  }

  /**
   * 编码文本为 token IDs
   */
  encode(text: string): TokenizerResult {
    // 文本预处理
    const normalizedText = text.toLowerCase().trim();
    
    // 简单的单词分割
    const words = this.tokenize(normalizedText);
    
    // 转换为 token IDs
    let inputIds = [this.clsTokenId]; // 开始 token
    
    for (const word of words) {
      if (inputIds.length >= this.maxLength - 1) { // 为 SEP token 预留空间
        break;
      }
      
      const tokenId = this.vocab.get(word) || this.unkTokenId;
      inputIds.push(tokenId);
    }
    
    // 添加结束 token
    if (inputIds.length < this.maxLength) {
      inputIds.push(this.sepTokenId);
    }
    
    // 填充到最大长度
    while (inputIds.length < this.maxLength) {
      inputIds.push(this.padTokenId);
    }
    
    // 创建 attention mask
    const attentionMask = inputIds.map(id => id === this.padTokenId ? 0 : 1);
    
    // 创建 token type ids (对于单句任务，全部设为0)
    const tokenTypeIds = new Array(this.maxLength).fill(0);
    
    return {
      inputIds: inputIds.slice(0, this.maxLength),
      attentionMask: attentionMask.slice(0, this.maxLength),
      tokenTypeIds: tokenTypeIds
    };
  }

  /**
   * 简单的文本分词
   */
  private tokenize(text: string): string[] {
    const tokens: string[] = [];
    let currentWord = '';
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      if (char === ' ') {
        if (currentWord) {
          // 检查是否为已知单词
          if (this.vocab.has(currentWord)) {
            tokens.push(currentWord);
          } else {
            // 分解为字符
            for (const c of currentWord) {
              tokens.push(c);
            }
          }
          currentWord = '';
        }
      } else if (/[.,!?;:]/.test(char)) {
        // 处理标点符号
        if (currentWord) {
          if (this.vocab.has(currentWord)) {
            tokens.push(currentWord);
          } else {
            for (const c of currentWord) {
              tokens.push(c);
            }
          }
          currentWord = '';
        }
        tokens.push(char);
      } else {
        currentWord += char;
      }
    }
    
    // 处理最后一个单词
    if (currentWord) {
      if (this.vocab.has(currentWord)) {
        tokens.push(currentWord);
      } else {
        for (const c of currentWord) {
          tokens.push(c);
        }
      }
    }
    
    return tokens;
  }

  /**
   * 获取词汇表大小
   */
  getVocabSize(): number {
    return this.vocab.size;
  }

  /**
   * 检查 token 是否存在
   */
  hasToken(token: string): boolean {
    return this.vocab.has(token);
  }

  /**
   * 获取 token ID
   */
  getTokenId(token: string): number {
    return this.vocab.get(token) || this.unkTokenId;
  }
} 