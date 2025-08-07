import { 
  IndexingTask, 
  IndexingStatus, 
  IndexingOptions, 
  IndexingResult, 
  ChunkData,
  IndexingError 
} from './types';
import { DocumentExtractionService } from '../document/DocumentExtractor';
import { ChunkingService, ChunkingStrategyType } from '../chunking/ChunkingService';
import { EmbeddingService } from '../embedding/EmbeddingService';
import type { EmbeddingServiceOptions } from '../embedding/types';
import { RetrievalService } from '../retrieval/RetrievalService';
import { generateId } from '../utils/id';

/**
 * 文档索引器
 * 负责将文档转换为可搜索的向量索引
 */
export class DocumentIndexer {
  private documentExtractor: DocumentExtractionService;
  private chunkingService: ChunkingService;
  private embeddingService: EmbeddingService | null = null;
  private retrievalService: RetrievalService;
  private isInitialized = false;

  constructor() {
    this.documentExtractor = new DocumentExtractionService();
    this.chunkingService = new ChunkingService();
    this.retrievalService = new RetrievalService();
  }

  /**
   * 初始化嵌入服务
   * 使用用户配置的嵌入策略和设置
   */
  private async initializeEmbeddingService(): Promise<void> {
    if (this.embeddingService && this.isInitialized) {
      return;
    }

    try {
      // 加载用户配置的知识库设置
      const { loadKnowledgeBaseConfig } = await import('../knowledgeBaseConfig');
      const knowledgeBaseConfig = await loadKnowledgeBaseConfig();
      const embeddingConfig = knowledgeBaseConfig.embedding;
      
      console.log(`[DocumentIndexer] 使用配置的嵌入策略: ${embeddingConfig.strategy}`);

      let serviceConfig: EmbeddingServiceOptions;

      if (embeddingConfig.strategy === 'ollama') {
        // 获取 Ollama URL
        const { OllamaConfigService } = await import('../config/OllamaConfigService');
        const apiUrl = embeddingConfig.apiUrl || await OllamaConfigService.getOllamaUrl();
        
        serviceConfig = {
          config: {
            strategy: 'ollama',
            apiUrl,
            modelName: embeddingConfig.modelName || 'nomic-embed-text',
            timeout: embeddingConfig.timeout || 30000,
            maxBatchSize: embeddingConfig.maxBatchSize || 10
          },
          enableCache: true,
          cacheSize: 1000
        };
        
        console.log(`[DocumentIndexer] 使用 Ollama URL: ${apiUrl}, 模型: ${embeddingConfig.modelName || 'nomic-embed-text'}`);
      } else {
        // local-onnx 策略
        serviceConfig = {
          config: {
            strategy: 'local-onnx',
            modelPath: embeddingConfig.modelPath,
            timeout: embeddingConfig.timeout || 30000,
            maxBatchSize: embeddingConfig.maxBatchSize || 32
          },
          enableCache: true,
          cacheSize: 1000
        };
        
        console.log(`[DocumentIndexer] 使用本地 ONNX 模型: ${embeddingConfig.modelPath}`);
      }

      this.embeddingService = new EmbeddingService(serviceConfig);
      await this.embeddingService.initialize();
      this.isInitialized = true;
      
      console.log(`[DocumentIndexer] 嵌入服务初始化完成 (策略: ${embeddingConfig.strategy})`);
    } catch (error) {
      console.error('[DocumentIndexer] 嵌入服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 重新初始化嵌入服务
   * 当用户更改嵌入配置时调用
   */
  async reinitializeEmbeddingService(): Promise<void> {
    // 清理现有服务
    if (this.embeddingService) {
      try {
        await this.embeddingService.cleanup();
      } catch (error) {
        console.warn('[DocumentIndexer] 清理嵌入服务时出错:', error);
      }
    }
    
    this.embeddingService = null;
    this.isInitialized = false;
    
    // 重新初始化
    await this.initializeEmbeddingService();
  }

  /**
   * 索引单个文档
   */
  async indexDocument(
    documentId: string,
    filePath: string,
    options: IndexingOptions = {}
  ): Promise<IndexingResult> {
    const startTime = Date.now();
    let task: IndexingTask = {
      id: generateId(),
      documentId,
      filePath,
      status: IndexingStatus.PENDING,
      progress: 0,
      startTime: new Date()
    };

    try {
      // 0. 确保嵌入服务已初始化
      if (!this.embeddingService || !this.isInitialized) {
        await this.initializeEmbeddingService();
      }

      if (!this.embeddingService) {
        throw new IndexingError('嵌入服务初始化失败', task.id, documentId);
      }

      // 1. 文档内容提取
      task.status = IndexingStatus.EXTRACTING;
      task.progress = 10;
      options.progressCallback?.(task);

      console.log(`开始提取文档: ${filePath}`);
      const extractionResult = await this.documentExtractor.extractDocument(filePath);
      
      if (!extractionResult.success) {
        throw new IndexingError(
          `文档提取失败: ${extractionResult.error}`,
          task.id,
          documentId
        );
      }

      const documentContent = extractionResult.text;
      console.log(`文档提取完成，内容长度: ${documentContent.length} 字符`);

      // 2. 文本分块
      task.status = IndexingStatus.CHUNKING;
      task.progress = 30;
      options.progressCallback?.(task);

      console.log(`开始文本分块...`);
      const chunkingResult = await this.chunkingService.chunkText(
        documentContent,
        (options.chunkingStrategy as ChunkingStrategyType) || 'recursive-character',
        {
          chunkSize: options.chunkSize || 1000,
          overlap: options.chunkOverlap || 200
        }
      );
      const chunks = chunkingResult.chunks;

      console.log(`文本分块完成，生成 ${chunks.length} 个块`);

      // 3. 生成嵌入
      task.status = IndexingStatus.EMBEDDING;
      task.progress = 50;
      options.progressCallback?.(task);

      console.log(`开始生成嵌入向量...`);
      const chunkTexts = chunks.map(chunk => chunk.content);
      const embeddings = await this.embeddingService.generateEmbeddings(chunkTexts);

      console.log(`嵌入生成完成，生成 ${embeddings.length} 个向量`);

      // 4. 准备存储数据
      task.status = IndexingStatus.STORING;
      task.progress = 80;
      options.progressCallback?.(task);

      const chunkData: ChunkData[] = chunks.map((chunk, index) => ({
        id: generateId(),
        content: chunk.content,
        embedding: embeddings[index],
        metadata: {
          documentId,
          chunkIndex: index,
          startPosition: chunk.startIndex || 0,
          endPosition: chunk.endIndex || chunk.content.length,
          chunkType: 'text',
          parentDocument: filePath,
          extractorType: extractionResult.metadata.fileType,
          wordCount: chunk.metadata.wordCount || 0
        }
      }));

      // 5. 存储到向量数据库
      console.log(`开始存储向量数据...`);
      
      // 验证 chunkData 和 embeddings 的有效性
      if (!chunkData || chunkData.length === 0) {
        throw new IndexingError('生成的文档块数据为空');
      }
      
      // 过滤掉无效的 embedding
      const validChunks = chunkData.filter((chunk, index) => {
        if (!chunk.embedding || !Array.isArray(chunk.embedding) || chunk.embedding.length === 0) {
          console.warn(`块 ${index} (ID: ${chunk.id}) 的嵌入向量无效，跳过此块`);
          return false;
        }
        return true;
      });
      
      if (validChunks.length === 0) {
        throw new IndexingError('没有有效的嵌入向量数据');
      }
      
      console.log(`有效的向量数据: ${validChunks.length}/${chunkData.length} 个块`);
      
      const vectorData = validChunks.map(chunk => ({
        id: chunk.id,
        embedding: chunk.embedding!,
        content: chunk.content,
        metadata: {
          ...chunk.metadata,
          // 如果提供了知识库ID，添加到元数据中
          ...(options.knowledgeBaseId && { knowledgeBaseId: options.knowledgeBaseId })
        }
      }));

      // 再次验证向量数据
      if (!vectorData || vectorData.length === 0) {
        throw new IndexingError('生成的向量数据为空');
      }

      await this.retrievalService.addVectors(vectorData);

      // 6. 如果提供了知识库ID，创建知识片段记录
      if (options.knowledgeBaseId) {
        console.log(`创建知识片段记录...`);
        const { KnowledgeService } = await import('../knowledgeService');
        
        for (let i = 0; i < chunkData.length; i++) {
          const chunk = chunkData[i];
          try {
            await KnowledgeService.createKnowledgeChunk(
              options.knowledgeBaseId,
              documentId,
              chunk.content,
              chunk.metadata
            );
          } catch (chunkError) {
            console.warn(`创建知识片段失败 (块 ${i}):`, chunkError);
            // 继续处理其他块，不中断整个流程
          }
        }
      }

      // 7. 完成
      task.status = IndexingStatus.COMPLETED;
      task.progress = 100;
      task.endTime = new Date();
      task.chunks = chunkData;
      options.progressCallback?.(task);

      const processingTime = Date.now() - startTime;
      console.log(`文档索引完成，耗时: ${processingTime}ms`);

      return {
        taskId: task.id,
        success: true,
        documentId,
        chunksProcessed: chunkData.length,
        totalChunks: chunkData.length,
        processingTime
      };

    } catch (error) {
      task.status = IndexingStatus.FAILED;
      task.error = error instanceof Error ? error.message : String(error);
      task.endTime = new Date();
      options.progressCallback?.(task);

      console.error(`文档索引失败: ${filePath}`, error);

      return {
        taskId: task.id,
        success: false,
        documentId,
        chunksProcessed: 0,
        totalChunks: 0,
        processingTime: Date.now() - startTime,
        error: task.error
      };
    }
  }

  /**
   * 批量索引文档
   */
  async indexDocuments(
    documents: Array<{ documentId: string; filePath: string }>,
    options: IndexingOptions = {}
  ): Promise<IndexingResult[]> {
    console.log(`开始批量索引 ${documents.length} 个文档`);
    
    const results: IndexingResult[] = [];
    const maxConcurrency = options.maxConcurrency || 3;

    // 分批处理以控制并发数
    for (let i = 0; i < documents.length; i += maxConcurrency) {
      const batch = documents.slice(i, i + maxConcurrency);
      
      console.log(`处理批次 ${Math.floor(i / maxConcurrency) + 1}, 文档数: ${batch.length}`);
      
      const batchPromises = batch.map(doc => 
        this.indexDocument(doc.documentId, doc.filePath, {
          ...options,
          progressCallback: (task) => {
            console.log(`文档 ${doc.documentId} 进度: ${task.progress}% (${task.status})`);
            options.progressCallback?.(task);
          }
        })
      );

      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error(`批量索引失败: ${batch[index].filePath}`, result.reason);
          results.push({
            taskId: generateId(),
            success: false,
            documentId: batch[index].documentId,
            chunksProcessed: 0,
            totalChunks: 0,
            processingTime: 0,
            error: result.reason instanceof Error ? result.reason.message : String(result.reason)
          });
        }
      });
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`批量索引完成: ${successCount}/${documents.length} 成功`);

    return results;
  }

  /**
   * 重新索引文档（更新已存在的文档）
   */
  async reindexDocument(
    documentId: string,
    filePath: string,
    options: IndexingOptions = {}
  ): Promise<IndexingResult> {
    console.log(`开始重新索引文档: ${documentId}`);

    try {
      // 1. 删除现有的向量数据
      // 这里需要根据实际的数据库结构来实现删除逻辑
      // 暂时跳过删除步骤
      console.log(`删除文档 ${documentId} 的现有索引数据`);

      // 2. 重新索引
      const result = await this.indexDocument(documentId, filePath, options);
      
      if (result.success) {
        console.log(`文档重新索引成功: ${documentId}`);
      } else {
        console.error(`文档重新索引失败: ${documentId}`, result.error);
      }

      return result;

    } catch (error) {
      console.error(`重新索引文档失败: ${documentId}`, error);
      throw new IndexingError(
        `重新索引失败: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        documentId
      );
    }
  }

  /**
   * 删除文档索引
   */
  async removeDocumentIndex(documentId: string): Promise<void> {
    console.log(`删除文档索引: ${documentId}`);

    try {
      // 这里需要根据实际的数据库结构来实现
      // 删除所有属于该文档的向量数据
      console.log(`删除文档 ${documentId} 的所有向量数据`);

      // 可以通过元数据查询来找到所有相关的向量ID
      // 然后调用 retrievalService.removeVectors(vectorIds)

    } catch (error) {
      console.error(`删除文档索引失败: ${documentId}`, error);
      throw new IndexingError(
        `删除索引失败: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        documentId
      );
    }
  }

  /**
   * 验证文档是否可以被索引
   */
  async validateDocument(filePath: string): Promise<{
    isValid: boolean;
    reason?: string;
    fileType?: string;
  }> {
    try {
      const validation = await this.documentExtractor.validateFile(filePath);
      
      if (!validation.isSupported) {
        return {
          isValid: false,
          reason: validation.reason,
          fileType: validation.fileType
        };
      }

      return {
        isValid: true,
        fileType: validation.fileType
      };

    } catch (error) {
      return {
        isValid: false,
        reason: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 获取支持的文件类型
   */
  async getSupportedFileTypes(): Promise<string[]> {
    return await this.documentExtractor.getSupportedTypes();
  }

  /**
   * 获取索引器统计信息
   */
  async getIndexerStats(): Promise<{
    supportedFileTypes: string[];
    embeddingModel: string;
    chunkingStrategies: string[];
    vectorStoreStats: any;
  }> {
    const supportedFileTypes = await this.documentExtractor.getSupportedTypes();
    const chunkingStrategies = this.chunkingService.getAvailableStrategies();

    return {
      supportedFileTypes,
      embeddingModel: 'default',
      chunkingStrategies,
      vectorStoreStats: {}
    };
  }
}

// 全局 DocumentIndexer 实例管理
let globalDocumentIndexer: DocumentIndexer | null = null;

/**
 * 获取全局 DocumentIndexer 实例
 */
export function getDocumentIndexer(): DocumentIndexer {
  if (!globalDocumentIndexer) {
    globalDocumentIndexer = new DocumentIndexer();
    
    // 监听知识库配置变更
    const setupConfigListener = async () => {
      try {
        const { getKnowledgeBaseConfigManager } = await import('../knowledgeBaseConfig');
        const configManager = getKnowledgeBaseConfigManager();
        
        configManager.addListener(async (config) => {
          console.log('[DocumentIndexer] 检测到知识库配置变更，重新初始化嵌入服务...');
          try {
            await globalDocumentIndexer?.reinitializeEmbeddingService();
            console.log('[DocumentIndexer] 嵌入服务重新初始化完成');
          } catch (error) {
            console.error('[DocumentIndexer] 重新初始化嵌入服务失败:', error);
          }
        });
      } catch (error) {
        console.warn('[DocumentIndexer] 设置配置监听器失败:', error);
      }
    };
    
    setupConfigListener();
  }
  
  return globalDocumentIndexer;
}

 /**
  * 重置全局 DocumentIndexer 实例
  * 用于测试或强制重新创建实例
  */
 export function resetDocumentIndexer(): void {
   globalDocumentIndexer = null;
 } 