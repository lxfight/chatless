/**
 * 内容解析器
 * 
 * ## 设计原则
 * 
 * 1. **单一职责**：每个Parser只解析一种特殊内容
 * 2. **可组合**：多个Parser可以组成Pipeline
 * 3. **无状态**：Parser本身不保存状态，方便复用和测试
 * 4. **插件化**：通过实现接口即可扩展新的解析能力
 * 
 * ## 使用场景
 * 
 * - MCP工具调用：从thinking内容中提取`<use_mcp_tool>`标签
 * - 代码块：识别和处理```代码块```
 * - LaTeX公式：识别和处理$公式$
 * - 自定义标签：扩展支持任意自定义标签
 */

import type { StreamEvent, ToolCallEvent } from '../../types/stream-events';
import { createStreamEvent } from '../../types/stream-events';

/**
 * 内容解析器接口
 */
export interface ContentParser {
  /**
   * 解析内容，生成结构化事件
   * @param content - 待解析的文本内容
   * @returns 解析出的结构化事件数组
   */
  parse(content: string): StreamEvent[];
  
  /**
   * 获取解析器名称（用于调试和日志）
   */
  getName(): string;
  
  /**
   * 检查是否可以解析此内容
   * @param content - 待检查的内容
   * @returns 如果可以解析返回true
   */
  canParse(content: string): boolean;
}

/**
 * MCP工具调用解析器
 * 
 * 解析格式：
 * ```xml
 * <use_mcp_tool>
 *   <server_name>filesystem</server_name>
 *   <tool_name>list_directory</tool_name>
 *   <arguments>{"path": "."}</arguments>
 * </use_mcp_tool>
 * ```
 * 
 * 特性：
 * - 支持多个工具调用
 * - 容错解析（解析失败不影响其他内容）
 * - 提取server、tool、arguments信息
 */
export class McpToolCallParser implements ContentParser {
  private readonly pattern = /<use_mcp_tool[\s\S]*?<\/use_mcp_tool>/gi;
  
  getName(): string {
    return 'McpToolCallParser';
  }
  
  canParse(content: string): boolean {
    this.pattern.lastIndex = 0; // 重置正则状态
    return this.pattern.test(content);
  }
  
  parse(content: string): StreamEvent[] {
    const events: StreamEvent[] = [];
    
    // 重置正则状态
    this.pattern.lastIndex = 0;
    const matches = content.match(this.pattern);
    
    if (!matches) return events;
    
    for (const match of matches) {
      try {
        const parsed = this.parseToolCall(match);
        
        // 只有成功解析出server和tool时才生成事件
        if (parsed && parsed.serverName && parsed.toolName) {
          events.push(createStreamEvent.toolCall(match, parsed));
        }
      } catch (err) {
        console.warn('[McpToolCallParser] 解析失败:', err, 'content:', match.substring(0, 100));
      }
    }
    
    return events;
  }
  
  /**
   * 解析单个MCP工具调用
   */
  private parseToolCall(toolCall: string): ToolCallEvent['parsed'] {
    // 提取server_name
    const serverMatch = toolCall.match(/<server_name[^>]*>(.*?)<\/server_name>/i);
    const serverName = serverMatch?.[1]?.trim() || '';
    
    // 提取tool_name
    const toolMatch = toolCall.match(/<tool_name[^>]*>(.*?)<\/tool_name>/i);
    const toolName = toolMatch?.[1]?.trim() || '';
    
    // 提取arguments（保持为JSON字符串）
    const argsMatch = toolCall.match(/<arguments[^>]*>([\s\S]*?)<\/arguments>/i);
    let args: string | undefined = undefined;
    
    if (argsMatch && argsMatch[1]) {
      const argsText = argsMatch[1].trim();
      if (argsText) {
        // 验证是否为有效JSON
        try {
          JSON.parse(argsText); // 验证
          args = argsText; // 保持原始字符串
        } catch {
          // 降噪：仅在需要排查时再打开详细日志
          // 继续执行，arguments可以为空
        }
      }
    }
    
    return {
      serverName,
      toolName,
      arguments: args
    };
  }
}

/**
 * 代码块解析器
 * 
 * 解析格式：
 * ```language
 * code content
 * ```
 * 
 * 注意：当前版本仅识别，不生成特殊事件
 * 未来可扩展为专门的code_block事件类型
 */
export class CodeBlockParser implements ContentParser {
  private readonly pattern = /```[\s\S]*?```/g;
  
  getName(): string {
    return 'CodeBlockParser';
  }
  
  canParse(content: string): boolean {
    this.pattern.lastIndex = 0;
    return this.pattern.test(content);
  }
  
  parse(_content: string): StreamEvent[] {
    // 暂时返回空数组
    // 未来可扩展为生成code_block事件
    return [];
  }
}

/**
 * 内容解析器工厂
 * 
 * 提供预配置的解析器管道
 */
export class ContentParserFactory {
  /**
   * 创建标准解析器管道
   * 
   * 用于：OpenAI、Anthropic、Google AI等
   * 
   * 包含：
   * - MCP工具调用解析
   * - 代码块识别
   */
  static createStandardPipeline(): ContentParser[] {
    return [
      new McpToolCallParser(),
      new CodeBlockParser()
    ];
  }
  
  /**
   * 创建Ollama专用解析器管道
   * 
   * 用于：Ollama及兼容模型
   * 
   * 包含：
   * - MCP工具调用解析
   */
  static createOllamaPipeline(): ContentParser[] {
    return [
      new McpToolCallParser()
    ];
  }
  
  /**
   * 创建DeepSeek专用解析器管道
   * 
   * 用于：DeepSeek模型
   * 
   * 包含：
   * - MCP工具调用解析
   * - 代码块识别
   */
  static createDeepSeekPipeline(): ContentParser[] {
    return [
      new McpToolCallParser(),
      new CodeBlockParser()
    ];
  }
  
  /**
   * 创建自定义解析器管道
   * 
   * @param parsers - 自定义的解析器数组
   */
  static createCustomPipeline(parsers: ContentParser[]): ContentParser[] {
    return parsers;
  }
}

