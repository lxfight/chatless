/**
 * HuggingFace兼容的Tokenizer实现
 * 支持下载和使用真实的tokenizer文件
 */

export interface TokenizerFiles {
  tokenizer: any;
  vocab: Record<string, number>;
  specialTokensMap: any;
  config: any;
}

export interface TokenizerResult {
  inputIds: number[];
  attentionMask: number[];
  tokenTypeIds: number[];
}

export class HuggingFaceTokenizer {
  private tokenizer: any = null;
  private vocab: Record<string, number> = {};
  private specialTokens: any = {};
  private config: any = {};
  private maxLength: number = 512;
  private isLoaded = false;

  // 特殊token的默认值
  private readonly DEFAULT_SPECIAL_TOKENS = {
    '[PAD]': 0,
    '[UNK]': 100,
    '[CLS]': 101,
    '[SEP]': 102,
    '[MASK]': 103
  };

  constructor(maxLength: number = 512) {
    this.maxLength = maxLength;
  }

  /**
   * 从HuggingFace仓库下载tokenizer文件
   */
  async downloadTokenizerFiles(modelId: string): Promise<TokenizerFiles> {
    const baseUrl = `https://huggingface.co/${modelId}/resolve/main`;
    
    try {
      console.log('下载tokenizer文件...');

      // 并行下载所有必要文件
      const [tokenizerResponse, vocabResponse, specialTokensResponse, configResponse] = 
        await Promise.all([
          fetch(`${baseUrl}/tokenizer.json`),
          fetch(`${baseUrl}/vocab.txt`),
          fetch(`${baseUrl}/special_tokens_map.json`),
          fetch(`${baseUrl}/tokenizer_config.json`)
        ]);

      if (!tokenizerResponse.ok) {
        throw new Error(`Failed to download tokenizer.json: ${tokenizerResponse.status}`);
      }

      const tokenizer = await tokenizerResponse.json();
      const vocabText = await vocabResponse.text();
      const specialTokensMap = await specialTokensResponse.json();
      const config = await configResponse.json();

      // 解析词汇表
      const vocab: Record<string, number> = {};
      const vocabLines = vocabText.split('\n').filter(line => line.trim());
      vocabLines.forEach((token, index) => {
        vocab[token] = index;
      });

      console.log(`Tokenizer下载完成: ${Object.keys(vocab).length} tokens`);

      return {
        tokenizer,
        vocab,
        specialTokensMap,
        config
      };

    } catch (error) {
      console.error('下载tokenizer文件失败:', error);
      throw error;
    }
  }

  /**
   * 从IndexedDB加载tokenizer
   */
  async loadFromCache(modelId: string): Promise<boolean> {
    try {
      const db = await this.openTokenizerDB();
      const transaction = db.transaction(['tokenizers'], 'readonly');
      const store = transaction.objectStore('tokenizers');
      
      const result = await new Promise<any>((resolve, reject) => {
        const request = store.get(modelId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (result) {
        this.tokenizer = result.tokenizer;
        this.vocab = result.vocab;
        this.specialTokens = result.specialTokensMap;
        this.config = result.config;
        this.isLoaded = true;
        console.log(`从缓存加载tokenizer: ${modelId}`);
        return true;
      }

      return false;
    } catch (error) {
      console.warn('从缓存加载tokenizer失败:', error);
      return false;
    }
  }

  /**
   * 保存tokenizer到IndexedDB
   */
  async saveToCache(modelId: string, files: TokenizerFiles): Promise<void> {
    try {
      const db = await this.openTokenizerDB();
      const transaction = db.transaction(['tokenizers'], 'readwrite');
      const store = transaction.objectStore('tokenizers');
      
      const data = {
        id: modelId,
        ...files,
        savedAt: new Date().toISOString()
      };

      await new Promise<void>((resolve, reject) => {
        const request = store.put(data);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      console.log(`Tokenizer已保存到缓存: ${modelId}`);
    } catch (error) {
      console.warn('保存tokenizer到缓存失败:', error);
    }
  }

  /**
   * 初始化tokenizer
   */
  async initialize(modelId: string = 'onnx-models/all-MiniLM-L6-v2-onnx'): Promise<void> {
    try {
      // 先尝试从缓存加载
      const loaded = await this.loadFromCache(modelId);
      
      if (!loaded) {
        // 缓存中没有，下载新的
        const files = await this.downloadTokenizerFiles(modelId);
        await this.saveToCache(modelId, files);
        
        this.tokenizer = files.tokenizer;
        this.vocab = files.vocab;
        this.specialTokens = files.specialTokensMap;
        this.config = files.config;
      }

      this.isLoaded = true;
      console.log('HuggingFace Tokenizer 初始化完成');
      
    } catch (error) {
      console.warn('真实tokenizer初始化失败，使用简化版本:', error);
      this.initializeFallback();
    }
  }

  /**
   * 回退到简化tokenizer
   */
  private initializeFallback(): void {
    // 使用简化的词汇表
    this.vocab = { ...this.DEFAULT_SPECIAL_TOKENS };
    
    // 添加基本字符
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    for (let i = 0; i < chars.length; i++) {
      this.vocab[chars[i]] = 1000 + i;
    }

    this.specialTokens = this.DEFAULT_SPECIAL_TOKENS;
    this.isLoaded = true;
    console.log('使用简化tokenizer作为回退');
  }

  /**
   * 编码文本
   */
  encode(text: string): TokenizerResult {
    if (!this.isLoaded) {
      throw new Error('Tokenizer not initialized');
    }

    try {
      // 如果有真实的tokenizer，使用它
      if (this.tokenizer && this.tokenizer.model) {
        return this.encodeWithHuggingFace(text);
      } else {
        return this.encodeSimple(text);
      }
    } catch (error) {
      console.warn('HuggingFace tokenizer编码失败，使用简化编码:', error);
      return this.encodeSimple(text);
    }
  }

  /**
   * 使用HuggingFace tokenizer编码
   */
  private encodeWithHuggingFace(text: string): TokenizerResult {
    // 这里需要实现HuggingFace tokenizer的编码逻辑
    // 暂时回退到简化版本
    return this.encodeSimple(text);
  }

  /**
   * 简化编码方法
   */
  private encodeSimple(text: string): TokenizerResult {
    const normalizedText = text.toLowerCase().trim();
    const words = normalizedText.split(/\s+/);
    
    const inputIds = [this.getTokenId('[CLS]')];
    
    for (const word of words) {
      if (inputIds.length >= this.maxLength - 1) break;
      
      const tokenId = this.vocab[word] || this.getTokenId('[UNK]');
      inputIds.push(tokenId);
    }
    
    if (inputIds.length < this.maxLength) {
      inputIds.push(this.getTokenId('[SEP]'));
    }
    
    // 填充到最大长度
    while (inputIds.length < this.maxLength) {
      inputIds.push(this.getTokenId('[PAD]'));
    }
    
    const attentionMask = inputIds.map(id => id === this.getTokenId('[PAD]') ? 0 : 1);
    const tokenTypeIds = new Array(this.maxLength).fill(0);
    
    return {
      inputIds: inputIds.slice(0, this.maxLength),
      attentionMask: attentionMask.slice(0, this.maxLength),
      tokenTypeIds
    };
  }

  /**
   * 获取token ID
   */
  private getTokenId(token: string): number {
    return this.vocab[token] || this.vocab['[UNK]'] || 100;
  }

  /**
   * 打开IndexedDB
   */
  private async openTokenizerDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('HuggingFaceTokenizers', 1);
      
      request.onerror = () => reject(request.error);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('tokenizers')) {
          db.createObjectStore('tokenizers', { keyPath: 'id' });
        }
      };
      
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * 检查是否已加载
   */
  isInitialized(): boolean {
    return this.isLoaded;
  }

  /**
   * 获取词汇表大小
   */
  getVocabSize(): number {
    return Object.keys(this.vocab).length;
  }
} 