/**
 * 消息更新管理器
 * 负责管理流式数据的临时状态，实现智能防抖和批量更新
 */
export class MessageUpdateManager {
  private pendingUpdates = new Map<string, {
    content: string;
    timestamp: number;
    updateCount: number;
  }>();
  
  private updateCallbacks = new Map<string, (content: string) => void>();
  private saveCallbacks = new Map<string, (content: string) => Promise<void>>();
  
  private updateTimer: NodeJS.Timeout | null = null;
  private readonly UPDATE_DELAY = 100; // 100ms 防抖延迟
  private readonly CONTENT_CHANGE_THRESHOLD = 50; // 内容变化阈值（字符数）
  private readonly MAX_UPDATE_FREQUENCY = 500; // 最大更新频率（ms）

  /**
   * 注册消息更新回调
   */
  registerUpdateCallback(messageId: string, callback: (content: string) => void) {
    this.updateCallbacks.set(messageId, callback);
  }

  /**
   * 注册消息保存回调
   */
  registerSaveCallback(messageId: string, callback: (content: string) => Promise<void>) {
    this.saveCallbacks.set(messageId, callback);
  }

  /**
   * 更新消息内容
   */
  updateMessage(messageId: string, content: string) {
    const now = Date.now();
    const existing = this.pendingUpdates.get(messageId);
    
    if (existing) {
      // 检查内容变化量
      const contentChange = Math.abs(content.length - existing.content.length);
      
      // 如果内容变化很小，且距离上次更新时间很短，则跳过更新
      if (contentChange < this.CONTENT_CHANGE_THRESHOLD && 
          now - existing.timestamp < this.MAX_UPDATE_FREQUENCY) {
        return;
      }
      
      existing.content = content;
      existing.timestamp = now;
      existing.updateCount++;
    } else {
      this.pendingUpdates.set(messageId, {
        content,
        timestamp: now,
        updateCount: 1
      });
    }

    // 立即更新UI（不等待防抖）
    this.updateUI(messageId, content);
    
    // 防抖保存到数据库
    this.scheduleSave();
  }

  /**
   * 立即更新UI
   */
  private updateUI(messageId: string, content: string) {
    const callback = this.updateCallbacks.get(messageId);
    if (callback) {
      try {
        callback(content);
      } catch (error) {
        console.error(`[MessageUpdateManager] UI更新失败:`, error);
      }
    }
  }

  /**
   * 安排保存操作
   */
  private scheduleSave() {
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
    }
    
    this.updateTimer = setTimeout(() => {
      this.performBatchSave();
    }, this.UPDATE_DELAY);
  }

  /**
   * 执行批量保存
   */
  private async performBatchSave() {
    const updates = Array.from(this.pendingUpdates.entries());
    this.pendingUpdates.clear();
    
    // 并行保存所有更新
    const savePromises = updates.map(async ([messageId, { content }]) => {
      const saveCallback = this.saveCallbacks.get(messageId);
      if (saveCallback) {
        try {
          await saveCallback(content);
        } catch (error) {
          console.error(`[MessageUpdateManager] 保存失败 (${messageId}):`, error);
        }
      }
    });
    
    await Promise.all(savePromises);
  }

  /**
   * 强制保存所有待更新的消息
   */
  async flushUpdates() {
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = null;
    }
    await this.performBatchSave();
  }

  /**
   * 清理资源
   */
  cleanup() {
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = null;
    }
    this.pendingUpdates.clear();
    this.updateCallbacks.clear();
    this.saveCallbacks.clear();
  }

  /**
   * 获取更新统计信息
   */
  getStats() {
    const totalUpdates = Array.from(this.pendingUpdates.values())
      .reduce((sum, { updateCount }) => sum + updateCount, 0);
    
    return {
      pendingCount: this.pendingUpdates.size,
      totalUpdates,
      callbackCount: this.updateCallbacks.size
    };
  }
}

// 全局实例
export const messageUpdateManager = new MessageUpdateManager(); 