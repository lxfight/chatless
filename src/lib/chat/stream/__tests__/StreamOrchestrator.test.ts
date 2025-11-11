/**
 * StreamOrchestrator 集成测试
 */

import { StreamOrchestrator } from '../StreamOrchestrator';
import type { StreamOrchestratorConfig } from '../types';
import { 
  createThinkingStartEvent, 
  createThinkingTokenEvent, 
  createThinkingEndEvent,
  createContentTokenEvent,
  mockChatStore 
} from './test-utils';

// Mock dependencies
jest.mock('@/store/chatStore', () => ({
  useChatStore: {
    getState: jest.fn(),
  },
}));

jest.mock('@/lib/chat/tool-call-cleanup', () => ({
  cleanToolCallInstructions: jest.fn((text: string) => text),
  extractToolCallFromText: jest.fn(() => null),
  createToolCardMarker: jest.fn(() => '{"__tool_call_card__":{}}'),
}));

describe('StreamOrchestrator', () => {
  let store: ReturnType<typeof mockChatStore>;
  let config: StreamOrchestratorConfig;

  beforeEach(() => {
    store = mockChatStore();
    const { useChatStore } = require('@/store/chatStore');
    useChatStore.getState.mockReturnValue(store.getState());

    config = {
      messageId: 'test-msg-123',
      conversationId: 'test-conv-456',
      provider: 'openai',
      model: 'gpt-4',
      originalUserContent: '测试问题',
      historyForLlm: [],
    };
  });

  afterEach(() => {
    store.clear();
    jest.clearAllMocks();
  });

  describe('createCallbacks', () => {
    it('should create valid stream callbacks', () => {
      const orchestrator = new StreamOrchestrator(config);
      const callbacks = orchestrator.createCallbacks();

      expect(callbacks).toHaveProperty('onStart');
      expect(callbacks).toHaveProperty('onEvent');
      expect(callbacks).toHaveProperty('onComplete');
      expect(callbacks).toHaveProperty('onError');
    });
  });

  describe('event handling', () => {
    it('should handle thinking events', async () => {
      const orchestrator = new StreamOrchestrator(config);
      const callbacks = orchestrator.createCallbacks();

      callbacks.onStart?.();
      await callbacks.onEvent!(createThinkingStartEvent());
      await callbacks.onEvent!(createThinkingTokenEvent('分析中...'));
      await callbacks.onEvent!(createThinkingEndEvent());

      const context = orchestrator.getContext();
      expect(context.fsmState).toBe('RENDERING_BODY');
      expect(context.thinkingStartTime).toBeGreaterThan(0);

      const actions = store.getActions();
      expect(actions.length).toBeGreaterThan(0);
      expect(actions.map(a => a.action.type)).toContain('THINK_START');
      expect(actions.map(a => a.action.type)).toContain('THINK_END');
    });

    it('should handle content events', async () => {
      const orchestrator = new StreamOrchestrator(config);
      const callbacks = orchestrator.createCallbacks();

      callbacks.onStart?.();
      await callbacks.onEvent!(createContentTokenEvent('你好'));
      await callbacks.onEvent!(createContentTokenEvent('世界'));

      const context = orchestrator.getContext();
      expect(context.content).toBe('你好世界');

      const actions = store.getActions();
      expect(actions.filter(a => a.action.type === 'TOKEN_APPEND')).toHaveLength(2);
    });
  });

  describe('complete flow', () => {
    it('should handle a complete thinking + content flow', async () => {
      const orchestrator = new StreamOrchestrator(config);
      const callbacks = orchestrator.createCallbacks();

      // Start stream
      callbacks.onStart?.();

      // Thinking phase
      await callbacks.onEvent!(createThinkingStartEvent());
      await callbacks.onEvent!(createThinkingTokenEvent('让我思考一下...'));
      await callbacks.onEvent!(createThinkingEndEvent());

      // Content phase
      await callbacks.onEvent!(createContentTokenEvent('这是我的答案。'));

      // Complete
      await callbacks.onComplete!();

      const context = orchestrator.getContext();
      expect(context.content).toContain('这是我的答案');
      expect(context.fsmState).toBe('RENDERING_BODY');
      expect(context.thinkingStartTime).toBeGreaterThan(0);

      const actions = store.getActions();
      const actionTypes = actions.map(a => a.action.type);
      expect(actionTypes).toContain('THINK_START');
      expect(actionTypes).toContain('THINK_END');
      expect(actionTypes).toContain('TOKEN_APPEND');
      expect(actionTypes).toContain('STREAM_END');
    });
  });

  describe('error handling', () => {
    it('should call onError callback when event handler throws', async () => {
      const onError = jest.fn();
      const configWithError = { ...config, onError };
      const orchestrator = new StreamOrchestrator(configWithError);
      const callbacks = orchestrator.createCallbacks();

      // Mock store to throw error
      const { useChatStore } = require('@/store/chatStore');
      useChatStore.getState.mockReturnValue({
        dispatchMessageAction: () => {
          throw new Error('Test error');
        },
      });

      callbacks.onStart?.();
      await callbacks.onEvent!(createThinkingStartEvent());

      expect(onError).toHaveBeenCalled();
      expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    });

    it('should handle onComplete errors gracefully', async () => {
      const onError = jest.fn();
      const configWithError = { ...config, onError };
      const orchestrator = new StreamOrchestrator(configWithError);
      const callbacks = orchestrator.createCallbacks();

      // Mock store to throw error in updateMessage
      const { useChatStore } = require('@/store/chatStore');
      useChatStore.getState.mockReturnValue({
        ...store.getState(),
        updateMessage: jest.fn().mockRejectedValue(new Error('Update failed')),
      });

      callbacks.onStart?.();
      await callbacks.onEvent!(createContentTokenEvent('test'));
      await callbacks.onComplete!();

      expect(onError).toHaveBeenCalled();
    });
  });

  describe('context access', () => {
    it('should provide read-only context', () => {
      const orchestrator = new StreamOrchestrator(config);
      const context1 = orchestrator.getContext();
      const context2 = orchestrator.getContext();

      // Should be different objects (copies)
      expect(context1).not.toBe(context2);
      
      // But with same content
      expect(context1.messageId).toBe(context2.messageId);
      expect(context1.conversationId).toBe(context2.conversationId);
    });
  });

  describe('UI update callback', () => {
    it('should call onUIUpdate callback after completion', async () => {
      const onUIUpdate = jest.fn();
      const configWithUI = { ...config, onUIUpdate };
      const orchestrator = new StreamOrchestrator(configWithUI);
      const callbacks = orchestrator.createCallbacks();

      callbacks.onStart?.();
      await callbacks.onEvent!(createContentTokenEvent('测试内容'));
      await callbacks.onComplete!();

      expect(onUIUpdate).toHaveBeenCalled();
    });
  });
});

