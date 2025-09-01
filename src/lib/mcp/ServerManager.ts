import { McpClient } from "./McpClient";
import { MCP_CONNECT_TIMEOUT_MS, MCP_INIT_TIMEOUT_MS } from "./constants";
import { useMcpStore } from "@/store/mcpStore";

class ServerManager {
  private clients = new Map<string, McpClient>();
  private listeners: ((event: any) => void)[] = [];

  // 统一更新状态 & 通知
  private updateStatus(name: string, status: string) {
    const store = useMcpStore.getState();
    store.setServerStatus(name, status);
    this.emit({ type: "SERVER_STATUS", payload: { name, status } });
  }

  async startServer(name: string, config: any): Promise<void> {
    try {
      this.updateStatus(name, "connecting");

      const { startupMonitor } = await import('@/lib/utils/startupPerformanceMonitor');
      startupMonitor.startPhase(`MCP连接-${name}`, {
        description: `连接MCP服务器: ${name}`,
        serverName: name
      });

      const client = new McpClient(name, config);
      this.clients.set(name, client);

      // 使用Promise.race实现连接超时
      await Promise.race([
        client.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`连接超时: ${name}`)), MCP_CONNECT_TIMEOUT_MS)
        )
      ]);

      // 验证连接并预热缓存
      await Promise.race([
        this.validateConnectionAndWarmCache(client, name),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`初始化超时: ${name}`)), MCP_INIT_TIMEOUT_MS)
        )
      ]);

      startupMonitor.endPhase(`MCP连接-${name}`);
      
      // 连接成功，更新状态
      this.updateStatus(name, "connected");
      
    } catch (error) {
      try {
        const { startupMonitor } = await import('@/lib/utils/startupPerformanceMonitor');
        startupMonitor.endPhase(`MCP连接-${name}`);
      } catch {}
      
      // 清理失败的客户端
      this.clients.delete(name);
      
      console.error(`Failed to start server ${name}:`, error);
      
      // 连接失败，更新状态并清除工具缓存
      this.updateStatus(name, "error");
      useMcpStore.getState().clearToolsCache(name);
      
      throw error;
    }
  }

  private async validateConnectionAndWarmCache(client: McpClient, name: string): Promise<void> {
    try {
      const { startupMonitor } = await import('@/lib/utils/startupPerformanceMonitor');
      startupMonitor.startPhase(`MCP验证-${name}`, {
        description: `验证MCP服务器连接: ${name}`,
        serverName: name
      });

      // 验证连接
      console.log(`🔍 [MCP] 正在验证服务器 ${name} 的连接...`);
      const tools = await client.listTools();
      
      if (!Array.isArray(tools)) {
        throw new Error(`Invalid tools response from ${name}: expected array, got ${typeof tools}`);
      }

      console.log(`📋 [MCP] 服务器 ${name} 返回了 ${tools.length} 个工具`);

      // 预热工具缓存
      const store = useMcpStore.getState();
      store.updateToolsCache(name, tools);
      console.log(`💾 [MCP] 已缓存服务器 ${name} 的 ${tools.length} 个工具`);

      startupMonitor.endPhase(`MCP验证-${name}`);
    } catch (error) {
      try {
        const { startupMonitor } = await import('@/lib/utils/startupPerformanceMonitor');
        startupMonitor.endPhase(`MCP验证-${name}`);
      } catch {}
      
      console.error(`❌ [MCP] 验证服务器 ${name} 失败:`, error);
      throw error;
    }
  }

  async stopServer(name: string): Promise<void> {
    const client = this.clients.get(name);
    if (client) {
      try {
        await client.disconnect();
        this.clients.delete(name);
        this.emit({ type: "SERVER_STATUS", payload: { name, status: "disconnected" } });
        
        // 立即更新store状态并清除工具缓存
        const store = useMcpStore.getState();
        store.setServerStatus(name, "disconnected");
        store.clearToolsCache(name);
      } catch (error) {
        console.error(`Failed to stop server ${name}:`, error);
        this.emit({ type: "ERROR", payload: { error: String(error) } });
        throw error;
      }
    }
  }

  async listTools(serverName: string): Promise<any[]> {
    const client = this.clients.get(serverName);
    if (!client) {
      // 如果客户端不存在但状态显示为已连接，尝试重新连接
      const store = useMcpStore.getState();
      const status = store.serverStatuses[serverName];
      if (status === 'connected') {
        console.warn(`[MCP] 客户端 ${serverName} 不存在但状态为已连接，更新状态为未连接`);
        store.setServerStatus(serverName, 'disconnected');
      }
      throw new Error(`Server ${serverName} not found`);
    }
    return client.listTools();
  }

  async callTool(serverName: string, toolName: string, args: any): Promise<any> {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`Server ${serverName} not found`);
    }
    return client.callTool(toolName, args);
  }

  async listResources(serverName: string): Promise<any> {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`Server ${serverName} not found`);
    }
    return client.listResources();
  }

  async readResource(serverName: string, uri: string): Promise<any> {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`Server ${serverName} not found`);
    }
    return client.readResource(uri);
  }

  async listPrompts(serverName: string): Promise<any> {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`Server ${serverName} not found`);
    }
    return client.listPrompts();
  }

  async getPrompt(serverName: string, name: string, args?: Record<string, unknown>): Promise<any> {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`Server ${serverName} not found`);
    }
    return client.getPrompt(name, args);
  }



  on(listener: (event: any) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private emit(event: any): void {
    this.listeners.forEach(listener => listener(event));
  }

  // 检查服务器是否真正连接
  isServerConnected(name: string): boolean {
    return this.clients.has(name);
  }

  // 获取所有已连接的服务器名称
  getConnectedServers(): string[] {
    return Array.from(this.clients.keys());
  }

  // 初始化：连接所有启用的服务器
  async init(): Promise<void> {
    try {
      const { Store } = await import('@tauri-apps/plugin-store');
      const { startupMonitor } = await import('@/lib/utils/startupPerformanceMonitor');
      startupMonitor.startPhase('MCP服务器连接', { description: '应用启动连接MCP服务器' });

      const storeFile = 'mcp_servers.json';
      const cfgStore = await Store.load(storeFile);
      let servers: Array<{ name: string; config: any; enabled?: boolean }> = (await cfgStore.get('servers')) || [];
      
      // 如果没有配置，记录日志但不自动创建
      if (servers.length === 0) {
        console.log('[MCP] 未找到MCP服务配置，请手动配置MCP服务');
      }
      
      const enabled = servers.filter(s => s && s.enabled !== false);
      await Promise.all(enabled.map(async (s) => {
        try {
          await this.startServer(s.name, s.config);
        } catch (e) {
          console.error(`[MCP] 启动时连接 ${s.name} 失败:`, e);
        }
      }));

      startupMonitor.endPhase('MCP服务器连接');
    } catch (e) {
      console.error('[MCP] 初始化失败:', e);
    }
  }
}

export const serverManager = new ServerManager();

