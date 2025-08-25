"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { McpServerConfig } from "@/lib/mcp/McpClient";
import { serverManager } from "@/lib/mcp/ServerManager";
import { toast } from "sonner";
import { trimToastDescription } from "@/components/ui/sonner";
import StorageUtil from "@/lib/storage";

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
    if (!confirm(`删除服务器 “${name}”？`)) return;
    const list = servers.filter((s) => s.name !== name);
    await saveServers(list);
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
      <div className="border rounded-lg p-4 space-y-3 bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">编辑服务器</div>
          <button className="px-2 py-1 rounded text-xs bg-slate-200 dark:bg-slate-700" onClick={()=>{ if (!editingJsonMode) buildEditingJson(); setEditingJsonMode(!editingJsonMode); }}>
            {editingJsonMode ? '切换到表单' : '切换到 JSON'}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="flex items-center gap-2">
            <span className="w-28">名称</span>
            <input className="border px-2 py-1 rounded w-full" value={name} onChange={(e)=>setEditing({ name: e.target.value, config })} />
          </label>
          <label className="flex items-center gap-2">
            <span className="w-28">传输</span>
            <select className="border px-2 py-1 rounded w-full" value={type} onChange={(e)=>setConfig({ type: e.target.value as TransportType })}>
              <option value="stdio">stdio</option>
              <option value="sse">sse</option>
              <option value="http">http</option>
            </select>
          </label>
          {!editingJsonMode && type === "stdio" ? (
            <>
              <label className="flex items-center gap-2">
                <span className="w-28">Command</span>
                <input className="border px-2 py-1 rounded w-full" value={config.command || ""} onChange={(e)=>setConfig({ command: e.target.value })} />
              </label>
              <label className="flex items-center gap-2 md:col-span-2">
                <span className="w-28">Args</span>
                <input className="border px-2 py-1 rounded w-full" placeholder="以空格分隔" value={(config.args||[]).join(" ")} onChange={(e)=>setConfig({ args: e.target.value.trim() ? e.target.value.split(/\s+/g) : [] })} />
              </label>
              <label className="flex items-center gap-2 md:col-span-3 text-xs">
                <input type="checkbox" checked={isCmdWrap} onChange={toggleCmdWrap} />
                <span>Windows 兼容（cmd /c 包装）</span>
              </label>
              <label className="flex items-center gap-2 md:col-span-3">
                <span className="w-28">Env</span>
                <input className="border px-2 py-1 rounded w-full" placeholder="KEY=VALUE,KEY2=VALUE2" value={(config.env||[]).map(([k,v])=>`${k}=${v}`).join(", ")} onChange={(e)=>{
                  const items = e.target.value.split(/,|\n/g).map(s=>s.trim()).filter(Boolean);
                  const pairs: [string,string][] = [];
                  for (const it of items){ const i = it.indexOf("="); if(i>0) pairs.push([it.slice(0,i).trim(), it.slice(i+1).trim()]); }
                  setConfig({ env: pairs });
                }} />
              </label>
            </>
          ) : !editingJsonMode ? (
            <>
              <label className="flex items-center gap-2 md:col-span-3">
                <span className="w-28">Base URL</span>
                <input className="border px-2 py-1 rounded w-full" placeholder="http(s)://..." value={config.baseUrl || ""} onChange={(e)=>setConfig({ baseUrl: e.target.value })} />
              </label>
              <label className="flex items-center gap-2 md:col-span-3">
                <span className="w-28">Headers</span>
                <input className="border px-2 py-1 rounded w-full" placeholder="Authorization=Bearer xxx, X-Api-Key=xxx" value={(config.headers||[]).map(([k,v])=>`${k}=${v}`).join(", ")} onChange={(e)=>{
                  const items = e.target.value.split(/,|\n/g).map(s=>s.trim()).filter(Boolean);
                  const pairs: [string,string][] = [];
                  for (const it of items){ const i = it.indexOf("="); if(i>0) pairs.push([it.slice(0,i).trim(), it.slice(i+1).trim()]); }
                  setConfig({ headers: pairs });
                }} />
              </label>
            </>
          ) : null}
        </div>
        {editingJsonMode && (
          <div className="border rounded-md bg-slate-50 dark:bg-slate-800 p-0 overflow-hidden">
            <div className="text-xs text-slate-500 px-2 py-1">JSON 编辑（可直接粘贴配置，支持 name/type/command/args/env 或 baseUrl/headers）</div>
            <div className="flex">
              <pre ref={importNumsRef} className="select-none text-right text-[11px] leading-5 px-2 py-2 w-10 bg-slate-100 dark:bg-slate-900 text-slate-400 overflow-hidden" style={{maxHeight: 240}}>
                {editingJsonText.split('\n').map((_,i)=>String(i+1)).join('\n')}
              </pre>
              <textarea value={editingJsonText} onChange={(e)=>setEditingJsonText(e.target.value)} onScroll={(e)=>{ if(importNumsRef.current){ importNumsRef.current.scrollTop = (e.target as HTMLTextAreaElement).scrollTop; } }} className="flex-1 font-mono text-xs p-2 leading-5 bg-transparent outline-none" style={{maxHeight:240}} />
            </div>
            {editingJsonError && <div className="text-xs text-red-600 px-2 py-1">{editingJsonError}</div>}
            <div className="px-2 py-2">
              <button className="px-2 py-1 rounded bg-blue-600 text-white text-xs" onClick={applyEditingJson}>应用到表单</button>
            </div>
          </div>
        )}
        {error && <div className="text-xs text-red-600">{error}</div>}
        <div className="flex gap-2">
          <button className="px-3 py-1 rounded bg-blue-600 text-white" onClick={persistEdit}>保存</button>
          <button className="px-3 py-1 rounded bg-gray-600 text-white" onClick={cancelEdit}>取消</button>
          <button className="px-3 py-1 rounded bg-emerald-600 text-white" onClick={testConnect}>测试连接</button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">MCP 服务器管理</h2>
        <p className="text-xs text-slate-500">在此添加/编辑服务器配置，并进行连接管理。聊天会话中可选择已连接服务器，AI 将按需调用工具/资源/提示。</p>
      </div>

      <div className="flex gap-2">
        <button className="px-3 py-1 rounded bg-emerald-600 text-white" onClick={beginAdd}>新增服务器</button>
        <button className="px-3 py-1 rounded bg-indigo-600 text-white" onClick={()=>{ setImportOpen(true); setImportText(""); }}>导入 JSON</button>
        <button className="px-3 py-1 rounded bg-indigo-700 text-white" onClick={buildExportJson}>导出 JSON</button>
      </div>

      {renderEditor()}

      {importOpen && (
        <div className="border rounded-lg p-4 space-y-2 bg-white dark:bg-gray-900">
          <div className="text-sm font-medium">导入 JSON</div>
          <div className="text-xs text-slate-500">支持两种格式：1) Continue/Cursor 风格 {"{ mcpServers: {...} }"}；2) 通用风格 {"{ servers: [ ... ] }"}</div>
          <div className="flex border rounded overflow-hidden h-40">
            <pre ref={importNumsRef} className="select-none text-right text-[11px] leading-5 px-2 py-2 w-10 bg-slate-100 dark:bg-slate-900 text-slate-400 overflow-hidden">{importText.split('\n').map((_,i)=>String(i+1)).join('\n')}</pre>
            <textarea ref={importAreaRef} onScroll={(e)=>{ if(importNumsRef.current){ importNumsRef.current.scrollTop = (e.target as HTMLTextAreaElement).scrollTop; } }} className="flex-1 font-mono text-xs p-2 leading-5" value={importText} onChange={(e)=>setImportText(e.target.value)} />
          </div>
          {importError && <div className="text-xs text-red-600">{importError}</div>}
          <div className="flex gap-2">
            <button className="px-3 py-1 rounded bg-blue-600 text-white" onClick={importFromJson}>导入</button>
            <button className="px-3 py-1 rounded bg-gray-600 text-white" onClick={()=>{ setImportOpen(false); setImportText(""); }}>取消</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {servers.length === 0 && <div className="text-xs text-slate-500">尚未添加服务器。</div>}
        {servers.map((s) => {
          const st = statusMap[s.name] || "disconnected";
          return (
            <div key={s.name} className="border rounded-lg p-3 flex items-center justify-between bg-white dark:bg-gray-900">
              <div className="space-y-1">
                <div className="font-medium">{s.name} <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded ${st==='connected'?'bg-green-100 text-green-700':'bg-slate-100 text-slate-600'}`}>{st}</span></div>
                <div className="text-xs text-slate-500">{s.config.type === 'stdio' ? `${s.config.command} ${(s.config.args||[]).join(' ')}` : `${s.config.type} ${s.config.baseUrl}`} · <label className="inline-flex items-center gap-1"><input type="checkbox" checked={s.enabled !== false} onChange={(e)=>{ const next = servers.map(x=> x.name===s.name ? { ...x, enabled: e.target.checked } : x); saveServers(next); }} /><span>启用</span></label></div>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1 rounded bg-blue-600 text-white" disabled={loading} onClick={()=>connect(s)}>连接</button>
                <button className="px-3 py-1 rounded bg-gray-600 text-white" disabled={loading} onClick={()=>disconnect(s.name)}>断开</button>
                <button className="px-3 py-1 rounded bg-indigo-600 text-white" onClick={()=>beginEdit(s)}>编辑</button>
                <button className="px-3 py-1 rounded bg-rose-600 text-white" onClick={()=>remove(s.name)}>删除</button>
              </div>
            </div>
          );
        })}
      </div>
      {exportText && (
        <div className="border rounded-lg p-4 space-y-2 bg-white dark:bg-gray-900">
          <div className="text-sm font-medium">导出 JSON</div>
          <textarea className="w-full h-40 border rounded p-2 font-mono text-xs" value={exportText} readOnly />
          <div className="text-xs text-slate-500">可复制保存为 mcp.json</div>
        </div>
      )}
    </div>
  );
}

