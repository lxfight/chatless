import { UnifiedFileService, type UnifiedFile } from '../unifiedFileService';
import { getDatabaseService } from '../db';

/**
 * 文档同步服务
 * 负责将UnifiedFileService中的文档同步到数据库
 */
export class DocumentSyncService {
  /**
   * 将UnifiedFile同步到数据库
   */
  static async syncFileToDatabase(file: UnifiedFile): Promise<void> {
    try {
      const dbService = getDatabaseService();
      const documentRepo = dbService.getDocumentRepository();

      // 检查文档是否已存在
      const exists = await documentRepo.exists(file.id);
      
      if (!exists) {
        console.log(`同步文档到数据库: ${file.name} (ID: ${file.id})`);
        
        await documentRepo.createDocument({
          id: file.id,
          title: file.name,
          file_path: file.filePath,
          file_type: file.fileType,
          file_size: file.fileSize,
          tags: file.tags,
          folder_path: undefined // 可以根据需要设置文件夹路径
        });
        
        console.log(`文档同步成功: ${file.name}`);
      } else {
        console.log(`⚠️ 文档已存在于数据库中: ${file.name}`);
      }
    } catch (error) {
      console.error(`❌ 同步文档到数据库失败: ${file.name}`, error);
      throw error;
    }
  }

  /**
   * 将所有UnifiedFileService中的文档同步到数据库
   */
  static async syncAllFilesToDatabase(): Promise<{
    synced: number;
    skipped: number;
    errors: number;
  }> {
    try {
      console.log('🔄 开始同步所有文档到数据库...');
      
      const files = await UnifiedFileService.getAllFiles();
      let synced = 0;
      let skipped = 0;
      let errors = 0;

      for (const file of files) {
        try {
          const dbService = getDatabaseService();
          const documentRepo = dbService.getDocumentRepository();
          
          const exists = await documentRepo.exists(file.id);
          
          if (!exists) {
            await this.syncFileToDatabase(file);
            synced++;
          } else {
            skipped++;
          }
        } catch (error) {
          console.error(`同步文档失败: ${file.name}`, error);
          errors++;
        }
      }

      console.log(`文档同步完成: ${synced} 个已同步, ${skipped} 个已跳过, ${errors} 个错误`);
      
      return { synced, skipped, errors };
    } catch (error) {
      console.error('❌ 批量同步文档失败:', error);
      throw error;
    }
  }

  /**
   * 确保文档在数据库中存在
   * 如果不存在则自动同步
   */
  static async ensureDocumentInDatabase(documentId: string): Promise<boolean> {
    try {
      const dbService = getDatabaseService();
      const documentRepo = dbService.getDocumentRepository();

      // 检查文档是否已存在于数据库中
      const exists = await documentRepo.exists(documentId);
      
      if (exists) {
        return true;
      }

      // 从UnifiedFileService获取文档
      const file = await UnifiedFileService.getFile(documentId);
      
      if (!file) {
        console.error(`文档在UnifiedFileService中不存在: ${documentId}`);
        return false;
      }

      // 同步到数据库
      await this.syncFileToDatabase(file);
      return true;
    } catch (error) {
      console.error(`确保文档在数据库中存在失败: ${documentId}`, error);
      return false;
    }
  }

  /**
   * 修复知识库添加文档的外键约束问题
   */
  static async fixDocumentConstraints(): Promise<void> {
    try {
      console.log('🔧 开始修复文档外键约束问题...');
      
      // 同步所有文档到数据库
      const result = await this.syncAllFilesToDatabase();
      
      if (result.errors > 0) {
        console.warn(`⚠️ 有 ${result.errors} 个文档同步失败`);
      } else {
        console.log('所有文档外键约束问题已修复');
      }
    } catch (error) {
      console.error('❌ 修复文档外键约束失败:', error);
      throw error;
    }
  }
}