import type { Message } from '@/types/chat';
import { ensureTextTail, appendText, insertRunningCard, updateCardStatus } from './segments';

export type FsmState = 'STREAMING' | 'TOOL_RUNNING' | 'TOOL_DONE' | 'TOOL_ERROR' | 'COMPLETE';

export type MessageAction =
  | { type: 'TOKEN_APPEND'; chunk: string }
  | { type: 'TOOL_HIT'; server: string; tool: string; args?: Record<string, unknown>; cardId: string }
  | { type: 'TOOL_RESULT'; server: string; tool: string; ok: true; resultPreview: string; cardId?: string }
  | { type: 'TOOL_RESULT'; server: string; tool: string; ok: false; errorMessage: string; schemaHint?: string; cardId?: string }
  | { type: 'STREAM_END' };

export interface MessageModel {
  segments: NonNullable<Message['segments']>;
  fsm: FsmState;
  id: string;
}

export function initModel(msg: Message): MessageModel {
  const segs = Array.isArray(msg.segments) ? msg.segments : [];
  return { segments: segs, fsm: 'STREAMING', id: msg.id };
}

export function reduce(model: MessageModel, action: MessageAction): MessageModel {
  switch (action.type) {
    case 'TOKEN_APPEND': {
      const base = ensureTextTail(model.segments, '');
      return { ...model, segments: appendText(base, action.chunk) };
    }
    case 'TOOL_HIT': {
      const withText = ensureTextTail(model.segments, '');
      const next = insertRunningCard(withText, {
        id: action.cardId,
        server: action.server,
        tool: action.tool,
        args: action.args,
        messageId: model.id,
      } as any);
      return { ...model, segments: next, fsm: 'TOOL_RUNNING' };
    }
    case 'TOOL_RESULT': {
      if (action.ok) {
        const next = updateCardStatus(model.segments, { id: action.cardId, server: action.server, tool: action.tool }, { status: 'success', resultPreview: action.resultPreview });
        return { ...model, segments: next, fsm: 'TOOL_DONE' };
      }
      const next = updateCardStatus(model.segments, { id: action.cardId, server: action.server, tool: action.tool }, { status: 'error', errorMessage: action.errorMessage, schemaHint: action.schemaHint });
      return { ...model, segments: next, fsm: 'TOOL_ERROR' };
    }
    case 'STREAM_END': {
      return { ...model, fsm: model.fsm === 'STREAMING' ? 'COMPLETE' : model.fsm };
    }
    default:
      return model;
  }
}

