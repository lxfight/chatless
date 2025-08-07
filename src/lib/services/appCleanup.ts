/**
 * 应用清理服务
 * 负责在应用关闭时执行必要的清理操作
 */

import { DatabaseService } from '@/lib/database/services/DatabaseService';

export class AppCleanupService {
  private static instance: AppCleanupService;
  private isCleaningUp = false;
 
  private constructor() {}

  static getInstance(): AppCleanupService {
    if (!AppCleanupService.instance) {
      AppCleanupService.instance = new AppCleanupService();
    }
    return AppCleanupService.instance;
  }

  /**
   * 执行应用清理
   */
  async cleanup(): Promise<void> {
    if (this.isCleaningUp) {
      return;
    }

    this.isCleaningUp = true;
    console.log('🧹 开始应用清理...');

    try {
      // 并行执行清理任务
      await Promise.allSettled([
        this.cleanupSSEConnections(),
        this.cleanupDatabaseConnections(),
        this.cleanupEmbeddingServices()
      ]);

      console.log('✅ 应用清理完成');
    } catch (error) {
      console.error('❌ 应用清理失败:', error);
    } finally {
      this.isCleaningUp = false;
    }
  }

  /**
   * 清理SSE连接
   */
  private async cleanupSSEConnections(): Promise<void> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('stop_sse').catch(() => {});
    } catch (error) {
      console.warn('⚠️ 清理SSE连接失败:', error);
    }
  }

  /**
   * 清理数据库连接
   */
  private async cleanupDatabaseConnections(): Promise<void> {
    try {
      const dbService = DatabaseService.getInstance();
      await dbService.close();
    } catch (error) {
      console.warn('⚠️ 清理数据库连接失败:', error);
    }
  }

  /**
   * 清理嵌入服务
   */
  private async cleanupEmbeddingServices(): Promise<void> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('cleanup_on_exit').catch(() => {});
    } catch (error) {
      console.warn('⚠️ 清理嵌入服务失败:', error);
    }
  }

  /**
   * 设置窗口关闭事件监听
   */
  async setupWindowCloseListener(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const { confirm } = await import('@tauri-apps/plugin-dialog');
      const currentWindow = getCurrentWindow();

      await currentWindow.onCloseRequested(async (event) => {
        // 检查是否启用确认对话框
        const { useUiPreferences } = await import('@/store/uiPreferences');
        const uiPreferences = useUiPreferences.getState();
        
        if (uiPreferences.showCloseConfirmation) {
          // 显示确认对话框
          const confirmed = await confirm('确定要关闭应用吗？', {
            title: '确认关闭'
          });

          if (!confirmed) {
            // 用户取消关闭，阻止窗口关闭
            event.preventDefault();
            return;
          }
        }

        // 用户确认关闭或设置中禁用了确认对话框，执行清理操作
        await this.cleanup();
      });
    } catch (error) {
      console.warn('⚠️ 设置窗口关闭监听器失败:', error);
      this.setupFallbackCloseListener();
    }
  }

  /**
   * 设置备用关闭事件监听器
   */
  private setupFallbackCloseListener(): void {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
      
      setTimeout(() => {
        this.cleanup().catch(console.error);
      }, 100);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
  }
}

// 导出单例实例
export const appCleanupService = AppCleanupService.getInstance();
