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
    const c = this.clients.get(name);
    if (!c) throw new Error('Server not connected');
    return c.listTools();
  }

  async callTool(name: string, toolName: string, args?: Record<string, unknown>) {
    const c = this.clients.get(name);
    if (!c) throw new Error('Server not connected');
    return c.callTool(toolName, args);
  }

  async listResources(name: string) {
    const c = this.clients.get(name);
    if (!c) throw new Error('Server not connected');
    return c.listResources();
  }

  async readResource(name: string, uri: string) {
    const c = this.clients.get(name);
    if (!c) throw new Error('Server not connected');
    return c.readResource(uri);
  }

  async listPrompts(name: string) {
    const c = this.clients.get(name);
    if (!c) throw new Error('Server not connected');
    return c.listPrompts();
  }

  async getPrompt(name: string, promptName: string, args?: Record<string, unknown>) {
    const c = this.clients.get(name);
    if (!c) throw new Error('Server not connected');
    return c.getPrompt(promptName, args);
  }
}

export const serverManager = new ServerManager();

