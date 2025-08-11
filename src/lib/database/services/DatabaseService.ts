import { 
  DatabaseManager, 
  ConversationRepository, 
  MessageRepository, 
  KnowledgeBaseRepository,
  DocumentRepository
} from '../index';
import type { Conversation, Message } from '@/types/chat';
import type { KnowledgeBase, DocKnowledgeMapping } from '../repositories/KnowledgeBaseRepository';
import { getDefaultDatabaseConfig } from '../../config/database';
import type { Document } from '../repositories/DocumentRepository';

/**
 * 数据库服务
 * 作为新数据库架构的统一接口，替代旧的databaseQueue系统
 */
export class DatabaseService {
  private static instance: DatabaseService | null = null;
  private static initializationPromise: Promise<void> | null = null;

  private dbManager: DatabaseManager | null = null;
  private conversationRepo: ConversationRepository | null = null;
  private messageRepo: MessageRepository | null = null;
  private knowledgeBaseRepo: KnowledgeBaseRepository | null = null;
  private documentRepository: DocumentRepository | null = null;

  private constructor() {}

  /**
   * 获取DatabaseService单例实例
   */
  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * 初始化数据库服务
   * 使用Promise缓存防止重复初始化
   */
  public async initialize(dbPath?: string): Promise<void> {
    // 如果已经在初始化中，返回现有的Promise
    if (DatabaseService.initializationPromise) {
      return DatabaseService.initializationPromise;
    }

    // 如果已经初始化完成，直接返回
    if (this.dbManager && this.conversationRepo) {
      return;
    }

    // 创建新的初始化Promise
    DatabaseService.initializationPromise = this._performInitialization(dbPath);
    
    try {
      await DatabaseService.initializationPromise;
    } finally {
      // 初始化完成后清除Promise缓存
      DatabaseService.initializationPromise = null;
    }
  }

  /**
   * 执行实际的初始化逻辑
   */
  private async _performInitialization(dbPath?: string): Promise<void> {
    try {
      console.log('🔧 [DatabaseService] 开始初始化数据库服务...');
      
      // 创建数据库管理器
      this.dbManager = new DatabaseManager(getDefaultDatabaseConfig(dbPath));

      // 等待数据库管理器完全初始化
      console.log('🔧 [DatabaseService] 等待数据库管理器初始化...');
      await this.dbManager.initialize();
      
      // 验证数据库连接状态
      const status = await this.dbManager.getStatus();
      if (!status.isInitialized) {
        throw new Error('数据库管理器初始化失败：数据库未就绪');
      }
      
      console.log('🔧 [DatabaseService] 数据库管理器初始化完成，创建Repository实例...');

      // 创建Repository实例
      this.conversationRepo = new ConversationRepository(this.dbManager);
      this.messageRepo = new MessageRepository(this.dbManager);
      this.knowledgeBaseRepo = new KnowledgeBaseRepository(this.dbManager);
      this.documentRepository = new DocumentRepository(this.dbManager);

      // 验证Repository实例创建成功
      if (!this.conversationRepo || !this.messageRepo) {
        throw new Error('Repository实例创建失败');
      }

      console.log('✅ [DatabaseService] 数据库服务初始化成功');
    } catch (error) {
      console.error('❌ [DatabaseService] 数据库服务初始化失败:', error);
      
      // 清理失败的状态
      this.dbManager = null;
      this.conversationRepo = null;
      this.messageRepo = null;
      this.knowledgeBaseRepo = null;
      this.documentRepository = null;
      
      throw error;
    }
  }

  /**
   * 检查数据库服务是否已初始化
   */
  public isInitialized(): boolean {
    return this.dbManager !== null && 
           this.conversationRepo !== null && 
           this.messageRepo !== null;
  }

  /**
   * 获取数据库管理器
   */
  public getDbManager(): DatabaseManager {
    if (!this.dbManager) {
      throw new Error('数据库服务未初始化，请先调用 initialize()');
    }
    return this.dbManager;
  }

  // === 对话相关方法 ===

  /**
   * 获取对话Repository
   */
  public getConversationRepository(): ConversationRepository {
    if (!this.conversationRepo) {
      throw new Error('数据库服务未初始化');
    }
    return this.conversationRepo;
  }

  /**
   * 创建对话
   */
  public async createConversation(
    title: string,
    modelId: string,
    options?: {
      is_important?: boolean;
      is_favorite?: boolean;
    }
  ): Promise<Conversation> {
    return this.getConversationRepository().createConversation(title, modelId, options);
  }

  /**
   * 获取所有对话
   */
  public async getAllConversations(): Promise<Conversation[]> {
    return this.getConversationRepository().getAllConversations();
  }

  /**
   * 获取对话（包含消息）
   */
  public async getConversationWithMessages(conversationId: string): Promise<Conversation | null> {
    return this.getConversationRepository().getConversationWithMessages(conversationId);
  }

  /**
   * 更新对话标题
   */
  public async updateConversationTitle(conversationId: string, title: string): Promise<Conversation> {
    return this.getConversationRepository().updateTitle(conversationId, title);
  }

  /**
   * 切换重要标记
   */
  public async toggleConversationImportant(conversationId: string): Promise<Conversation> {
    return this.getConversationRepository().toggleImportant(conversationId);
  }

  /**
   * 切换收藏标记
   */
  public async toggleConversationFavorite(conversationId: string): Promise<Conversation> {
    return this.getConversationRepository().toggleFavorite(conversationId);
  }

  /**
   * 删除对话
   */
  public async deleteConversation(conversationId: string): Promise<boolean> {
    return this.getConversationRepository().deleteConversation(conversationId);
  }

  /**
   * 复制对话
   */
  public async duplicateConversation(conversationId: string): Promise<Conversation | null> {
    return this.getConversationRepository().duplicateConversation(conversationId);
  }

  /**
   * 清空所有对话
   */
  public async clearAllConversations(): Promise<void> {
    return this.getConversationRepository().clearAllConversations();
  }

  /**
   * 清空所有文档记录
   */
  public async clearAllDocuments(): Promise<void> {
    return this.getDocumentRepository().clearAllDocuments();
  }

  /**
   * 清空知识库相关数据（不删除知识库定义）
   * - knowledge_chunks
   * - doc_knowledge_mappings
   * - documents（复用现有实现）
   */
  public async clearKnowledgeData(): Promise<void> {
    const db = this.getDbManager();
    // 先清空依赖于 documents 的表，避免残留外键/数据引用
    await db.execute('DELETE FROM knowledge_chunks');
    await db.execute('DELETE FROM doc_knowledge_mappings');
    await this.clearAllDocuments();
  }

  /**
   * 搜索对话
   */
  public async searchConversations(query: string): Promise<Conversation[]> {
    return this.getConversationRepository().searchConversations(query);
  }

  // === 消息相关方法 ===

  /**
   * 获取消息Repository
   */
  public getMessageRepository(): MessageRepository {
    if (!this.messageRepo) {
      throw new Error('数据库服务未初始化');
    }
    return this.messageRepo;
  }

  /**
   * 创建消息
   */
  public async createMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
    options?: {
      status?: 'pending' | 'sending' | 'sent' | 'error' | 'loading' | 'aborted';
      model?: string;
      document_reference?: any;
      context_data?: string;
      knowledge_base_reference?: any;
      thinking_start_time?: number;
      thinking_duration?: number;
    }
  ): Promise<Message> {
    return this.getMessageRepository().createMessage(conversationId, role, content, options);
  }

  /**
   * 获取对话的消息
   */
  public async getMessagesByConversation(conversationId: string): Promise<Message[]> {
    return this.getMessageRepository().getMessagesByConversation(conversationId);
  }

  /**
   * 更新消息
   */
  public async updateMessage(
    messageId: string,
    updates: {
      content?: string;
      status?: 'pending' | 'sending' | 'sent' | 'error' | 'loading' | 'aborted';
      model?: string;
    }
  ): Promise<Message> {
    return this.getMessageRepository().updateMessage(messageId, updates);
  }

  /**
   * 完成流式消息
   */
  public async finalizeStreamedMessage(
    messageId: string,
    finalStatus: 'sent' | 'aborted' | 'error',
    finalContent?: string,
    model?: string,
    thinking_start_time?: number
  ): Promise<Message> {
    return this.getMessageRepository().finalizeStreamedMessage(
      messageId, 
      finalStatus, 
      finalContent, 
      model,
      thinking_start_time
    );
  }

  /**
   * 搜索消息
   */
  public async searchMessages(query: string, conversationId?: string): Promise<Message[]> {
    return this.getMessageRepository().searchMessages(query, conversationId);
  }

  // === 知识库相关方法 ===

  /**
   * 获取知识库Repository
   */
  public getKnowledgeBaseRepository(): KnowledgeBaseRepository {
    if (!this.knowledgeBaseRepo) {
      throw new Error('数据库服务未初始化');
    }
    return this.knowledgeBaseRepo;
  }

  /**
   * 创建知识库
   */
  public async createKnowledgeBase(
    name: string,
    description: string,
    icon?: string,
    isEncrypted?: boolean
  ): Promise<KnowledgeBase> {
    return this.getKnowledgeBaseRepository().createKnowledgeBase(name, description, icon, isEncrypted);
  }

  /**
   * 获取所有知识库
   */
  public async getAllKnowledgeBases(): Promise<KnowledgeBase[]> {
    return this.getKnowledgeBaseRepository().getAllKnowledgeBases();
  }

  /**
   * 获取知识库
   */
  public async getKnowledgeBaseById(id: string): Promise<KnowledgeBase | null> {
    return this.getKnowledgeBaseRepository().getKnowledgeBaseById(id);
  }

  /**
   * 更新知识库
   */
  public async updateKnowledgeBase(
    id: string,
    updates: {
      name?: string;
      description?: string;
      icon?: string;
      isEncrypted?: boolean;
    }
  ): Promise<KnowledgeBase> {
    return this.getKnowledgeBaseRepository().updateKnowledgeBase(id, updates);
  }

  /**
   * 删除知识库
   */
  public async deleteKnowledgeBase(id: string): Promise<boolean> {
    return this.getKnowledgeBaseRepository().deleteKnowledgeBase(id);
  }

  /**
   * 获取知识库统计信息
   */
  public async getKnowledgeBaseStats(knowledgeBaseId: string): Promise<{
    documentCount: number;
    chunkCount: number;
  }> {
    return this.getKnowledgeBaseRepository().getKnowledgeBaseStats(knowledgeBaseId);
  }

  /**
   * 添加文档到知识库
   */
  public async addDocumentToKnowledgeBase(
    documentId: string,
    knowledgeBaseId: string,
    status?: 'pending' | 'indexing' | 'indexed' | 'failed'
  ): Promise<DocKnowledgeMapping> {
    return this.getKnowledgeBaseRepository().addDocumentToKnowledgeBase(documentId, knowledgeBaseId, status);
  }

  /**
   * 从知识库移除文档
   */
  public async removeDocumentFromKnowledgeBase(
    documentId: string,
    knowledgeBaseId: string
  ): Promise<boolean> {
    return this.getKnowledgeBaseRepository().removeDocumentFromKnowledgeBase(documentId, knowledgeBaseId);
  }

  /**
   * 获取知识库文档
   */
  public async getKnowledgeBaseDocuments(knowledgeBaseId: string): Promise<DocKnowledgeMapping[]> {
    return this.getKnowledgeBaseRepository().getKnowledgeBaseDocuments(knowledgeBaseId);
  }

  // === 文档相关方法 ===

  /**
   * 获取文档Repository
   */
  public getDocumentRepository(): DocumentRepository {
    if (!this.documentRepository) {
      throw new Error('数据库服务未初始化');
    }
    return this.documentRepository;
  }

  // === 统计和健康检查 ===

  /**
   * 获取数据库统计信息
   */
  public async getStatistics(): Promise<{
    conversations: any;
    messages: any;
    knowledgeBases: number;
  }> {
    const conversationStats = await this.getConversationRepository().getStatistics();
    const messageStats = await this.getMessageRepository().getMessageStatistics();
    const knowledgeBases = await this.getAllKnowledgeBases();

    return {
      conversations: conversationStats,
      messages: messageStats,
      knowledgeBases: knowledgeBases.length
    };
  }

  /**
   * 数据库健康检查
   */
  public async healthCheck(): Promise<{
    isHealthy: boolean;
    errors: string[];
    statistics: any;
  }> {
    const errors: string[] = [];
    let statistics = null;

    try {
      // 检查数据库连接
      if (!this.dbManager) {
        errors.push('数据库管理器未初始化');
        return { isHealthy: false, errors, statistics };
      }

      // 获取统计信息
      statistics = await this.getStatistics();

      // 检查数据库状态
      const dbStatus = await this.dbManager.getStatus();
      if (!dbStatus.isConnected) {
        errors.push('数据库连接异常');
      }

      // 检查迁移状态
      const migrationManager = this.dbManager.getMigrationManager();
      const migrationStatus = await migrationManager.getStatus();
      if (migrationStatus.pendingMigrations > 0) {
        errors.push(`有 ${migrationStatus.pendingMigrations} 个待处理迁移`);
      }

    } catch (error) {
      errors.push(`健康检查失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }

    return {
      isHealthy: errors.length === 0,
      errors,
      statistics
    };
  }

  /**
   * 关闭数据库连接
   */
  public async close(): Promise<void> {
    if (this.dbManager) {
      await this.dbManager.close();
      this.dbManager = null;
      this.conversationRepo = null;
      this.messageRepo = null;
      this.knowledgeBaseRepo = null;
      this.documentRepository = null;
    }
  }

  /**
   * 重置数据库服务（仅用于测试）
   */
  public static reset(): void {
    DatabaseService.instance = null;
  }
} 