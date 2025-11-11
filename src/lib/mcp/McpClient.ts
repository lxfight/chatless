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
  // 可选：显式要求该 MCP 连接走代理（通常不需要在配置文件写死，connect 时按网络设置自动计算）
  useProxy?: boolean;
  // 可选：自定义代理地址（http://127.0.0.1:7890）
  proxyUrl?: string;
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

  private static isLocalOrPrivateHost(host: string): boolean {
    const h = host.toLowerCase();
    if (h === 'localhost' || h === '::1') return true;
    // 简单匹配常见私网段
    if (/^127\./.test(h)) return true;
    if (/^10\./.test(h)) return true;
    if (/^192\.168\./.test(h)) return true;
    const m = h.match(/^172\.(\d{1,3})\./);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 16 && n <= 31) return true;
    }
    return false;
  }

  private static isRemoteUrl(url?: string): boolean {
    if (!url) return false;
    try {
      const u = new URL(url);
      const host = u.hostname;
      return !this.isLocalOrPrivateHost(host);
    } catch {
      return false;
    }
  }

  async connect(): Promise<void> {
    // 将字段按 Rust 端结构（camelCase）传入
    // 读取全局网络偏好，决定是否传递代理给后端（仅远程地址，避免本地/内网经代理失败）
    let useProxy = false;
    let proxyUrl: string | undefined = undefined;
    try {
      const { useNetworkPreferences } = await import('@/store/networkPreferences');
      const { proxyUrl: p, useSystemProxy } = useNetworkPreferences.getState();
      if (p && !useSystemProxy && McpClient.isRemoteUrl(this.config.baseUrl)) {
        useProxy = true;
        proxyUrl = p;
      }
    } catch {
      // 忽略读取失败，默认为不使用代理
    }

    const cfg = {
      type: this.config.type,
      command: this.config.command,
      args: this.config.args,
      env: this.config.env,
      baseUrl: this.config.baseUrl,
      headers: this.config.headers,
      useProxy,
      proxyUrl,
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

