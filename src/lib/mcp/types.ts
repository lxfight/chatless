 export type MessageSegment =
  | { kind: 'text'; text: string }
  | {
      kind: 'toolCard';
      id: string;
      server: string;
      tool: string;
      args?: Record<string, unknown>;
      status: 'running' | 'success' | 'error';
      resultPreview?: string;
      errorMessage?: string;
      schemaHint?: string;
      messageId: string;
    };

export type MessageState =
  | 'streaming'
  | 'tool_detected'
  | 'tool_running'
  | 'tool_done'
  | 'tool_error'
  | 'complete';

export interface MessageFSM {
  state: MessageState;
  segments: MessageSegment[];
  // 增量修订号，防止旧写覆盖新内容
  revision: number;
}

