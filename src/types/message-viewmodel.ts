/**
 * 消息ViewModel类型定义
 * 
 * ## 设计目标
 * 
 * 1. **事件驱动**: 由 `StreamEvent` 直接构建，无需UI层解析
 * 2. **性能优化**: 预计算状态标志，减少UI层计算
 * 3. **类型安全**: 提供完整的TypeScript类型定义
 * 4. **不可变**: ViewModel是只读的，确保数据流单向性
 * 
 * ## 架构流程
 * 
 * ```
 * Provider (StreamEvent) 
 *   → dispatchMessageAction (FSM处理) 
 *     → segments更新 
 *       → segments_vm生成
 *         → UI直接使用
 * ```
 */

/**
 * 消息段类型
 */
export type MessageSegmentKind = 
  | 'text'          // 普通文本
  | 'thinkBlock'    // 思考块
  | 'toolCard';     // 工具调用卡片

/**
 * 文本段
 */
export interface TextSegment {
  kind: 'text';
  text: string;
}

/**
 * 思考块段
 */
export interface ThinkBlockSegment {
  kind: 'thinkBlock';
  content: string;
}

/**
 * 工具调用卡片段
 */
export interface ToolCardSegment {
  kind: 'toolCard';
  server: string;
  tool: string;
  args?: Record<string, unknown>;
  result?: {
    success: boolean;
    output?: string;
    error?: string;
  };
  status?: 'pending' | 'running' | 'completed' | 'failed';
}

/**
 * 消息段联合类型
 */
export type MessageSegment = 
  | TextSegment 
  | ThinkBlockSegment 
  | ToolCardSegment;

/**
 * 消息ViewModel标志
 */
export interface MessageViewModelFlags {
  /** 是否正在思考 */
  isThinking: boolean;
  /** 消息是否完成 */
  isComplete: boolean;
  /** 是否包含工具调用 */
  hasToolCalls: boolean;
  /** 是否正在识别工具调用（抑制阀激活占位阶段） */
  isToolDetecting?: boolean;
}

/**
 * 消息ViewModel
 * 
 * 只读数据结构，用于UI渲染
 */
export interface MessageViewModel {
  /** 消息段列表（只读副本） */
  readonly items: ReadonlyArray<Readonly<MessageSegment>>;
  /** 状态标志（预计算） */
  readonly flags: Readonly<MessageViewModelFlags>;
}

/**
 * 创建空的ViewModel
 */
export function createEmptyViewModel(): MessageViewModel {
  return {
    items: [],
    flags: {
      isThinking: false,
      isComplete: false,
      hasToolCalls: false
    }
  };
}

/**
 * 从segments创建ViewModel
 * 
 * @param segments - 消息段数组
 * @param fsm - 消息状态机状态（可选）
 * @returns 只读的MessageViewModel
 */
export function createViewModel(
  segments: MessageSegment[],
  fsm?: string
): MessageViewModel {
  // 创建只读副本
  const items = segments.map(s => ({ ...s }));
  
  // 预计算标志
  const flags: MessageViewModelFlags = {
    isThinking: fsm === 'RENDERING_THINK',
    isComplete: fsm === 'COMPLETE' || !fsm,
    hasToolCalls: items.some(s => s.kind === 'toolCard')
  };
  
  return {
    items: items as ReadonlyArray<Readonly<MessageSegment>>,
    flags: Object.freeze(flags)
  };
}

/**
 * 更新ViewModel（不可变更新）
 * 
 * @param vm - 原ViewModel
 * @param updates - 要更新的部分
 * @returns 新的ViewModel
 */
export function updateViewModel(
  vm: MessageViewModel,
  updates: {
    segments?: MessageSegment[];
    fsm?: string;
  }
): MessageViewModel {
  if (updates.segments !== undefined || updates.fsm !== undefined) {
    return createViewModel(
      updates.segments ?? (vm.items as MessageSegment[]),
      updates.fsm
    );
  }
  return vm;
}

/**
 * 从数据库加载的消息创建ViewModel
 * 用于ensureMessagesLoaded场景
 */
export function createViewModelFromDb(
  segments: MessageSegment[]
): MessageViewModel {
  return {
    items: segments.map(s => ({ ...s })) as ReadonlyArray<Readonly<MessageSegment>>,
    flags: Object.freeze({
      isThinking: false,
      isComplete: true,
      hasToolCalls: segments.some(s => s.kind === 'toolCard')
    })
  };
}

