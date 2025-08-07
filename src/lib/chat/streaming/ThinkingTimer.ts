/**
 * A simple timer to track the duration of an operation.
 */
export class ThinkingTimer {
  private startTime: number | null = null;
  private endTime: number | null = null;
  public isRunning: boolean = false;

  /**
   * Starts the timer.
   */
  public start(): void {
    this.startTime = Date.now();
    this.endTime = null;
    this.isRunning = true;
  }

  /**
   * Stops the timer.
   */
  public stop(): void {
    if (this.isRunning) {
      this.endTime = Date.now();
      this.isRunning = false;
    }
  }

  /**
   * Gets the elapsed time in milliseconds.
   * @returns The elapsed time in milliseconds, or 0 if the timer hasn't started.
   */
  public getElapsedTime(): number {
    if (this.startTime === null) {
      return 0;
    }
    if (this.isRunning) {
      return Date.now() - this.startTime;
    }
    return (this.endTime ?? this.startTime) - this.startTime;
  }

  /**
   * Resets the timer to its initial state.
   */
  public reset(): void {
    this.startTime = null;
    this.endTime = null;
    this.isRunning = false;
  }
} 