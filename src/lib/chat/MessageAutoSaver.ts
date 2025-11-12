export type MessageSaveFunction = (latestContent: string) => Promise<void>;

/**
 * MessageAutoSaver
 * - 仅在固定间隔内落盘，减少 IO
 * - onComplete/onError 时强制 flush，确保不丢失尾部内容
 * - 可被停止，防止旧的定时保存覆盖最终内容
 */
export class MessageAutoSaver {
  private readonly intervalMs: number;
  private readonly saveFn: MessageSaveFunction;

  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: boolean = false;
  private stopped: boolean = false;
  private latestContent: string = '';
  private hasAnyUpdate: boolean = false;

  constructor(saveFn: MessageSaveFunction, intervalMs: number = 1000) {
    this.saveFn = saveFn;
    this.intervalMs = Math.max(200, intervalMs); // 下限保护
  }

  /**
   * 接收新的内容，仅记录并调度一次保存
   */
  public update(latestContent: string) {
    if (this.stopped) return;
    this.latestContent = latestContent;
    this.hasAnyUpdate = true;
    if (this.timer) return; // 已经安排过一次保存

    this.timer = setTimeout(async () => {
      this.timer = null;
      await this.performSave();
      // 如果 during save 又有新内容，会再次调度
      if (!this.stopped && this.pending) {
        this.pending = false;
        this.schedule();
      }
    }, this.intervalMs);
  }

  private schedule() {
    if (this.stopped || this.timer) return;
    this.timer = setTimeout(async () => {
      this.timer = null;
      await this.performSave();
      if (!this.stopped && this.pending) {
        this.pending = false;
        this.schedule();
      }
    }, this.intervalMs);
  }

  private async performSave() {
    if (this.stopped) return;
    if (!this.hasAnyUpdate) return; // 没有任何内容更新时跳过，避免把空字符串覆盖最终内容
    try {
      const contentToSave = this.latestContent;
      await this.saveFn(contentToSave);
    } catch (error) {
      console.error('[MessageAutoSaver] 保存失败:', error);
    }
  }

  /**
   * 标记在保存中产生了新的内容
   */
  public markPending() {
    if (this.stopped) return;
    this.pending = true;
  }

  /**
   * 强制保存最新内容，并清理定时器
   */
  public async flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this.performSave();
  }

  /**
   * 停止一切后续保存
   */
  public stop() {
    this.stopped = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}


