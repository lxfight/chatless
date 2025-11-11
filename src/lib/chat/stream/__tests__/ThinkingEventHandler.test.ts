/**
 * ThinkingEventHandler 单元测试
 */

import { ThinkingEventHandler } from '../handlers/ThinkingEventHandler';
import { 
  createTestContext, 
  createThinkingStartEvent, 
  createThinkingTokenEvent, 
  createThinkingEndEvent,
  createContentTokenEvent,
  mockChatStore 
} from './test-utils';

// Mock useChatStore
jest.mock('@/store/chatStore', () => ({
  useChatStore: {
    getState: jest.fn(),
  },
}));

describe('ThinkingEventHandler', () => {
  let handler: ThinkingEventHandler;
  let store: ReturnType<typeof mockChatStore>;

  beforeEach(() => {
    handler = new ThinkingEventHandler();
    store = mockChatStore();
    const { useChatStore } = require('@/store/chatStore');
    useChatStore.getState.mockReturnValue(store.getState());
  });

  afterEach(() => {
    store.clear();
  });

  describe('canHandle', () => {
    it('should handle thinking_start event', () => {
      const event = createThinkingStartEvent();
      expect(handler.canHandle(event)).toBe(true);
    });

    it('should handle thinking_token event', () => {
      const event = createThinkingTokenEvent('思考中...');
      expect(handler.canHandle(event)).toBe(true);
    });

    it('should handle thinking_end event', () => {
      const event = createThinkingEndEvent();
      expect(handler.canHandle(event)).toBe(true);
    });

    it('should not handle content_token event', () => {
      const event = createContentTokenEvent('内容');
      expect(handler.canHandle(event)).toBe(false);
    });
  });

  describe('handle thinking_start', () => {
    it('should update context and dispatch THINK_START action', () => {
      const context = createTestContext();
      const event = createThinkingStartEvent();
      
      handler.handle(event, context);

      expect(context.thinkingStartTime).toBeGreaterThan(0);
      expect(context.fsmState).toBe('RENDERING_THINK');

      const actions = store.getActions();
      expect(actions).toHaveLength(1);
      expect(actions[0]).toMatchObject({
        messageId: 'test-msg-123',
        action: { type: 'THINK_START' },
      });
    });
  });

  describe('handle thinking_token', () => {
    it('should dispatch THINK_APPEND action with content', () => {
      const context = createTestContext();
      const event = createThinkingTokenEvent('思考片段');
      
      handler.handle(event, context);

      const actions = store.getActions();
      expect(actions).toHaveLength(1);
      expect(actions[0]).toMatchObject({
        messageId: 'test-msg-123',
        action: { type: 'THINK_APPEND', chunk: '思考片段' },
      });
    });

    it('should not dispatch action if content is empty', () => {
      const context = createTestContext();
      const event = createThinkingTokenEvent('');
      
      handler.handle(event, context);

      const actions = store.getActions();
      expect(actions).toHaveLength(0);
    });
  });

  describe('handle thinking_end', () => {
    it('should update context and dispatch THINK_END action', () => {
      const context = createTestContext({ fsmState: 'RENDERING_THINK' });
      const event = createThinkingEndEvent();
      
      handler.handle(event, context);

      expect(context.fsmState).toBe('RENDERING_BODY');

      const actions = store.getActions();
      expect(actions).toHaveLength(1);
      expect(actions[0]).toMatchObject({
        messageId: 'test-msg-123',
        action: { type: 'THINK_END' },
      });
    });
  });

  describe('complete thinking flow', () => {
    it('should handle a complete thinking cycle', () => {
      const context = createTestContext();
      
      // Start thinking
      handler.handle(createThinkingStartEvent(), context);
      expect(context.fsmState).toBe('RENDERING_THINK');
      
      // Add thinking content
      handler.handle(createThinkingTokenEvent('分析问题...'), context);
      handler.handle(createThinkingTokenEvent('考虑方案...'), context);
      
      // End thinking
      handler.handle(createThinkingEndEvent(), context);
      expect(context.fsmState).toBe('RENDERING_BODY');

      const actions = store.getActions();
      expect(actions).toHaveLength(4);
      expect(actions.map(a => a.action.type)).toEqual([
        'THINK_START',
        'THINK_APPEND',
        'THINK_APPEND',
        'THINK_END',
      ]);
    });
  });
});

