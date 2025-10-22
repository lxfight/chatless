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
      } catch {
        // 忽略 endPhase 错误
      }
      
      // 清理失败的客户端
      this.clients.delete(name);
      
      console.error(`Failed to start server ${name}:`, error);
      
      // 连接失败，更新状态并清除工具缓存
      this.updateStatus(name, "error");
      useMcpStore.getState().clearToolsCache(name);
      
      throw error;
    }
  }

  // 强制重连：用于刷新/会话漂移自愈
  async reconnect(name: string, config: any): Promise<void> {
    try {
      await this.stopServer(name).catch(() => {});
    } catch { /* noop */ }
    await this.startServer(name, config);
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
      } catch { /* noop during endPhase */ }
      
      console.error(`❌ [MCP] 验证服务器 ${name} 失败:`, error);
      // 自愈策略：会话失效/400/解码错误时，尝试一次强制重连后重试 listTools
      const msg = error instanceof Error ? error.message : String(error);
      const shouldReconnect = /400|401|404|deserializ|decode|expected value|session/i.test(msg);
      if (!shouldReconnect) throw error;
      try {
        const { Store } = await import('@tauri-apps/plugin-store');
        const cfgStore = await Store.load('mcp_servers.json');
        const srvList: Array<{ name: string; config: any; enabled?: boolean }> = (await cfgStore.get('servers')) || [];
        const found = srvList.find(s => s.name === name);
        if (found) {
          console.warn(`[MCP] ${name} 尝试强制重连以修复会话…`);
          await this.reconnect(name, found.config);
          // 重连成功后本方法会在 startServer 中再次调用，无需再抛错
          return;
        }
      } catch (e) {
        console.error(`[MCP] ${name} 强制重连失败`, e);
      }
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
    console.log(`[MCP-DEBUG] ServerManager.callTool 开始`, {
      serverName,
      toolName,
      args,
      hasClient: this.clients.has(serverName),
      clientsCount: this.clients.size,
      connectedServers: Array.from(this.clients.keys())
    });
    
    const client = this.clients.get(serverName);
    if (!client) {
      console.error(`[MCP-DEBUG] 客户端未找到: ${serverName}`, {
        availableClients: Array.from(this.clients.keys()),
        requestedServer: serverName
      });
      throw new Error(`Server ${serverName} not found`);
    }
    
    try {
      console.log(`[MCP-DEBUG] 调用客户端工具: ${serverName}.${toolName}`);
      const result = await client.callTool(toolName, args);
      console.log(`[MCP-DEBUG] 客户端工具调用成功: ${serverName}.${toolName}`, {
        resultType: typeof result,
        resultSize: result ? (typeof result === 'string' ? result.length : JSON.stringify(result).length) : 0
      });
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[MCP-DEBUG] 客户端工具调用失败: ${serverName}.${toolName}`, {
        error: errorMessage,
        errorStack: error instanceof Error ? error.stack : undefined,
        errorType: typeof error
      });
      
      // 自愈策略：检测SSE会话失效/400错误时，尝试重连
      const shouldReconnect = /400|401|404|session|deserializ|decode|expected value/i.test(errorMessage);
      if (shouldReconnect) {
        console.warn(`[MCP-DEBUG] 检测到会话失效错误，尝试重连 ${serverName}...`);
        try {
          const { Store } = await import('@tauri-apps/plugin-store');
          const cfgStore = await Store.load('mcp_servers.json');
          const srvList: Array<{ name: string; config: any; enabled?: boolean }> = (await cfgStore.get('servers')) || [];
          const found = srvList.find(s => s.name === serverName);
          if (found) {
            console.log(`[MCP-DEBUG] 开始强制重连 ${serverName}...`);
            await this.reconnect(serverName, found.config);
            
            // 重连成功后重新获取客户端并重试调用
            const newClient = this.clients.get(serverName);
            if (newClient) {
              console.log(`[MCP-DEBUG] 重连成功，重试调用工具: ${serverName}.${toolName}`);
              const retryResult = await newClient.callTool(toolName, args);
              console.log(`[MCP-DEBUG] 重试调用成功: ${serverName}.${toolName}`);
              return retryResult;
            }
          }
        } catch (reconnectError) {
          console.error(`[MCP-DEBUG] 自愈重连失败: ${serverName}`, reconnectError);
        }
      }
      
      throw error;
    }
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

  // 初始化：连接所有启用的服务器（完全异步，不阻塞）
  async init(): Promise<void> {
    try {
      const { Store } = await import('@tauri-apps/plugin-store');
      const { startupMonitor } = await import('@/lib/utils/startupPerformanceMonitor');
      startupMonitor.startPhase('MCP服务器连接', { description: '应用启动连接MCP服务器' });

      const storeFile = 'mcp_servers.json';
      const cfgStore = await Store.load(storeFile);
      const servers: Array<{ name: string; config: any; enabled?: boolean }> = (await cfgStore.get('servers')) || [];
      
      // 如果没有配置，记录日志但不自动创建
      if (servers.length === 0) {
        console.log('[MCP] 未找到MCP服务配置，请手动配置MCP服务');
        startupMonitor.endPhase('MCP服务器连接');
        return;
      }
      
      const enabled = servers.filter((s: { name: string; config: any; enabled?: boolean }) => s && s.enabled !== false);
      
      console.log(`[MCP] 开始启动 ${enabled.length} 个MCP服务...`);
      
      // 不使用 Promise.all，让每个服务独立启动，互不阻塞
      // 这样即使某个服务启动慢，也不会影响其他服务
      enabled.forEach((s) => {
        // 完全异步启动，不等待结果
        Promise.resolve().then(async () => {
          try {
            console.log(`[MCP] 正在启动服务: ${s.name}`);
            await this.startServer(s.name, s.config);
            console.log(`[MCP] 服务 ${s.name} 启动成功`);
          } catch (e) {
            console.error(`[MCP] 启动服务 ${s.name} 失败:`, e);
          }
        });
      });

      // 立即结束此阶段，不等待所有服务启动完成
      startupMonitor.endPhase('MCP服务器连接');
      console.log('[MCP] MCP服务正在后台启动中...');
    } catch (e) {
      console.error('[MCP] 初始化失败:', e);
    }
  }
}

export const serverManager = new ServerManager();

