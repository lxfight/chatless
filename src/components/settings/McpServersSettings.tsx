"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { McpServerConfig } from "@/lib/mcp/McpClient";
import { serverManager } from "@/lib/mcp/ServerManager";
import { toast, trimToastDescription } from "@/components/ui/sonner";
import { downloadService } from "@/lib/utils/downloadService";
import { detectTauriEnvironment } from "@/lib/utils/environment";
import StorageUtil from "@/lib/storage";
import { 
  Plus, 
  Upload, 
  Download, 
  ChevronDown, 
  ChevronUp,
  RotateCcw,
  MoreVertical,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
  Settings
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type TransportType = "stdio" | "sse" | "http";

type SavedServer = {
  name: string;
  config: McpServerConfig;
  enabled?: boolean; // 新增：是否在聊天中默认可用（全局开关）
};

export function McpServersSettings() {
  const [servers, setServers] = useState<SavedServer[]>([]);
  const [editing, setEditing] = useState<SavedServer | null>(null);
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [exportText, setExportText] = useState("");
  const importNumsRef = React.useRef<HTMLPreElement | null>(null);
  const importAreaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const [editingJsonMode, setEditingJsonMode] = useState(false);
  const [editingJsonText, setEditingJsonText] = useState("");
  const [editingJsonError, setEditingJsonError] = useState("");

  // —— 删除确认对话框 ——
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [serverToDelete, setServerToDelete] = useState<string | null>(null);

  // —— 三点菜单状态管理 ——
  const [openMenuServer, setOpenMenuServer] = useState<string | null>(null);

  // —— 高级设置：最大递归深度 ——
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [maxDepthValue, setMaxDepthValue] = useState<number>(6);

  const loadAdvanced = useCallback(async () => {
    try {
      const val = await StorageUtil.getItem<number|"infinite">('max_tool_recursion_depth', 6, 'mcp-settings.json');
      setMaxDepthValue(val === 'infinite' ? 20 : (val ?? 6));
    } catch {
      setMaxDepthValue(6);
    }
  }, []);
  useEffect(() => { void loadAdvanced(); }, [loadAdvanced]);

  const saveAdvanced = useCallback(async (value: number) => {
    try {
      const toSave: number|"infinite" = value >= 20 ? 'infinite' : value;
      const { Store } = await import('@tauri-apps/plugin-store');
      const store = await Store.load('mcp-settings.json');
      await store.set('max_tool_recursion_depth', toSave);
      await store.save();
    } catch (e) {
      console.error('保存高级设置失败:', e);
    }
  }, []);

  // load/save via plugin-store if available, fallback to memory
  const loadServers = useCallback(async () => {
    try {
      const { Store } = await import("@tauri-apps/plugin-store");
      const store = await Store.load("mcp_servers.json");
      const list = (await store.get<SavedServer[]>("servers")) || [];
      // 默认启用
      const normalized = Array.isArray(list) ? list.map(s => ({ ...s, enabled: s.enabled !== false })) : [];
      setServers(normalized);
    } catch {
      // ignore; use memory default
    }
  }, []);

  const saveServers = useCallback(async (list: SavedServer[]) => {
    setServers(list);
    try {
      const { Store } = await import("@tauri-apps/plugin-store");
      const store = await Store.load("mcp_servers.json");
      await store.set("servers", list);
      await store.save();
    } catch {
      // ignore
    }
  }, []);

  // —— JSON Import/Export ——
  const importFromJson = async () => {
    setError("");
    setImportError("");
    try {
      const raw = JSON.parse(importText);
      const imported: SavedServer[] = [];
      // Format A: Continue/Cursor 风格 { mcpServers: { name: { command, args, url } } }
      if (raw && raw.mcpServers && typeof raw.mcpServers === 'object') {
        for (const [name, cfg] of Object.entries<any>(raw.mcpServers)) {
          if (cfg && typeof cfg === 'object') {
            if ((cfg as any).url) {
              const isSse = String((cfg as any).url).includes('/sse');
              imported.push({ name, config: { type: isSse ? 'sse' : 'http', baseUrl: (cfg as any).url, headers: [] } as any });
            } else {
              const args: string[] = Array.isArray((cfg as any).args) ? (cfg as any).args : [];
              imported.push({ name, config: { type: 'stdio', command: (cfg as any).command || 'npx', args, env: [] } as any });
            }
          }
        }
      }
      // Format B1: 通用数组 { servers: [ { name, type, command, args, env, url } ] }
      if (raw && Array.isArray(raw.servers)) {
        for (const item of raw.servers) {
          const name = item.name || 'mcp';
          if (item.type === 'stdio') {
            const envObj = item.env || {};
            const envPairs: [string,string][] = Object.entries(envObj).map(([k,v]) => [String(k), String(v)]);
            imported.push({ name, config: { type: 'stdio', command: item.command || 'npx', args: item.args || [], env: envPairs } as any });
          } else if (item.type === 'sse' || item.type === 'http') {
            const url = item.url || item.baseUrl;
            imported.push({ name, config: { type: item.type, baseUrl: url, headers: [] } as any });
          }
        }
      }
      // Format B2: 通用对象 { servers: { name: { type, ... } } }
      if (raw && raw.servers && typeof raw.servers === 'object' && !Array.isArray(raw.servers)) {
        for (const [name, item] of Object.entries<any>(raw.servers)) {
          if (!item || typeof item !== 'object') continue;
          if (item.type === 'stdio' || (!item.type && (item.command || item.args))) {
            const envObj = item.env || {};
            const envPairs: [string,string][] = Object.entries(envObj).map(([k,v]) => [String(k), String(v)]);
            imported.push({ name, config: { type: 'stdio', command: item.command || 'npx', args: item.args || [], env: envPairs } as any });
          } else if (item.type === 'sse' || item.type === 'http' || item.url || item.baseUrl) {
            const url = item.url || item.baseUrl;
            const type = item.type ? item.type : (String(url||'').includes('/sse') ? 'sse' : 'http');
            imported.push({ name, config: { type, baseUrl: url, headers: [] } as any });
          }
        }
      }
      if (imported.length === 0) throw new Error('无法识别的 JSON 格式');
      const byName = new Map(servers.map(s => [s.name, s] as const));
      for (const s of imported) byName.set(s.name, { ...s, enabled: true });
      const next = Array.from(byName.values());
      await saveServers(next);
      setImportOpen(false);
      setImportText("");
      toast.success("导入成功", { description: `共 ${imported.length} 条` });
    } catch (e) {
      setImportError('导入失败: ' + String(e));
    }
  };

  const buildExportJson = () => {
    const contStyle: any = { mcpServers: {} as any };
    for (const s of servers) {
      if (s.config.type === 'stdio') {
        (contStyle.mcpServers as any)[s.name] = { command: s.config.command, args: s.config.args };
      } else {
        (contStyle.mcpServers as any)[s.name] = { url: (s.config as any).baseUrl };
      }
    }
    const generic = {
      servers: servers.map(s => {
        if (s.config.type === 'stdio') {
          const envObj: Record<string,string> = {};
          (s.config.env || []).forEach(([k,v]) => { envObj[k] = v; });
          return { name: s.name, type: 'stdio', command: s.config.command, args: s.config.args, env: envObj };
        }
        return { name: s.name, type: s.config.type, url: (s.config as any).baseUrl };
      })
    };
    setExportText(JSON.stringify({ continueStyle: contStyle, generic }, null, 2));
  };

  useEffect(() => {
    loadServers();
    (async () => {
      try {
        const cache = (await StorageUtil.getItem<Record<string,string>>('mcp_status_map', {}, 'mcp-status.json')) || {};
        setStatusMap(cache);
      } catch {}
    })();
    const off = serverManager.on((e) => {
      if (e.type === "SERVER_STATUS") {
        setStatusMap((m) => { const next = { ...m, [e.payload.name]: e.payload.status } as Record<string,string>; StorageUtil.setItem('mcp_status_map', next, 'mcp-status.json').catch(()=>{}); return next; });
      }
      if (e.type === "ERROR") {
        setError(String(e.payload?.error ?? "未知错误"));
      }
    });
    return () => { off(); };
  }, [loadServers]);

  // 点击外部关闭三点菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('details')) {
        setOpenMenuServer(null);
      }
    };

    if (openMenuServer) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [openMenuServer]);

  const emptyConfig: McpServerConfig = useMemo(() => ({
    type: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-git"],
    env: [],
  }), []);

  const beginAdd = () => {
    setEditing({ name: "", config: emptyConfig });
    setError("");
  };

  const beginEdit = (s: SavedServer) => {
    setEditing(JSON.parse(JSON.stringify(s)));
    setError("");
    setEditingJsonMode(false);
    setEditingJsonText("");
    setEditingJsonError("");
  };

  const cancelEdit = () => setEditing(null);

  const persistEdit = async () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) { setError("请输入名称"); return; }
    const exists = servers.find((s) => s.name === name);
    let next = servers.slice();
    if (exists) {
      next = next.map((s) => (s.name === name ? editing : s));
    } else {
      next.unshift(editing);
    }
    await saveServers(next);
    setEditing(null);
    // 新增或更新后自动连接一次（降低心智负担）
    try {
      const s = next.find(x=>x.name===name);
      if (s) {
        // 首次配置为 npx/stdio 时，提示可能需要下载
        if (s.config.type === 'stdio' && (s.config.command||'') === 'npx') {
          toast.info('正在连接（可能需要首次下载）', { description: 'npx 将自动下载 MCP 服务器依赖，这可能需要 1-3 分钟，请耐心等待…' });
        }
        await serverManager.startServer(s.name, s.config);
        setError("");
        setStatusMap((m)=>{ const next = { ...m, [s.name]: 'connected' } as Record<string,string>; StorageUtil.setItem('mcp_status_map', next, 'mcp-status.json').catch(()=>{}); return next; });
        try {
          const tools = await Promise.race([
            serverManager.listTools(s.name) as any,
            new Promise((_, reject) => setTimeout(() => reject(new Error('list tools timeout')), 30000))
          ]) as any[];
          const count = Array.isArray(tools) ? tools.length : 0;
          toast.success("已保存并连接", { description: `${s.name} · Tools: ${count}` });
        } catch (verr) {
          toast.info("已保存并连接，但无法获取 Tools", { description: trimToastDescription(verr) });
        }
      }
    } catch (e) {
      setError(String(e));
      setStatusMap((m)=>{ const next = { ...m, [name]: 'disconnected' } as Record<string,string>; StorageUtil.setItem('mcp_status_map', next, 'mcp-status.json').catch(()=>{}); return next; });
      toast.error("保存成功但连接失败", { description: trimToastDescription(e) });
    }
  };

  const remove = async (name: string) => {
    setServerToDelete(name);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!serverToDelete) return;
    const list = servers.filter((s) => s.name !== serverToDelete);
    await saveServers(list);
    setDeleteDialogOpen(false);
    setServerToDelete(null);
  };

  const cancelDelete = () => {
    setDeleteDialogOpen(false);
    setServerToDelete(null);
  };

  const connect = async (s: SavedServer) => {
    setLoading(true);
    setError("");
    setStatusMap((m)=>{ const next = { ...m, [s.name]: 'connecting' } as Record<string,string>; StorageUtil.setItem('mcp_status_map', next, 'mcp-status.json').catch(()=>{}); return next; });
    try {
      if (s.config.type === 'stdio' && (s.config.command||'') === 'npx') {
        toast.info('正在连接（可能需要首次下载）', { description: 'npx 将自动下载 MCP 服务器依赖，这可能需要 1-3 分钟，请耐心等待…' });
      }
      await serverManager.startServer(s.name, s.config);
      setError("");
      setStatusMap((m)=>{ const next = { ...m, [s.name]: 'connected' } as Record<string,string>; StorageUtil.setItem('mcp_status_map', next, 'mcp-status.json').catch(()=>{}); return next; });
      try {
        const tools = await Promise.race([
          serverManager.listTools(s.name) as any,
          new Promise((_, reject) => setTimeout(() => reject(new Error('list tools timeout')), 30000))
        ]) as any[];
        const count = Array.isArray(tools) ? tools.length : 0;
        toast.success("连接成功", { description: `${s.name} · Tools: ${count}` });
      } catch (verr) {
        toast.info("已连接，但无法获取 Tools", { description: trimToastDescription(verr) });
      }
    } catch (e) {
      setError(String(e));
      setStatusMap((m)=>{ const next = { ...m, [s.name]: 'disconnected' } as Record<string,string>; StorageUtil.setItem('mcp_status_map', next, 'mcp-status.json').catch(()=>{}); return next; });
      toast.error("连接失败", { description: trimToastDescription(e) });
    }
    setLoading(false);
  };

  const disconnect = async (name: string) => {
    setLoading(true);
    setError("");
    try { await serverManager.stopServer(name); setError(""); toast.success("已断开", { description: name }); }
    catch (e) { setError(String(e)); toast.error("断开失败", { description: trimToastDescription(e) }); }
    setStatusMap((m)=>{ const next = { ...m, [name]: 'disconnected' } as Record<string,string>; StorageUtil.setItem('mcp_status_map', next, 'mcp-status.json').catch(()=>{}); return next; });
    setLoading(false);
  };

  const renderEditor = () => {
    if (!editing) return null;
    const { name, config } = editing;
    const type = config.type as TransportType;
    const setConfig = (next: Partial<McpServerConfig>) => setEditing({ name, config: { ...config, ...next } as McpServerConfig });
    const buildEditingJson = () => {
      let obj: any = { name, type };
      if (type === 'stdio') {
        const envObj: Record<string,string> = {};
        (config.env||[]).forEach(([k,v])=>{ envObj[k]=v; });
        obj.command = config.command; obj.args = config.args; if (Object.keys(envObj).length) obj.env = envObj;
      } else {
        obj.baseUrl = (config as any).baseUrl || (config as any).url;
        if ((config as any).headers) {
          const h: Record<string,string> = {}; (config as any).headers.forEach(([k,v]: any)=>{ h[k]=v; }); obj.headers = h;
        }
      }
      setEditingJsonText(JSON.stringify(obj, null, 2));
      setEditingJsonError("");
    };
    const applyEditingJson = () => {
      try {
        const raw = JSON.parse(editingJsonText || "{}");
        if (raw.name) (editing as any).name = String(raw.name);
        if (raw.type === 'stdio' || raw.command || raw.args) {
          const envPairs: [string,string][] = raw.env ? Object.entries(raw.env).map(([k,v])=>[String(k), String(v)]) : (config.env||[]);
          setEditing({ name: raw.name || name, config: { type: 'stdio', command: raw.command || config.command, args: raw.args || config.args, env: envPairs } as any });
        } else if (raw.type === 'sse' || raw.type === 'http' || raw.baseUrl || raw.url) {
          const url = raw.baseUrl || raw.url || (config as any).baseUrl;
          setEditing({ name: raw.name || name, config: { type: raw.type || type, baseUrl: url, headers: [] } as any });
        }
        setEditingJsonError("");
      } catch (e) {
        setEditingJsonError('JSON 解析失败: ' + String(e));
      }
    };
    const isCmdWrap = config.type === 'stdio' && config.command === 'cmd' && Array.isArray(config.args) && config.args[0] === '/c';
    const toggleCmdWrap = () => {
      if (config.type !== 'stdio') return;
      if (isCmdWrap) {
        // unwrap: cmd /c <cmd> <args...>
        const innerCmd = (config.args||[])[1] || 'npx';
        const innerArgs = (config.args||[]).slice(2);
        setConfig({ command: innerCmd as any, args: innerArgs as any });
      } else {
        const innerCmd = config.command || 'npx';
        const innerArgs = (config.args||[]);
        setConfig({ command: 'cmd' as any, args: ['/c', innerCmd, ...innerArgs] as any });
      }
    };
    const testConnect = async () => {
      try {
        await serverManager.startServer(name || 'mcp-test', config);
        const tools = await serverManager.listTools(name || 'mcp-test').catch(()=>[]);
        setError("");
        toast.success("测试连接成功", { description: `Tools: ${Array.isArray(tools)?tools.length:0}` });
      } catch (e) {
        setError(String(e));
        toast.error("测试连接失败", { description: trimToastDescription(e) });
      }
    };
    return (
      <div className="border border-gray-100 rounded-xl p-4 space-y-4 bg-white dark:bg-gray-900 shadow-sm">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-gray-50 pb-3">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">编辑服务器</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 text-sm" 
                onClick={()=>{ if (!editingJsonMode) buildEditingJson(); setEditingJsonMode(!editingJsonMode); }}
              >
                {editingJsonMode ? '切换到表单' : '切换到 JSON'}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{editingJsonMode ? '切换到表单编辑模式' : '切换到 JSON 编辑模式'}</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* 表单内容 */}
        {!editingJsonMode ? (
          <div className="space-y-4">
            {/* 基本信息 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">名称</label>
                <input 
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm" 
                  value={name} 
                  onChange={(e)=>setEditing({ name: e.target.value, config })} 
                  placeholder="输入服务器名称"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">传输类型</label>
                <select 
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm" 
                  value={type} 
                  onChange={(e)=>setConfig({ type: e.target.value as TransportType })}
                >
                  <option value="stdio">stdio</option>
                  <option value="sse">sse</option>
                  <option value="http">http</option>
                </select>
              </div>
            </div>

            {/* 配置详情 */}
            {type === "stdio" ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">命令</label>
                    <input 
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm" 
                      value={config.command || ""} 
                      onChange={(e)=>setConfig({ command: e.target.value })} 
                      placeholder="例如: npx"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">参数</label>
                    <input 
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm" 
                      placeholder="以空格分隔" 
                      value={(config.args||[]).join(" ")} 
                      onChange={(e)=>setConfig({ args: e.target.value.trim() ? e.target.value.split(/\s+/g) : [] })} 
                    />
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">环境变量</label>
                  <input 
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm" 
                    placeholder="KEY=VALUE,KEY2=VALUE2" 
                    value={(config.env||[]).map(([k,v])=>`${k}=${v}`).join(", ")} 
                    onChange={(e)=>{
                      const items = e.target.value.split(/,|\n/g).map(s=>s.trim()).filter(Boolean);
                      const pairs: [string,string][] = [];
                      for (const it of items){ const i = it.indexOf("="); if(i>0) pairs.push([it.slice(0,i).trim(), it.slice(i+1).trim()]); }
                      setConfig({ env: pairs });
                    }} 
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    checked={isCmdWrap} 
                    onChange={toggleCmdWrap}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Windows 兼容（cmd /c 包装）</span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Base URL</label>
                  <input 
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm" 
                    placeholder="http(s)://..." 
                    value={config.baseUrl || ""} 
                    onChange={(e)=>setConfig({ baseUrl: e.target.value })} 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">请求头</label>
                  <input 
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm" 
                    placeholder="Authorization=Bearer xxx, X-Api-Key=xxx" 
                    value={(config.headers||[]).map(([k,v])=>`${k}=${v}`).join(", ")} 
                    onChange={(e)=>{
                      const items = e.target.value.split(/,|\n/g).map(s=>s.trim()).filter(Boolean);
                      const pairs: [string,string][] = [];
                      for (const it of items){ const i = it.indexOf("="); if(i>0) pairs.push([it.slice(0,i).trim(), it.slice(i+1).trim()]); }
                      setConfig({ headers: pairs });
                    }} 
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              JSON 编辑（可直接粘贴配置，支持 name/type/command/args/env 或 baseUrl/headers）
            </div>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex">
                <pre ref={importNumsRef} className="select-none text-right text-xs leading-6 px-2 py-2 w-10 bg-gray-50 dark:bg-gray-800 text-gray-400 overflow-hidden" style={{maxHeight: 200}}>
                  {editingJsonText.split('\n').map((_,i)=>String(i+1)).join('\n')}
                </pre>
                <textarea 
                  value={editingJsonText} 
                  onChange={(e)=>setEditingJsonText(e.target.value)} 
                  onScroll={(e)=>{ if(importNumsRef.current){ importNumsRef.current.scrollTop = (e.target as HTMLTextAreaElement).scrollTop; } }} 
                  className="flex-1 font-mono text-sm p-2 leading-6 bg-white dark:bg-gray-900 outline-none resize-none" 
                  style={{maxHeight:200}} 
                  placeholder="在此粘贴 JSON 配置..."
                />
              </div>
            </div>
            {editingJsonError && (
              <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                {editingJsonError}
              </div>
            )}
            <div className="flex justify-end">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    className="px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 text-sm" 
                    onClick={applyEditingJson}
                  >
                    应用到表单
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>将 JSON 配置应用到表单中</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}

        {/* 错误信息 */}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-2 pt-3 border-t border-gray-50">
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                className="px-4 py-1.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-all duration-200 shadow-sm hover:shadow-md text-sm" 
                onClick={persistEdit}
              >
                保存
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>保存服务器配置</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                className="px-4 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 text-sm" 
                onClick={cancelEdit}
              >
                取消
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>取消编辑</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                className="px-4 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 text-sm" 
                onClick={testConnect}
              >
                测试连接
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>测试服务器连接</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    );
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">MCP 服务器设置</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">在此设置 MCP 服务器，包括服务器类型、命令、参数、环境变量等。</p>
      </div>  

        <div className="flex gap-2 items-center">
          {/* 主要操作按钮组 */}
          <div className="flex gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  className="w-10 h-10 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 flex items-center justify-center" 
                  onClick={beginAdd}
                >
                  <Plus className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>新增服务器</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  className="w-10 h-10 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 flex items-center justify-center" 
                  onClick={()=>{ setImportOpen(true); setImportText(""); }}
                >
                  <Upload className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>导入配置</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  className="w-10 h-10 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 flex items-center justify-center" 
                  onClick={async()=>{
                    try {
                      // 参考 AdvancedSettings 的下载服务，兼容 macOS/Tauri
                      const data = { servers };
                      const json = JSON.stringify(data, null, 2);
                      const fileName = `mcp_servers-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}`;
                      const ok = await downloadService.downloadJson(fileName, data);
                      if (!ok) {
                        // 回退方案（浏览器场景）
                        const isTauri = await detectTauriEnvironment();
                        if (!isTauri) {
                          const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = fileName;
                          document.body.appendChild(a);
                          a.click();
                          a.remove();
                          URL.revokeObjectURL(url);
                        }
                      }
                      toast.success('已导出 MCP 配置');
                    } catch (e) {
                      toast.error('导出失败', { description: trimToastDescription(e) });
                    }
                  }}
                >
                  <Download className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>导出配置</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

      {renderEditor()}

      {/* 高级设置 */}
      <div className="border border-gray-100 rounded-xl p-4 bg-white dark:bg-gray-900 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">高级设置</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200" 
                onClick={() => setAdvancedOpen(v=>!v)}
              >
                <Settings className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{advancedOpen ? '隐藏高级设置' : '显示高级设置'}</p>
            </TooltipContent>
          </Tooltip>
        </div>
        {advancedOpen && (
          <div className="mt-4 space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                最大工具递归次数
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={2}
                  max={20}
                  step={1}
                  value={maxDepthValue}
                  onChange={(e) => {
                    const newValue = Number(e.target.value);
                    setMaxDepthValue(newValue);
                    saveAdvanced(newValue);
                  }}
                  className="flex-1 appearance-none w-full h-2 rounded-full cursor-pointer bg-gray-200 dark:bg-gray-700 focus:outline-none focus:ring-0 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-150 [&::-webkit-slider-thumb]:hover:scale-105"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400 min-w-[3rem] text-center">
                  {maxDepthValue >= 20 ? '∞' : maxDepthValue}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                拖动到最右侧表示无限制，2-19表示具体次数
              </p>
            </div>
          </div>
        )}
      </div>

            {importOpen && (
        <div className="border border-gray-100 rounded-xl p-4 space-y-3 bg-white dark:bg-gray-900 shadow-sm">
          <div className="border-b border-gray-50 pb-3">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">导入 JSON</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              支持两种格式：1) Continue/Cursor 风格 {"{ mcpServers: {...} }"}；2) 通用风格 {"{ servers: [ ... ] }"}
            </p>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">JSON 配置</label>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex">
                <pre ref={importNumsRef} className="select-none text-right text-xs leading-6 px-2 py-2 w-10 bg-gray-50 dark:bg-gray-800 text-gray-400 overflow-hidden">
                  {importText.split('\n').map((_,i)=>String(i+1)).join('\n')}
                </pre>
                <textarea 
                  ref={importAreaRef} 
                  onScroll={(e)=>{ if(importNumsRef.current){ importNumsRef.current.scrollTop = (e.target as HTMLTextAreaElement).scrollTop; } }} 
                  className="flex-1 font-mono text-sm p-2 leading-6 bg-white dark:bg-gray-900 outline-none resize-none" 
                  value={importText} 
                  onChange={(e)=>setImportText(e.target.value)}
                  placeholder="在此粘贴 JSON 配置..."
                  style={{height: '140px'}}
                />
              </div>
            </div>
          </div>
          
          {importError && (
            <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
              {importError}
            </div>
          )}
          
          <div className="flex gap-2 pt-3 border-t border-gray-50">
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  className="px-4 py-1.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-all duration-200 shadow-sm hover:shadow-md text-sm" 
                  onClick={importFromJson}
                >
                  导入
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>导入 JSON 配置</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  className="px-4 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 text-sm" 
                  onClick={()=>{ setImportOpen(false); setImportText(""); }}
                >
                  取消
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>取消导入</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {servers.length === 0 && <div className="text-xs text-slate-500">尚未添加服务器。</div>}
        {servers.map((s) => {
          const st = statusMap[s.name] || "disconnected";
          return (
            <div key={s.name} className="border rounded-xl p-3 bg-white/70 dark:bg-gray-900/60">
              <div className="flex items-center justify-between">
                <div className="font-medium flex items-center gap-2">
                  <span>{s.name}</span>
                                     <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full ${st==='connected'?'bg-emerald-50 text-emerald-600 border border-emerald-100':'bg-gray-50 text-gray-500 border border-gray-100'}`}>
                    {st === 'connected' ? (
                      <CheckCircle className="w-3 h-3" />
                    ) : st === 'connecting' ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <XCircle className="w-3 h-3" />
                    )}
                    {st}
                  </span>
                </div>
                                 {/* 右侧：启用勾选框与刷新按钮 */}
                 <div className="flex items-center gap-2">
                   {/* 启用勾选框 */}
                   <Checkbox
                     checked={s.enabled !== false}
                     onCheckedChange={(checked) => {
                       const next = servers.map(x => x.name === s.name ? { ...x, enabled: !!checked } : x);
                       saveServers(next);
                     }}
                     className="h-4 w-4"
                   />
                   {/* 刷新按钮 */}
                   <Tooltip>
                     <TooltipTrigger asChild>
                       <button 
                         className="w-8 h-8 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 disabled:opacity-60 transition-all duration-200 flex items-center justify-center" 
                         disabled={loading} 
                         onClick={()=>connect(s)}
                       >
                         {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                       </button>
                     </TooltipTrigger>
                     <TooltipContent>
                       <p>刷新连接</p>
                     </TooltipContent>
                   </Tooltip>
                   {/* 三点菜单：不常用操作 */}
                   <details 
                     className="relative"
                     open={openMenuServer === s.name}
                     onToggle={(e) => {
                       if (e.currentTarget.open) {
                         setOpenMenuServer(s.name);
                       } else {
                         setOpenMenuServer(null);
                       }
                     }}
                   >
                     <summary className="list-none w-8 h-8 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 cursor-pointer transition-all duration-200 flex items-center justify-center shadow-sm hover:shadow-md">
                       <MoreVertical className="w-4 h-4" />
                     </summary>
                     <div className="absolute right-0 mt-2 w-40 rounded-lg border bg-white dark:bg-gray-800 shadow-lg py-1 text-sm z-10">
                       <button 
                         className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2" 
                         onClick={() => {
                           beginEdit(s);
                           setOpenMenuServer(null);
                         }}
                       >
                         <Edit className="w-4 h-4" />
                         编辑
                       </button>
                       <button 
                         className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2" 
                         onClick={() => {
                           remove(s.name);
                           setOpenMenuServer(null);
                         }}
                       >
                         <Trash2 className="w-4 h-4" />
                         删除
                       </button>
                     </div>
                   </details>
                </div>
              </div>
              {/* 次要信息行：命令/URL */}
              <div className="mt-2 text-xs text-slate-500">
                {s.config.type === 'stdio' ? `${s.config.command} ${(s.config.args||[]).join(' ')}` : `${s.config.type} ${s.config.baseUrl}`}
              </div>
            </div>
          );
        })}
      </div>
            {exportText && (
        <div className="border border-gray-200 rounded-xl p-6 space-y-4 bg-white dark:bg-gray-900 shadow-sm">
          <div className="border-b border-gray-100 pb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">导出 JSON</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">可复制保存为 mcp.json</p>
          </div>
          
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">配置内容</label>
            <textarea 
              className="w-full h-40 border border-gray-200 rounded-lg p-3 font-mono text-sm bg-gray-50 dark:bg-gray-800 resize-none" 
              value={exportText} 
              readOnly 
            />
          </div>
        </div>
      )}

       {/* 删除确认对话框 */}
       <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
         <AlertDialogContent>
           {/* 右上角关闭按钮 */}
           <button
             onClick={() => setDeleteDialogOpen(false)}
             className="absolute top-4 right-4 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 cursor-pointer"
             aria-label="关闭"
           >
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
             </svg>
           </button>
           
           <AlertDialogHeader className="pr-8">
             <AlertDialogTitle>确认删除</AlertDialogTitle>
             <AlertDialogDescription>
               确定要删除服务器 <span className="font-medium">{serverToDelete}</span> 吗？此操作无法撤销。
             </AlertDialogDescription>
           </AlertDialogHeader>
           <AlertDialogFooter>
             <AlertDialogCancel onClick={cancelDelete}>取消</AlertDialogCancel>
             <AlertDialogAction onClick={confirmDelete}>
               删除
             </AlertDialogAction>
           </AlertDialogFooter>
         </AlertDialogContent>
       </AlertDialog>
       </div>
     </TooltipProvider>
   );
 }

