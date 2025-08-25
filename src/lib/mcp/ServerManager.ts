import { McpClient, McpServerConfig, McpTool } from './McpClient';

type ServerStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ServerEvent {
  type: 'SERVER_STATUS' | 'ERROR';
  payload: any;
}

type Listener = (event: ServerEvent) => void;

export class ServerManager {
  private clients = new Map<string, McpClient>();
  private listeners = new Set<Listener>();
  private statuses = new Map<string, ServerStatus>();

  private async ensureConnected(name: string): Promise<void> {
    if (this.clients.has(name)) return;
    // 尝试从持久化配置中加载并启动（懒连接）
    try {
      const { Store } = await import('@tauri-apps/plugin-store');
      const store = await Store.load('mcp_servers.json');
      const list = (await store.get<Array<{ name: string; config: McpServerConfig; enabled?: boolean }>>('servers')) || [];
      const found = Array.isArray(list) ? list.find(s => s && s.name === name) : undefined;
      if (!found) throw new Error('config not found');
      await this.startServer(found.name, found.config);
    } catch (e) {
      // 抛出统一的未连接错误，外层会展示
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Server not connected: ${msg}`);
    }
  }

  on(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: ServerEvent) {
    for (const l of this.listeners) l(event);
  }

  getStatus(name: string): ServerStatus {
    return this.statuses.get(name) ?? 'disconnected';
  }

  async startServer(name: string, cfg: McpServerConfig) {
    if (this.clients.has(name)) return;
    this.statuses.set(name, 'connecting');
    this.emit({ type: 'SERVER_STATUS', payload: { name, status: 'connecting' } });
    try {
      const client = new McpClient(name, cfg);
      await client.connect();
      this.clients.set(name, client);
      this.statuses.set(name, 'connected');
      this.emit({ type: 'SERVER_STATUS', payload: { name, status: 'connected' } });
    } catch (e) {
      this.statuses.set(name, 'error');
      this.emit({ type: 'ERROR', payload: { name, error: e } });
      throw e;
    }
  }

  async stopServer(name: string) {
    const client = this.clients.get(name);
    if (!client) return;
    try {
      await client.disconnect();
    } finally {
      this.clients.delete(name);
      this.statuses.set(name, 'disconnected');
      this.emit({ type: 'SERVER_STATUS', payload: { name, status: 'disconnected' } });
    }
  }

  getClient(name: string): McpClient | undefined {
    return this.clients.get(name);
  }

  async listTools(name: string): Promise<McpTool[]> {
    let c = this.clients.get(name);
    if (!c) {
      await this.ensureConnected(name);
      c = this.clients.get(name);
    }
    if (!c) throw new Error('Server not connected');
    return c.listTools();
  }

  async callTool(name: string, toolName: string, args?: Record<string, unknown>) {
    let c = this.clients.get(name);
    if (!c) {
      await this.ensureConnected(name);
      c = this.clients.get(name);
    }
    if (!c) throw new Error('Server not connected');
    // 超时包装，防止悬挂
    const { CALL_TOOL_TIMEOUT_MS } = await import('./constants');
    return await Promise.race([
      c.callTool(toolName, args),
      new Promise((_, rej) => setTimeout(() => rej(new Error('callTool timeout')), CALL_TOOL_TIMEOUT_MS)),
    ]);
  }

  async listResources(name: string) {
    let c = this.clients.get(name);
    if (!c) {
      await this.ensureConnected(name);
      c = this.clients.get(name);
    }
    if (!c) throw new Error('Server not connected');
    return c.listResources();
  }

  async readResource(name: string, uri: string) {
    let c = this.clients.get(name);
    if (!c) {
      await this.ensureConnected(name);
      c = this.clients.get(name);
    }
    if (!c) throw new Error('Server not connected');
    return c.readResource(uri);
  }

  async listPrompts(name: string) {
    let c = this.clients.get(name);
    if (!c) {
      await this.ensureConnected(name);
      c = this.clients.get(name);
    }
    if (!c) throw new Error('Server not connected');
    return c.listPrompts();
  }

  async getPrompt(name: string, promptName: string, args?: Record<string, unknown>) {
    let c = this.clients.get(name);
    if (!c) {
      await this.ensureConnected(name);
      c = this.clients.get(name);
    }
    if (!c) throw new Error('Server not connected');
    return c.getPrompt(promptName, args);
  }
}

export const serverManager = new ServerManager();

