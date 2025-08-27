import StorageUtil from '@/lib/storage';
import { serverManager } from './ServerManager';
import { McpServerConfig } from './McpClient'; // Added for getAllConfiguredServersWithStatus

const STORE_FILE = 'mcp-status.json'; // For conversation-specific MCP status
const SETTINGS_FILE = 'mcp-settings.json'; // For global enabled MCP list
const SERVERS_CONFIG_FILE = 'mcp_servers.json'; // For server configurations

// 解析模型输出中的 MCP 工具调用
// 支持：
// 1) 明确包裹 <tool_call> ... </tool_call>
// 2) 纯 JSON：{"type":"tool_call","server":"filesystem","tool":"list","parameters":{...}}
// 3) 前缀/代码块包裹 ```json ... ```
// 旧版文本解析器已废弃；统一由 StructuredStreamTokenizer 负责

// Retrieves all configured servers from settings, optionally filtered by 'enabled' status
export async function getAllConfiguredServers(onlyEnabled: boolean = false): Promise<string[]> {
  try {
    const { Store } = await import('@tauri-apps/plugin-store');
    const store = await Store.load(SERVERS_CONFIG_FILE);
    const list = (await store.get<Array<{ name: string; enabled?: boolean }>>('servers')) || [];
    return Array.isArray(list)
      ? list.filter(s => !onlyEnabled || s.enabled !== false).map((s) => s.name).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

// Retrieves all configured servers with their full config and current connection status
export async function getAllConfiguredServersWithStatus(): Promise<Array<{ name: string; config: McpServerConfig; status: string; enabled: boolean }>> {
  try {
    const { Store } = await import('@tauri-apps/plugin-store');
    const store = await Store.load(SERVERS_CONFIG_FILE);
    const list = (await store.get<Array<{ name: string; config: McpServerConfig; enabled?: boolean }>>('servers')) || [];
    const statusMap = (await StorageUtil.getItem<Record<string, string>>('mcp_status_map', {}, STORE_FILE)) || {};
    return Array.isArray(list)
      ? list.map(s => ({
          name: s.name,
          config: s.config,
          status: serverManager.getStatus(s.name) || statusMap[s.name] || 'disconnected',
          enabled: s.enabled !== false, // Default to true if not set
        }))
      : [];
  } catch (e) {
    console.error('Failed to load configured servers with status:', e);
    return [];
  }
}

// Retrieves names of currently connected servers (runtime or persisted)
export async function getConnectedServers(): Promise<string[]> {
  const allEnabled = await getAllConfiguredServers(true);
  // 仅依据运行时状态，避免历史脏值造成“已连接”假象
  return allEnabled.filter((name) => serverManager.getStatus(name) === 'connected');
}

// Retrieves conversation-specific enabled servers (deprecated in favor of global)
export async function getEnabledServersForConversation(conversationId: string): Promise<string[]> {
  if (!conversationId) return [];
  return (
    (await StorageUtil.getItem<string[]>(`conv_${conversationId}_enabled_mcp`, [], STORE_FILE)) || []
  );
}

// Sets conversation-specific enabled servers (deprecated in favor of global)
export async function setEnabledServersForConversation(conversationId: string, servers: string[]): Promise<void> {
  if (!conversationId) return;
  await StorageUtil.setItem(`conv_${conversationId}_enabled_mcp`, Array.from(new Set(servers)), STORE_FILE);
}

// Retrieves globally enabled servers (shared across all conversations)
export async function getGlobalEnabledServers(): Promise<string[]> {
  try {
    const list = await StorageUtil.getItem<string[]>('enabled_mcp_servers', [], SETTINGS_FILE);
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

// Sets globally enabled servers
export async function setGlobalEnabledServers(servers: string[]): Promise<void> {
  await StorageUtil.setItem('enabled_mcp_servers', Array.from(new Set(servers)), SETTINGS_FILE);
}

// 已配置且启用的服务器（用于列表控制）
export async function getEnabledConfiguredServers(): Promise<string[]> {
  try {
    const { Store } = await import('@tauri-apps/plugin-store');
    const store = await Store.load('mcp_servers.json');
    const list = (await store.get<Array<{ name: string; enabled?: boolean }>>('servers')) || [];
    return list.filter(s => s && (s.enabled !== false)).map(s => s.name);
  } catch { return []; }
}

