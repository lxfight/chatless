# 工具调用指令过滤机制

## 问题描述

在流式输出过程中，工具调用的原始指令（如 `<use_mcp_tool>...</use_mcp_tool>`）会被渲染到消息气泡中，导致用户看到冗余的原始指令文本，影响用户体验。

### 问题根源

1. **ContentEventHandler** 接收到 `content_token` 事件时，会将所有内容（包括工具调用指令）追加到 content
2. 这些内容通过 `TOKEN_APPEND` 动作派发到 FSM，立即被渲染到 UI
3. **ToolCallEventHandler** 收到 `tool_call` 事件时才清理指令，但此时指令文本已经被渲染

## 解决方案

### 核心思路

在 **ContentEventHandler** 中实时过滤工具调用指令，而不是等 `tool_call` 事件才清理。

### 实现细节

#### 1. ContentEventHandler 实时过滤 (src/lib/chat/stream/handlers/ContentEventHandler.ts)

```typescript
/**
 * 过滤工具调用指令片段（流式输出场景）
 * 注意：这里需要处理不完整的指令片段
 */
function filterToolCallInstructions(text: string): string {
  if (!text) return '';
  
  let filtered = text;
  
  // 1. 移除完整的工具调用指令块
  filtered = filtered.replace(/<use_mcp_tool>[\s\S]*?<\/use_mcp_tool>/gi, '');
  filtered = filtered.replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '');
  
  // 2. 移除JSON格式的工具调用
  filtered = filtered.replace(/\{[\s\S]*?"type"\s*:\s*"tool_call"[\s\S]*?\}/gi, '');
  
  // 3. 关键：移除未完成的指令片段（流式输出中）
  // 这是防止指令被渲染的核心逻辑
  filtered = filtered.replace(/<use_mcp_tool>[\s\S]*$/i, '');
  filtered = filtered.replace(/<tool_call>[\s\S]*$/i, '');
  
  // 4. 移除内部工具卡片标记
  filtered = filtered.replace(/\{[^}]*"__tool_call_card__"[^}]*\}/g, '');
  
  return filtered;
}
```

#### 2. 增量过滤策略

为了避免每次都重新过滤整个内容，使用增量过滤：

```typescript
// 过滤整个content
const filteredContentForDisplay = filterToolCallInstructions(context.content);

// 计算增量：当前过滤后的内容 - 上次过滤后的长度
const previousFilteredLength = context.filteredContentLength || 0;
const newFilteredChunk = filteredContentForDisplay.substring(previousFilteredLength);

// 记录已过滤内容的长度
context.filteredContentLength = filteredContentForDisplay.length;

// 只派发增量chunk
if (newFilteredChunk) {
  store.dispatchMessageAction(context.messageId, { 
    type: 'TOKEN_APPEND', 
    chunk: newFilteredChunk
  });
}
```

#### 3. 双重保护

- **context.content**: 保留原始内容（包括工具调用指令），用于 ToolCallEventHandler 解析
- **派发给FSM的chunk**: 是过滤后的内容，用于UI渲染
- **ToolCallEventHandler**: 再次清理确保没有遗漏

### 关键优化点

1. **实时过滤**: 在 content_token 阶段就过滤，而不是等 tool_call 事件
2. **增量计算**: 只计算新增的过滤内容，避免重复处理
3. **双重存储**: 
   - `context.content` - 原始完整内容（用于解析）
   - `filteredContentLength` - 已过滤内容长度（用于增量计算）
4. **双重保护**: ContentEventHandler 实时过滤 + ToolCallEventHandler 兜底清理

## 工作流程

```
模型输出token → content_token事件
                    ↓
          ContentEventHandler
                    ↓
     context.content += chunk (保留原始)
                    ↓
     filterToolCallInstructions() (过滤)
                    ↓
     计算增量newFilteredChunk
                    ↓
     派发TOKEN_APPEND (只派发过滤后的增量)
                    ↓
            FSM → segments → UI渲染
                    ↓
          (用户看不到指令)
                    
当识别到完整指令时 → tool_call事件
                    ↓
          ToolCallEventHandler
                    ↓
     再次清理content (兜底)
                    ↓
     创建ToolCallCard标记
                    ↓
     派发TOOL_HIT动作
                    ↓
     渲染工具卡片
```

## 测试场景

### 场景1: 流式输出工具调用指令

**预期行为**:
- 用户不应该看到 `<use_mcp_tool>` 标签
- 应该直接显示工具调用识别动画
- 指令完整后显示工具卡片

### 场景2: 指令前有正常文本

**预期行为**:
- 正常文本正常渲染
- 工具调用指令被过滤
- 指令后的文本继续渲染

### 场景3: 多个工具调用

**预期行为**:
- 所有工具调用指令都被过滤
- 每个工具调用都显示独立的卡片

## 相关文件

- `src/lib/chat/stream/handlers/ContentEventHandler.ts` - 实时过滤实现
- `src/lib/chat/stream/handlers/ToolCallEventHandler.ts` - 兜底清理
- `src/lib/chat/stream/types.ts` - 添加 filteredContentLength 字段
- `src/lib/chat/tool-call-cleanup.ts` - 清理工具函数
- `src/lib/chat/segments.ts` - segments层也有过滤逻辑

## 性能考量

1. **正则表达式性能**: 使用简单的正则，避免复杂的回溯
2. **增量计算**: 只处理新增内容，避免重复过滤整个文本
3. **字符串操作**: 使用 substring 而不是 slice，性能更好
4. **内存占用**: filteredContentLength 只是一个数字，几乎无内存开销

## 向后兼容

这次修改：
- ✅ 不影响现有的 tool-call-cleanup.ts 逻辑
- ✅ 不影响 segments.ts 的过滤逻辑（双重保护）
- ✅ 不影响 ToolCallOrchestrator 的工具执行流程
- ✅ 兼容所有 Provider（Ollama、OpenAI等）


