import { EmbeddingService } from '../embedding/EmbeddingService';
import { RetrievalService } from '../retrieval/RetrievalService';
import { ContextBuilder } from './ContextBuilder';
import { PromptTemplate } from './PromptTemplate';
import {
  RAGQueryParams,
  RAGQueryResult,
  RAGConfig,
  RAGError,
  RAGStreamResponse,
  RetrievedChunk
} from './types';
import { streamChat, chat, type Message as LLMMessage, type StreamCallbacks } from '../llm';

/**
 * RAG (Retrieval-Augmented Generation) 服务
 * 整合嵌入生成、向量检索、上下文构建和LLM调用
 */
export class RAGService {
  private embeddingService: EmbeddingService;
  private retrievalService: RetrievalService;
  private contextBuilder: ContextBuilder;
  private promptTemplate: PromptTemplate;
  private config: RAGConfig;
  private isInitialized = false;

  constructor(config: RAGConfig) {
    this.config = config;
    
    // 初始化各个服务组件
    this.embeddingService = new EmbeddingService({
      config: config.embedding,
      enableCache: true,
      cacheSize: 1000
    });
    this.retrievalService = new RetrievalService();
    this.contextBuilder = new ContextBuilder(config.context);
    this.promptTemplate = new PromptTemplate();
  }

  /**
   * 更新LLM配置
   */
  updateLLMConfig(llmConfig: { provider: string; model: string; apiKey?: string; temperature?: number; maxTokens?: number }) {
    this.config.llm = {
      provider: llmConfig.provider,
      model: llmConfig.model,
      apiKey: llmConfig.apiKey,
      temperature: llmConfig.temperature || 0.7,
      maxTokens: llmConfig.maxTokens || 4000
    };
    console.log('[RAG] 更新LLM配置:', this.config.llm);
  }

  /**
   * 初始化RAG服务
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('正在初始化RAG服务...');
      
      // 初始化嵌入服务
      await this.embeddingService.initialize();
      
      console.log('RAG服务初始化完成');
      this.isInitialized = true;
    } catch (error) {
      console.error('RAG服务初始化失败:', error);
      throw new RAGError(
        '初始化失败',
        'INITIALIZATION_FAILED',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 执行RAG查询
   */
  async query(params: RAGQueryParams): Promise<RAGQueryResult> {
    if (!this.isInitialized) {
      throw new RAGError('RAG服务未初始化', 'NOT_INITIALIZED');
    }

    const startTime = Date.now();
    console.log('开始RAG查询:', params.query);

    try {
      // 1. 生成查询嵌入向量
      console.log('生成查询嵌入向量...');
      const queryEmbedding = await this.embeddingService.generateEmbedding(params.query);

      // 2. 执行向量检索
      console.log('执行向量检索...');
      const searchResults = await this.retrievalService.search(queryEmbedding, {
        topK: params.topK || this.config.retrieval.defaultTopK,
        threshold: params.similarityThreshold || this.config.retrieval.defaultSimilarityThreshold,
        includeEmbeddings: false,
        filter: params.knowledgeBaseIds && params.knowledgeBaseIds.length > 0 ? { knowledgeBaseId: params.knowledgeBaseIds.length === 1 ? params.knowledgeBaseIds[0] : params.knowledgeBaseIds } : undefined
      });
      console.log('[RAG] 原始检索结果数量:', searchResults.length);
      if (searchResults.length > 0) {
        console.log('[RAG] 第一个原始结果样例:', searchResults[0]);
      }

      // 转换搜索结果为检索片段格式
      const retrievalResults = this.convertToRetrievedChunks(searchResults);
      console.log('[RAG] 转换后的检索结果数量:', retrievalResults.length);
      if (retrievalResults.length > 0) {
        console.log('[RAG] 第一个结果样例:', {
          id: retrievalResults[0].id,
          contentLength: retrievalResults[0].content?.length || 0,
          content: retrievalResults[0].content?.substring(0, 100) + '...',
          score: retrievalResults[0].score,
          knowledgeBaseName: retrievalResults[0].knowledgeBaseName
        });
      }

      // 3. 构建上下文
      console.log('构建上下文...');
      // 补充知识库名称（若缺失）
      try {
        await this.ensureKnowledgeBaseNames(retrievalResults);
      } catch (e) {
        console.warn('[RAG] 知识库名称补充失败（不影响检索）:', e);
      }

      const { context, usedChunks, truncated } = this.contextBuilder.buildContext(
        retrievalResults,
        params.query
      );
      console.log('[RAG] 构建上下文完成:', {
        contextLength: context.length,
        usedChunksCount: usedChunks.length,
        truncated,
        contextPreview: context.substring(0, 200) + '...'
      });

      // 4. 生成回答
      console.log('生成回答...');
      const answer = await this.generateAnswer(params.query, context);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 5. 构建结果
      const result: RAGQueryResult = {
        query: params.query,
        answer,
        chunks: usedChunks,
        metadata: {
          timestamp: startTime,
          duration,
          knowledgeBaseCount: this.getUniqueKnowledgeBaseCount(usedChunks),
          totalChunks: retrievalResults.length,
          llmProvider: this.config.llm?.provider,
          embeddingModel: this.embeddingService.getStrategyName()
        }
      };

      console.log(`RAG查询完成，耗时 ${duration}ms`);
      return result;
    } catch (error) {
      console.error('RAG查询失败:', error);
      throw new RAGError(
        '查询失败',
        'QUERY_FAILED',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 为检索结果补充知识库名称（当metadata中缺失时）
   */
  private async ensureKnowledgeBaseNames(chunks: RetrievedChunk[]): Promise<void> {
    const missing = chunks.filter(c => !c.knowledgeBaseName || c.knowledgeBaseName === '未知知识库');
    if (!missing.length) return;

    try {
      const ids = Array.from(new Set(missing.map(c => c.knowledgeBaseId).filter(Boolean)));
      if (!ids.length) return;
      const { KnowledgeService } = await import('../knowledgeService');
      await Promise.all(ids.map(async (id) => {
        try {
          const kb = await KnowledgeService.getKnowledgeBase(id);
          if (kb && kb.name) {
            for (const c of chunks) {
              if (c.knowledgeBaseId === id) c.knowledgeBaseName = kb.name;
            }
          }
        } catch {/* ignore one */}
      }));
    } catch (e) {
      // 不阻断主流程
      console.warn('[RAG] ensureKnowledgeBaseNames 失败:', e);
    }
  }

  /**
   * 流式RAG查询
   */
  async *queryStream(params: RAGQueryParams): AsyncGenerator<RAGStreamResponse, void, unknown> {
    if (!this.isInitialized) {
      throw new RAGError('RAG服务未初始化', 'NOT_INITIALIZED');
    }

    const startTime = Date.now();

    try {
      // 进度报告：开始查询
      yield {
        type: 'progress',
        data: {
          status: 'embedding',
          message: '正在生成查询嵌入向量...',
          progress: 10,
          currentStep: '嵌入生成',
          totalSteps: 4,
          completedSteps: 0
        }
      };

      // 1. 生成查询嵌入向量
      const queryEmbedding = await this.embeddingService.generateEmbedding(params.query);

      yield {
        type: 'progress',
        data: {
          status: 'retrieving',
          message: '正在检索相关知识片段...',
          progress: 30,
          currentStep: '向量检索',
          totalSteps: 4,
          completedSteps: 1
        }
      };

      // 2. 执行向量检索
      const searchResults = await this.retrievalService.search(queryEmbedding, {
        topK: params.topK || this.config.retrieval.defaultTopK,
        threshold: params.similarityThreshold || this.config.retrieval.defaultSimilarityThreshold,
        includeEmbeddings: false,
        filter: params.knowledgeBaseIds && params.knowledgeBaseIds.length > 0 ? { knowledgeBaseId: params.knowledgeBaseIds.length === 1 ? params.knowledgeBaseIds[0] : params.knowledgeBaseIds } : undefined
      });

      // 转换搜索结果为检索片段格式
      const retrievalResults = this.convertToRetrievedChunks(searchResults);

      // 发送检索到的片段
      for (const chunk of retrievalResults) {
        yield {
          type: 'chunk',
          data: chunk
        };
      }

      yield {
        type: 'progress',
        data: {
          status: 'generating',
          message: '正在生成回答...',
          progress: 70,
          currentStep: 'LLM生成',
          totalSteps: 4,
          completedSteps: 2
        }
      };

      // 3. 构建上下文
      const { context, usedChunks } = this.contextBuilder.buildContext(
        retrievalResults,
        params.query
      );

      // 4. 生成回答（根据是否需要流式）
      if (params.stream) {
        // 使用流式方式生成回答
        const messages: LLMMessage[] = [
          {
            role: 'system',
            content: `你是一个知识库助手，基于提供的上下文信息回答用户问题。请确保回答准确、简洁，并且基于给定的上下文。如果上下文中没有相关信息，请明确说明。`
          },
          {
            role: 'user',
            content: this.promptTemplate.buildPrompt(params.query, context).fullPrompt
          }
        ];

        // 队列存储实时生成的token
        const tokenQueue: string[] = [];
        let streamDone = false;
        let streamError: Error | null = null;
        let fullAnswer = '';

        // 检查LLM配置
        if (!this.config.llm?.provider || !this.config.llm?.model) {
          throw new Error('RAG服务LLM配置缺失：请先调用updateLLMConfig设置provider和model');
        }

        // 启动流式聊天
        streamChat(
          this.config.llm.provider,
          this.config.llm.model,
          messages,
          {
            onStart: () => {
              /* no-op */
            },
            onToken: (token: string) => {
              tokenQueue.push(token);
              fullAnswer += token;
            },
            onComplete: () => {
              streamDone = true;
            },
            onError: (err: Error) => {
              streamError = err;
              streamDone = true;
            }
          },
          {
            temperature: this.config.llm?.temperature || 0.7,
            apiKey: this.config.llm?.apiKey
          }
        ).catch((err) => {
          // 处理初始化阶段可能抛出的同步错误
          streamError = err instanceof Error ? err : new Error(String(err));
          streamDone = true;
        });

        // 持续输出 tokenQueue 中的内容，直到流结束
        while (!streamDone || tokenQueue.length > 0) {
          if (tokenQueue.length > 0) {
            const token = tokenQueue.shift() as string;
            yield {
              type: 'answer',
              data: token
            } as RAGStreamResponse;
          } else {
            // 若当前队列为空，稍作等待
            await new Promise((resolve) => setTimeout(resolve, 20));
          }
        }

        // 如果流式过程中出现错误，则抛出
        if (streamError) {
          yield {
            type: 'error',
            data: streamError
          } as RAGStreamResponse;
          return;
        }

        // 完成进度
        yield {
          type: 'progress',
          data: {
            status: 'completed',
            message: '查询完成',
            progress: 100,
            currentStep: '完成',
            totalSteps: 4,
            completedSteps: 4
          }
        } as RAGStreamResponse;

        // 发送最终结果
        const endTime = Date.now();
        const result: RAGQueryResult = {
          query: params.query,
          answer: fullAnswer,
          chunks: usedChunks,
          metadata: {
            timestamp: startTime,
            duration: endTime - startTime,
            knowledgeBaseCount: this.getUniqueKnowledgeBaseCount(usedChunks),
            totalChunks: retrievalResults.length,
            llmProvider: this.config.llm?.provider,
            embeddingModel: this.embeddingService.getStrategyName()
          }
        };

        yield {
          type: 'complete',
          data: result
        } as RAGStreamResponse;
      } else {
        // 非流式，一次性生成回答
        const answer = await this.generateAnswer(params.query, context);

        yield {
          type: 'progress',
          data: {
            status: 'completed',
            message: '查询完成',
            progress: 100,
            currentStep: '完成',
            totalSteps: 4,
            completedSteps: 4
          }
        } as RAGStreamResponse;

        // 发送最终结果
        const endTime = Date.now();
        const result: RAGQueryResult = {
          query: params.query,
          answer,
          chunks: usedChunks,
          metadata: {
            timestamp: startTime,
            duration: endTime - startTime,
            knowledgeBaseCount: this.getUniqueKnowledgeBaseCount(usedChunks),
            totalChunks: retrievalResults.length,
            llmProvider: this.config.llm?.provider,
            embeddingModel: this.embeddingService.getStrategyName()
          }
        };

        yield {
          type: 'complete',
          data: result
        } as RAGStreamResponse;
      }

    } catch (error) {
      yield {
        type: 'error',
        data: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * 生成LLM回答
   */
  private async generateAnswer(query: string, context: string): Promise<string> {
    // 如果没有配置LLM，返回默认回答
    if (!this.config.llm || !this.config.llm.provider || !this.config.llm.model) {
      return this.generateFallbackAnswer(context);
    }

    try {
      // 构建提示词
          const { fullPrompt } = this.promptTemplate.buildPrompt(query, context);
      console.log('[RAG] 构建的完整提示词长度:', fullPrompt.length);
      console.log('[RAG] 上下文长度:', context.length);
      console.log('[RAG] 提示词预览:', fullPrompt.substring(0, 500) + '...');
      
      // 构建消息格式
      const messages: LLMMessage[] = [
        {
          role: 'system',
          content: `你是一个知识库助手，基于提供的上下文信息回答用户问题。请确保回答准确、简洁，并且基于给定的上下文。如果上下文中没有相关信息，请明确说明。`
        },
        {
          role: 'user',
          content: fullPrompt
        }
      ];

      // 使用现有的LLM服务进行对话
      const response = await chat(
        this.config.llm.provider,
        this.config.llm.model,
        messages,
        {
          temperature: this.config.llm.temperature || 0.7,
          apiKey: this.config.llm.apiKey
        }
      );

      return response.content;

    } catch (error) {
      console.error('LLM生成失败，使用备用回答:', error);
      return this.generateFallbackAnswer(context);
    }
  }

  /**
   * 流式生成LLM回答
   */
  private async generateAnswerStream(
    query: string, 
    context: string,
    onToken: (token: string) => void,
    onComplete: (fullAnswer: string) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    // 如果没有配置LLM，返回默认回答
    if (!this.config.llm || !this.config.llm.provider || !this.config.llm.model) {
      const fallbackAnswer = this.generateFallbackAnswer(context);
      // 模拟流式输出
      for (let i = 0; i < fallbackAnswer.length; i += 3) {
        const chunk = fallbackAnswer.slice(i, i + 3);
        onToken(chunk);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      onComplete(fallbackAnswer);
      return;
    }

    try {
      // 构建提示词
          const { fullPrompt } = this.promptTemplate.buildPrompt(query, context);
      
      // 构建消息格式
      const messages: LLMMessage[] = [
        {
          role: 'system',
          content: `你是一个知识库助手，基于提供的上下文信息回答用户问题。请确保回答准确、简洁，并且基于给定的上下文。如果上下文中没有相关信息，请明确说明。`
        },
        {
          role: 'user',
          content: fullPrompt
        }
      ];

      let fullAnswer = '';
      
      const callbacks: StreamCallbacks = {
        onStart: () => {
          console.log('开始生成RAG回答...');
        },
        onToken: (token: string) => {
          fullAnswer += token;
          onToken(token);
        },
        onComplete: () => {
          onComplete(fullAnswer);
        },
        onError: (error: Error) => {
          console.error('LLM流式生成失败:', error);
          onError(error);
        }
      };

      // 使用现有的LLM流式服务
      await streamChat(
        this.config.llm.provider,
        this.config.llm.model,
        messages,
        callbacks,
        {
          temperature: this.config.llm.temperature || 0.7,
          apiKey: this.config.llm.apiKey
        }
      );

    } catch (error) {
      console.error('LLM流式生成失败，使用备用回答:', error);
      const fallbackAnswer = this.generateFallbackAnswer(context);
      // 模拟流式输出备用回答
      for (let i = 0; i < fallbackAnswer.length; i += 3) {
        const chunk = fallbackAnswer.slice(i, i + 3);
        onToken(chunk);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      onComplete(fallbackAnswer);
    }
  }

  /**
   * 生成备用回答（当LLM不可用时）
   */
  private generateFallbackAnswer(context: string): string {
    if (!context || context.trim() === '') {
      return '抱歉，我在知识库中没有找到与您的问题相关的信息。请尝试使用不同的关键词或更具体的问题。';
    }

    // 简单的上下文摘要
    const lines = context.split('\n').filter(line => line.trim() !== '');
    const maxLines = 3;
    const summary = lines.slice(0, maxLines).join('\n');
    
    if (lines.length > maxLines) {
      return `基于知识库内容，我找到了以下相关信息：\n\n${summary}\n\n...(还有更多相关内容)`;
    } else {
      return `基于知识库内容，我找到了以下相关信息：\n\n${summary}`;
    }
  }

  /**
   * 获取知识库数量
   */
  private getUniqueKnowledgeBaseCount(chunks: RetrievedChunk[]): number {
    const uniqueKbIds = new Set(chunks.map(chunk => chunk.knowledgeBaseId));
    return uniqueKbIds.size;
  }

  /**
   * 将VectorSearchResult转换为RetrievedChunk
   */
  private convertToRetrievedChunks(results: any[]): RetrievedChunk[] {
    return results.map((result, index) => ({
      id: result.id,
      content: result.content,
      score: result.score,
      knowledgeBaseId: result.metadata?.knowledgeBaseId || 'unknown',
      knowledgeBaseName: result.metadata?.knowledgeBaseName || '未知知识库',
      documentId: result.metadata?.documentId,
      documentName: result.metadata?.documentName,
      documentPath: result.metadata?.documentPath,
      chunkIndex: result.metadata?.chunkIndex || index,
      metadata: result.metadata
    }));
  }

  /**
   * 更新配置
   */
  async updateConfig(newConfig: Partial<RAGConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };

    // 更新各个组件的配置
    if (newConfig.context) {
      this.contextBuilder.updateConfig(newConfig.context);
    }

    // 如果嵌入配置改变，重新初始化嵌入服务
    if (newConfig.embedding) {
      await this.embeddingService.switchStrategy(newConfig.embedding);
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): RAGConfig {
    return { ...this.config };
  }

  /**
   * 检查服务状态
   */
  getStatus(): {
    isInitialized: boolean;
    embeddingReady: boolean;
    embeddingStrategy: string;
    lastError?: string;
  } {
    return {
      isInitialized: this.isInitialized,
      embeddingReady: this.embeddingService.isInitialized(),
      embeddingStrategy: this.embeddingService.getStrategyName(),
    };
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    try {
      await this.embeddingService.cleanup();
      this.isInitialized = false;
      console.log('RAG服务已清理');
    } catch (error) {
      console.error('清理RAG服务失败:', error);
      throw new RAGError(
        '清理失败',
        'CLEANUP_FAILED',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 批量查询（用于批处理）
   */
  async batchQuery(queries: string[], baseParams: Omit<RAGQueryParams, 'query'>): Promise<RAGQueryResult[]> {
    const results: RAGQueryResult[] = [];
    
    for (const query of queries) {
      try {
        const result = await this.query({ ...baseParams, query });
        results.push(result);
      } catch (error) {
        console.error(`批量查询失败: ${query}`, error);
        // 添加错误结果
        results.push({
          query,
          answer: '查询失败',
          chunks: [],
          metadata: {
            timestamp: Date.now(),
            duration: 0,
            knowledgeBaseCount: 0,
            totalChunks: 0,
            embeddingModel: this.embeddingService.getStrategyName()
          }
        });
      }
    }

    return results;
  }

  /**
   * 预热服务（预加载模型等）
   */
  async warmup(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // 执行一次简单的嵌入生成来预热模型
    try {
      await this.embeddingService.generateEmbedding('Hello');
      console.log('RAG服务预热完成');
    } catch (error) {
      console.warn('RAG服务预热失败:', error);
    }
  }
}

/**
 * 创建默认RAG配置
 */
export function createDefaultRAGConfig(): RAGConfig {
  return {
    embedding: {
      strategy: 'local-onnx'
    },
    retrieval: {
      defaultTopK: 5,
      defaultSimilarityThreshold: 0.7,
      maxResultsPerKnowledgeBase: 10
    },
    context: {
      maxContextLength: 4000,
      chunkSeparator: '\n---\n',
      includeSource: true,
      sortByRelevance: true
    }
  };
}

/**
 * 创建RAG服务实例
 */
export function createRAGService(config?: Partial<RAGConfig>): RAGService {
  const defaultConfig = createDefaultRAGConfig();
  const finalConfig = { ...defaultConfig, ...config };
  return new RAGService(finalConfig);
} 