import { ThinkingTimer } from './ThinkingTimer';

const THINK_START_TAG = '<think>';
const THINK_END_TAG = '</think>';

export interface StreamedMessage {
  thinkingContent: string;
  regularContent: string;
  isThinking: boolean;
  elapsedTime: number;
  isFinished: boolean;
}

enum ParsingState {
  IDLE,
  IN_THINK,
  IN_REGULAR,
}

export class MessageStreamParser {
  private timer = new ThinkingTimer();
  private state: ParsingState = ParsingState.IDLE;
  private buffer = '';
  private thinkingContent = '';
  private regularContent = '';
  private isFinished = false;

  public process(chunk: string | null): StreamedMessage {
    if (chunk === null) {
      this.isFinished = true;
      if (this.timer.isRunning) {
        this.timer.stop();
      }
      return this.getCurrentMessageState();
    }

    this.buffer += chunk;
    this.parseBuffer();
    
    return this.getCurrentMessageState();
  }

  /**
   * 强制停止计时器（用于错误或停止情况）
   */
  public forceStop(): void {
    if (this.timer.isRunning) {
      this.timer.stop();
    }
    this.isFinished = true;
  }

  /**
   * 重置解析器状态
   */
  public reset(): void {
    this.timer.reset();
    this.state = ParsingState.IDLE;
    this.buffer = '';
    this.thinkingContent = '';
    this.regularContent = '';
    this.isFinished = false;
  }

  private parseBuffer(): void {
    let continueParsing = true;
    while (continueParsing) {
      switch (this.state) {
        case ParsingState.IDLE:
        case ParsingState.IN_REGULAR:
          const thinkStartIndex = this.buffer.indexOf(THINK_START_TAG);
          if (thinkStartIndex !== -1) {
            const regularPart = this.buffer.substring(0, thinkStartIndex);
            this.regularContent += regularPart;
            this.buffer = this.buffer.substring(thinkStartIndex + THINK_START_TAG.length);
            this.state = ParsingState.IN_THINK;
            if (!this.timer.isRunning && this.timer.getElapsedTime() === 0) {
              this.timer.start();
            }
          } else {
            this.regularContent += this.buffer;
            this.buffer = '';
            this.state = ParsingState.IN_REGULAR;
            continueParsing = false;
          }
          break;

        case ParsingState.IN_THINK:
          const thinkEndIndex = this.buffer.indexOf(THINK_END_TAG);
          if (thinkEndIndex !== -1) {
            const thinkingPart = this.buffer.substring(0, thinkEndIndex);
            this.thinkingContent += thinkingPart;
            this.buffer = this.buffer.substring(thinkEndIndex + THINK_END_TAG.length);
            this.state = ParsingState.IN_REGULAR;
            if (this.timer.isRunning) {
              this.timer.stop();
            }
          } else {
            this.thinkingContent += this.buffer;
            this.buffer = '';
            continueParsing = false;
          }
          break;
      }
    }
  }

  private getCurrentMessageState(): StreamedMessage {
    // 确保在流式结束时，buffer中的剩余内容也被包含在regularContent中
    let finalRegularContent = this.regularContent;
    if (this.isFinished && this.buffer.length > 0) {
      finalRegularContent += this.buffer;
    }
    
    return {
      thinkingContent: this.thinkingContent,
      regularContent: finalRegularContent,
      isThinking: this.timer.isRunning,
      elapsedTime: this.timer.getElapsedTime(),
      isFinished: this.isFinished,
    };
  }
} 