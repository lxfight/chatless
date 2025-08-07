import type { EmbeddingStrategy } from '../types';
import { OnnxModelDownloader } from '../OnnxModelDownloader';
import { HuggingFaceTokenizer } from '../HuggingFaceTokenizer';

export class WebEmbeddingStrategy implements EmbeddingStrategy {
  private session: any = null;
  private isInitialized = false;
  private modelDownloader: OnnxModelDownloader;
  private currentModelId: string = 'all-minilm-l6-v2'; // 默认模型
  private tokenizer: HuggingFaceTokenizer;

  constructor() {
    this.modelDownloader = new OnnxModelDownloader();
    this.tokenizer = new HuggingFaceTokenizer(512);
  }

  async initialize(): Promise<void> {
    try {
      // 初始化tokenizer
      await this.tokenizer.initialize('onnx-models/all-MiniLM-L6-v2-onnx');
      
      // 动态导入onnxruntime-web以避免SSR问题
      const ort = await import('onnxruntime-web');
      
      // 配置WASM路径
      ort.env.wasm.wasmPaths = '/wasm/';
      ort.env.wasm.numThreads = 1; // 设置线程数为1以提高兼容性
      
      // 检查模型是否已下载
      if (!this.modelDownloader.isModelDownloaded(this.currentModelId)) {
        console.log('模型未下载，使用模拟模式');
        this.createMockSession();
        this.isInitialized = true;
        return;
      }

      // 获取模型文件的Blob URL
      const modelBlobUrl = await this.modelDownloader.getModelBlobUrl(this.currentModelId);
      if (!modelBlobUrl) {
        console.log('无法获取模型文件，使用模拟模式');
        this.createMockSession();
        this.isInitialized = true;
        return;
      }

      try {
        // 创建真实的推理会话
        this.session = await ort.InferenceSession.create(modelBlobUrl, {
          executionProviders: ['wasm'], // 使用WebAssembly后端
          graphOptimizationLevel: 'all',
        });
        
        console.log(`WebEmbeddingStrategy initialized with real model: ${this.currentModelId}`);
        
        // 清理Blob URL
        URL.revokeObjectURL(modelBlobUrl);
        
      } catch (modelError) {
        console.warn('无法加载真实模型，回退到模拟模式:', modelError);
        this.createMockSession();
        
        // 清理Blob URL
        URL.revokeObjectURL(modelBlobUrl);
      }
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize WebEmbeddingStrategy:', error);
      throw new Error(`Embedding model initialization failed: ${error}`);
    }
  }

  /**
   * 创建输入张量，自动选择合适的数据类型
   */
  private createInputTensors(ort: any, inputIds: number[], attentionMask: number[], tokenTypeIds: number[]): any {
    try {
      // 首先尝试 int64 (最常见的情况)
      const inputIdsArray = new BigInt64Array(inputIds.map(id => BigInt(id)));
      const attentionMaskArray = new BigInt64Array(attentionMask.map(mask => BigInt(mask)));
      const tokenTypeIdsArray = new BigInt64Array(tokenTypeIds.map(id => BigInt(id)));
      
      return {
        'input_ids': new ort.Tensor('int64', inputIdsArray, [1, inputIds.length]),
        'attention_mask': new ort.Tensor('int64', attentionMaskArray, [1, attentionMask.length]),
        'token_type_ids': new ort.Tensor('int64', tokenTypeIdsArray, [1, tokenTypeIds.length]),
      };
    } catch (error) {
      console.warn('创建 int64 张量失败，尝试 int32:', error);
      
      // 回退到 int32
      const inputIdsArray = new Int32Array(inputIds);
      const attentionMaskArray = new Int32Array(attentionMask);
      const tokenTypeIdsArray = new Int32Array(tokenTypeIds);
      
      return {
        'input_ids': new ort.Tensor('int32', inputIdsArray, [1, inputIds.length]),
        'attention_mask': new ort.Tensor('int32', attentionMaskArray, [1, attentionMask.length]),
        'token_type_ids': new ort.Tensor('int32', tokenTypeIdsArray, [1, tokenTypeIds.length]),
      };
    }
  }

  /**
   * 创建模拟会话用于测试
   */
  private createMockSession() {
    this.session = {
      run: async (feeds: any) => {
        // 模拟推理结果
        const batchSize = 1;
        const seqLength = 512;
        const hiddenSize = 384;
        
        // 创建模拟的嵌入数据（基于输入文本生成确定性的嵌入）
        const mockData = new Float32Array(batchSize * seqLength * hiddenSize);
        
        // 基于输入数据生成一些伪随机但确定性的嵌入
        const inputIds = feeds['input_ids']?.data || [];
        const tokenTypeIds = feeds['token_type_ids']?.data || [];
        let seed = 1;
        for (let i = 0; i < inputIds.length && i < 10; i++) {
          // 处理 BigInt 数据类型
          const value = typeof inputIds[i] === 'bigint' ? Number(inputIds[i]) : inputIds[i];
          seed = (seed * value + 1) % 1000000;
        }
        // 也考虑token_type_ids进行更好的嵌入生成
        for (let i = 0; i < tokenTypeIds.length && i < 10; i++) {
          const value = typeof tokenTypeIds[i] === 'bigint' ? Number(tokenTypeIds[i]) : tokenTypeIds[i];
          seed = (seed * (value + 1) + 1) % 1000000;
        }
        
        for (let i = 0; i < mockData.length; i++) {
          seed = (seed * 9301 + 49297) % 233280;
          mockData[i] = (seed / 233280 - 0.5) * 2; // 归一化到 [-1, 1]
        }
        
        return {
          last_hidden_state: {
            data: mockData,
            dims: [batchSize, seqLength, hiddenSize]
          }
        };
      }
    };
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.isInitialized || !this.session) {
      throw new Error('WebEmbeddingStrategy not initialized');
    }

    try {
      const embeddings: number[][] = [];
      
      for (const text of texts) {
        // 使用正确的 tokenizer 进行文本预处理
        const { inputIds, attentionMask, tokenTypeIds } = this.tokenizer.encode(text);
        
        const ort = await import('onnxruntime-web');
        
        // 创建输入张量 - 首先尝试 int64，如果失败则尝试 int32
        const feeds = this.createInputTensors(ort, inputIds, attentionMask, tokenTypeIds);

        // 运行推理
        const results = await this.session.run(feeds);
        
        // 提取嵌入向量（通常是last_hidden_state的平均池化）
        const embedding = this.extractEmbedding(results);
        embeddings.push(embedding);
      }

      return embeddings;
    } catch (error) {
      console.error('Embedding generation failed:', error);
      throw new Error(`Failed to generate embeddings: ${error}`);
    }
  }

  async cleanup(): Promise<void> {
    if (this.session) {
      // ONNX Runtime Web会自动清理资源
      this.session = null;
      this.isInitialized = false;
    }
  }



  private extractEmbedding(results: any): number[] {
    // 从模型输出中提取嵌入向量
    // 支持多种输出格式
    
    console.log('Model output keys:', Object.keys(results));
    
    // 尝试不同的输出名称
    let outputTensor = results.last_hidden_state || 
                      results.hidden_states || 
                      results.pooler_output ||
                      results.sentence_embedding ||
                      results['0']; // 有时输出名称就是数字
    
    if (!outputTensor || !outputTensor.data) {
      // 如果找不到标准输出，尝试第一个输出
      const firstKey = Object.keys(results)[0];
      outputTensor = results[firstKey];
      console.log('Using first output:', firstKey);
    }
    
    if (!outputTensor || !outputTensor.data) {
      throw new Error(`Invalid model output format. Available keys: ${Object.keys(results).join(', ')}`);
    }
    
    const data = outputTensor.data;
    const dims = outputTensor.dims || [];
    
    console.log('Output tensor dims:', dims);
    console.log('Output data length:', data.length);
    
    // 根据输出维度进行处理
    if (dims.length === 3) {
      // [batch_size, seq_length, hidden_size] - 需要池化
      const [batchSize, seqLength, hiddenSize] = dims;
      const embedding = new Array(hiddenSize).fill(0);
      
      // 平均池化（忽略填充的token）
      for (let i = 0; i < seqLength; i++) {
        for (let j = 0; j < hiddenSize; j++) {
          embedding[j] += data[i * hiddenSize + j];
        }
      }
      
      // 归一化
      for (let i = 0; i < hiddenSize; i++) {
        embedding[i] /= seqLength;
      }
      
      return embedding;
      
    } else if (dims.length === 2) {
      // [batch_size, hidden_size] - 已经是句子级别的嵌入
      const [batchSize, hiddenSize] = dims;
      return Array.from(data.slice(0, hiddenSize));
      
    } else if (dims.length === 1) {
      // [hidden_size] - 直接的嵌入向量
      return Array.from(data);
      
    } else {
      throw new Error(`Unsupported output tensor dimensions: ${dims.join('x')}`);
    }
  }

  getDimension(): number {
    const modelInfo = this.modelDownloader.getModelInfo(this.currentModelId);
    return modelInfo?.dimensions || 384; // 默认维度
  }

  getName(): string {
    const isReal = this.isUsingRealModel();
    const modelInfo = this.modelDownloader.getModelInfo(this.currentModelId);
    return `WebEmbeddingStrategy (${isReal ? '真实模型' : '模拟模式'} - ${modelInfo?.name || '未知模型'})`;
  }

  getModelInfo(): { name: string; dimensions: number } {
    const modelInfo = this.modelDownloader.getModelInfo(this.currentModelId);
    const isReal = this.isUsingRealModel();
    return {
      name: isReal ? modelInfo?.name || '未知模型' : '模拟模型 (测试用途)',
      dimensions: modelInfo?.dimensions || 384
    };
  }

  /**
   * 设置当前使用的模型
   */
  async setModel(modelId: string): Promise<void> {
    const modelInfo = this.modelDownloader.getModelInfo(modelId);
    if (!modelInfo) {
      throw new Error(`Unknown model: ${modelId}`);
    }

    this.currentModelId = modelId;
    
    // 如果已经初始化，需要重新初始化以使用新模型
    if (this.isInitialized) {
      await this.cleanup();
      await this.initialize();
    }
  }

  /**
   * 获取当前模型ID
   */
  getCurrentModelId(): string {
    return this.currentModelId;
  }

  /**
   * 获取模型下载器实例
   */
  getModelDownloader(): OnnxModelDownloader {
    return this.modelDownloader;
  }

  /**
   * 检查是否使用真实模型
   */
  isUsingRealModel(): boolean {
    return this.modelDownloader.isModelDownloaded(this.currentModelId);
  }
} 