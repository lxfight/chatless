// 前端 MCP 客户端封装：通过 Tauri 指令调用后端 rmcp 客户端
import { invoke } from '@tauri-apps/api/core';

export type McpTransportType = 'stdio' | 'sse' | 'http';

export interface McpServerConfig {
  type: McpTransportType;
  command?: string;            // stdio
  args?: string[];             // stdio
  env?: [string, string][];    // stdio (键值对数组)
  baseUrl?: string;            // sse/http
  headers?: [string, string][];// sse/http
}

export interface McpTool {
  name: string;
  description?: string | null;
  // 其他字段保持为可选，避免类型不匹配；后续需要可补充
  [key: string]: unknown;
}

export class McpClient {
  readonly name: string;
  readonly config: McpServerConfig;

  constructor(name: string, config: McpServerConfig) {
    this.name = name;
    this.config = config;
  }

  async connect(): Promise<void> {
    // 将字段按 Rust 端结构（camelCase）传入
    const cfg = {
      type: this.config.type,
      command: this.config.command,
      args: this.config.args,
      env: this.config.env,
      baseUrl: this.config.baseUrl,
      headers: this.config.headers,
    };
    await invoke('mcp_connect', { name: this.name, config: cfg });
  }

  async disconnect(): Promise<void> {
    await invoke('mcp_disconnect', { name: this.name });
  }

  async listTools(): Promise<McpTool[]> {
    const tools = await invoke<McpTool[]>('mcp_list_tools', { serverName: this.name });
    return tools;
  }

  async callTool(toolName: string, args?: Record<string, unknown>): Promise<unknown> {
    // 后端接受 Map<String, Value>；这里传对象
    const result = await invoke<unknown>('mcp_call_tool', {
      serverName: this.name,
      toolName,
      args: args ?? {},
    });
    return result;
  }

  async listResources(): Promise<unknown> {
    return invoke('mcp_list_resources', { serverName: this.name });
  }

  async readResource(uri: string): Promise<unknown> {
    return invoke('mcp_read_resource', { serverName: this.name, uri });
  }

  async listPrompts(): Promise<unknown> {
    return invoke('mcp_list_prompts', { serverName: this.name });
  }

  async getPrompt(name: string, args?: Record<string, unknown>): Promise<unknown> {
    return invoke('mcp_get_prompt', { serverName: this.name, name, args: args ?? {} });
  }
}

