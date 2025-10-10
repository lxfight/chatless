import type { Message } from '@/types/chat';
import { ensureTextTail, appendText, appendThinkText, insertRunningCard, updateCardStatus, finishLastThink } from './segments';

export type FsmState = 'RENDERING_BODY' | 'RENDERING_THINK' | 'TOOL_RUNNING' | 'TOOL_DONE' | 'TOOL_ERROR' | 'COMPLETE';

export type MessageAction =
  | { type: 'TOKEN_APPEND'; chunk: string }
  | { type: 'THINK_START' }
  | { type: 'THINK_APPEND'; chunk: string }
  | { type: 'THINK_END' }
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
  return { segments: segs, fsm: 'RENDERING_BODY', id: msg.id };
}

export function reduce(model: MessageModel, action: MessageAction): MessageModel {
  switch (action.type) {
    case 'TOKEN_APPEND': {
      if (model.fsm === 'RENDERING_THINK') {
        const base = [...model.segments];
        return { ...model, segments: appendThinkText(base, action.chunk) as any };
      }
      const base = ensureTextTail(model.segments, '');
      const next = appendText(base, action.chunk);
      return { ...model, segments: next as any };
    }
    case 'THINK_START': {
      // 转入思考段，追加一个空的 think 段，并记录开始时间
      const out = [...model.segments, { kind: 'think', text: '', startTime: Date.now() } as any];
      try { console.log('[FSM:THINK_START]', { id: model.id, segLen: out.length }); } catch { /* noop */ }
      return { ...model, segments: out, fsm: 'RENDERING_THINK' };
    }
    case 'THINK_APPEND': {
      const out = appendThinkText(model.segments, action.chunk);
      // console.log('[FSM:THINK_APPEND]', { id: model.id, addLen: (action.chunk||'').length, segLen: out.length });
      return { ...model, segments: out as any, fsm: 'RENDERING_THINK' };
    }
    case 'THINK_END': {
      // 结束思考段，记录时长，然后回到正文
      try { console.log('[FSM:THINK_END]', { id: model.id }); } catch { /* noop */ }
      // 先完成最后一个think段，记录其持续时长
      const finished = finishLastThink(model.segments);
      // 思考结束后在正文末尾创建一个空 text 段，确保后续正文不会"接着写在 think 段上"
      const base = ensureTextTail(finished, '');
      return { ...model, segments: base as any, fsm: 'RENDERING_BODY' };
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
      try { console.log('[FSM:TOOL_HIT]', { id: model.id, server: action.server, tool: action.tool, segLen: next.length }); } catch { /* noop */ }
      return { ...model, segments: next as any, fsm: 'TOOL_RUNNING' };
    }
    case 'TOOL_RESULT': {
      if (action.ok) {
        const next = updateCardStatus(model.segments, { id: action.cardId, server: action.server, tool: action.tool }, { status: 'success', resultPreview: action.resultPreview });
        try { console.log('[FSM:TOOL_RESULT_OK]', { id: model.id, segLen: next.length }); } catch { /* noop */ }
        return { ...model, segments: next as any, fsm: 'TOOL_DONE' };
      }
      // 特殊处理：如果是等待授权状态，不改变 fsm
      if (action.errorMessage === 'pending_auth') {
        const next = updateCardStatus(model.segments, { id: action.cardId, server: action.server, tool: action.tool }, { status: 'pending_auth' as any, errorMessage: action.errorMessage });
        try { console.log('[FSM:TOOL_PENDING_AUTH]', { id: model.id, segLen: next.length }); } catch { /* noop */ }
        return { ...model, segments: next as any, fsm: 'TOOL_RUNNING' }; // 保持 TOOL_RUNNING 状态
      }
      const next = updateCardStatus(model.segments, { id: action.cardId, server: action.server, tool: action.tool }, { status: 'error', errorMessage: action.errorMessage, schemaHint: action.schemaHint });
      try { console.log('[FSM:TOOL_RESULT_ERR]', { id: model.id, segLen: next.length }); } catch { /* noop */ }
      return { ...model, segments: next as any, fsm: 'TOOL_ERROR' };
    }
    case 'STREAM_END': {
      const nextFsm = model.fsm === 'RENDERING_BODY' ? 'COMPLETE' : model.fsm;
      try { console.log('[FSM:STREAM_END]', { id: model.id, fsm: nextFsm, segLen: model.segments.length }); } catch { /* noop */ }
      return { ...model, fsm: nextFsm };
    }
    default:
      return model;
  }
}

