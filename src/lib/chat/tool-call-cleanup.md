# 工具调用清理架构

## 概述

此模块负责确保工具调用指令不会在用户界面中显示，只显示工具卡片。

## 核心函数

### `cleanToolCallInstructions(text: string): string`

清理文本中的所有工具调用指令，包括：
- `<use_mcp_tool>...</use_mcp_tool>` 块
- `<tool_call>...</tool_call>` 块
- JSON 格式的工具调用
- 未完成的指令片段
- 内部工具卡片标记

### `extractToolCallFromText(text: string)`

从文本中提取工具调用信息（不修改文本），支持：
- XML 格式 `<tool_call>`
- MCP 格式 `<use_mcp_tool>`
- JSON 格式 `{"type": "tool_call"}`

返回解析后的 `{ server, tool, args }` 或 `null`

### `createToolCardMarker(cardId, server, tool, args, messageId): string`

创建工具调用卡片的 JSON 标记，用于在消息内容中标识工具调用位置。

## 使用位置

### 1. 事件层（useChatActions.ts - onEvent）

当收到 `tool_call` 事件时：
```typescript
// 清理已添加到 content 的指令
const cleaned = cleanToolCallInstructions(currentContentRef.current);

// 创建工具卡片标记
const marker = createToolCardMarker(cardId, server, tool, args, messageId);
```

### 2. 渲染层（segments.ts）

在 `appendText` 中过滤掉工具调用指令，确保渲染时不显示。

**注意**：segments.ts 中使用独立的 `filterToolCallContent` 函数（而不是导入），避免同步执行被动态导入阻塞。

### 3. 持久化层（useChatActions.ts - onComplete）

在消息保存到数据库前：
```typescript
// 兜底解析：从原始内容中提取可能遗漏的工具调用
const parsed = extractToolCallFromText(originalContent);

// 最终清理：移除所有指令
contentToPersist = cleanToolCallInstructions(contentToPersist);
```

## 工作流程

```
模型输出 → content_token 事件 → 暂存到 content
                ↓
         识别到 tool_call 事件
                ↓
    [事件层] cleanToolCallInstructions ← 清理 content
                ↓
         createToolCardMarker ← 创建卡片标记
                ↓
    [渲染层] filterToolCallContent ← 过滤显示
                ↓
    [持久化层] extractToolCallFromText ← 兜底提取
                ↓
    [持久化层] cleanToolCallInstructions ← 最终清理
```

## 设计原则

1. **三层防护**：事件层、渲染层、持久化层都有清理逻辑
2. **解耦合**：segments.ts 使用独立函数避免动态导入
3. **可复用**：所有清理逻辑集中在 tool-call-cleanup.ts
4. **兜底机制**：即使事件层遗漏，持久化层也会补救

## 重构优势

相比重构前：
- ✅ 减少了 ~80 行重复代码
- ✅ 清理逻辑集中管理，易于维护
- ✅ 工具调用解析逻辑统一
- ✅ 代码更清晰，注释更少
- ✅ 易于单元测试

