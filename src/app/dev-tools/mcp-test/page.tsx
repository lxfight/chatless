"use client";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { serverManager } from '@/lib/mcp/ServerManager';

export default function McpTestPage() {
  const [name, setName] = useState('git');
  const [command, setCommand] = useState('uvx');
  const [args, setArgs] = useState('mcp-server-git');
  const [status, setStatus] = useState('disconnected');
  const [tools, setTools] = useState<any[]>([]);
  const [log, setLog] = useState<string>('');
  const [resources, setResources] = useState<any>(null);
  const [resourceUri, setResourceUri] = useState<string>('');
  const [resourceContent, setResourceContent] = useState<any>(null);
  const [prompts, setPrompts] = useState<any>(null);
  const [promptName, setPromptName] = useState<string>('');
  const [promptArgs, setPromptArgs] = useState<string>('{}');
  const [selectedTool, setSelectedTool] = useState<string>('');
  const [toolArgs, setToolArgs] = useState<string>('{}');
  const [confirmTool, setConfirmTool] = useState<boolean>(true);

  useEffect(() => {
    const off = serverManager.on((e) => {
      if (e.type === 'SERVER_STATUS' && e.payload?.name === name) {
        setStatus(e.payload.status);
      }
      if (e.type === 'ERROR') {
        setLog((l) => l + `\nERROR: ${String(e.payload?.error ?? 'unknown')}`);
      }
    });
    return () => { off(); };
  }, [name]);

  const cfg = useMemo(() => ({
    type: 'stdio' as const,
    command,
    args: args.trim().length ? args.split(' ').filter(Boolean) : [],
  }), [command, args]);

  const useEverythingPreset = useCallback(() => {
    setName('everything');
    setCommand('uvx');
    setArgs('@modelcontextprotocol/server-everything');
    setLog((l)=> l + `\nApplied preset: everything test server`);
  }, []);

  const connect = useCallback(async () => {
    try {
      await serverManager.startServer(name, cfg);
      setLog((l) => l + `\nConnected ${name}`);
    } catch (e) {
      setLog((l) => l + `\nConnect failed: ${String(e)}`);
    }
  }, [name, cfg]);

  const disconnect = useCallback(async () => {
    try {
      await serverManager.stopServer(name);
      setLog((l) => l + `\nDisconnected ${name}`);
    } catch (e) {
      setLog((l) => l + `\nDisconnect failed: ${String(e)}`);
    }
  }, [name]);

  const loadTools = useCallback(async () => {
    try {
      const list = await serverManager.listTools(name);
      setTools(list);
      if (list && list.length) setSelectedTool(list[0].name);
      setLog((l) => l + `\nLoaded tools: ${list.length}`);
    } catch (e) {
      setLog((l) => l + `\nList tools failed: ${String(e)}`);
    }
  }, [name]);

  const callSelectedTool = useCallback(async () => {
    try {
      if (!tools.length || !selectedTool) return;
      if (confirmTool && !window.confirm(`Call tool: ${selectedTool}?`)) return;
      let parsed: Record<string, unknown> | undefined;
      try { parsed = JSON.parse(toolArgs || '{}'); } catch { parsed = {}; }
      const res = await serverManager.callTool(name, selectedTool, parsed);
      setLog((l) => l + `\nCall ${selectedTool} => ${JSON.stringify(res)}`);
    } catch (e) {
      setLog((l) => l + `\nCall tool failed: ${String(e)}`);
    }
  }, [name, tools, selectedTool, toolArgs, confirmTool]);

  const listResources = useCallback(async () => {
    try {
      const res = await serverManager.listResources(name);
      setResources(res);
      setLog((l) => l + `\nListed resources`);
    } catch (e) {
      const msg = String(e);
      if (msg.includes('Method not found') || msg.includes('-32601')) {
        setLog((l) => l + `\nList resources failed: 当前服务器未实现 Resources（-32601）。可使用 everything 测试服务器预设重试。`);
      } else {
        setLog((l) => l + `\nList resources failed: ${msg}`);
      }
    }
  }, [name]);

  const readResource = useCallback(async () => {
    try {
      if (!resourceUri.trim()) return;
      const res = await serverManager.readResource(name, resourceUri.trim());
      setResourceContent(res);
      setLog((l) => l + `\nRead resource`);
    } catch (e) {
      setLog((l) => l + `\nRead resource failed: ${String(e)}`);
    }
  }, [name, resourceUri]);

  const listPrompts = useCallback(async () => {
    try {
      const res = await serverManager.listPrompts(name);
      setPrompts(res);
      setLog((l) => l + `\nListed prompts`);
    } catch (e) {
      const msg = String(e);
      if (msg.includes('Method not found') || msg.includes('-32601')) {
        setLog((l) => l + `\nList prompts failed: 当前服务器未实现 Prompts（-32601）。可使用 everything 测试服务器预设重试。`);
      } else {
        setLog((l) => l + `\nList prompts failed: ${msg}`);
      }
    }
  }, [name]);

  const getPrompt = useCallback(async () => {
    try {
      if (!promptName.trim()) return;
      let parsed: Record<string, unknown> | undefined;
      try { parsed = JSON.parse(promptArgs || '{}'); } catch { parsed = {}; }
      const res = await serverManager.getPrompt(name, promptName.trim(), parsed);
      setLog((l) => l + `\nGot prompt: ${JSON.stringify(res).slice(0, 500)}...`);
    } catch (e) {
      setLog((l) => l + `\nGet prompt failed: ${String(e)}`);
    }
  }, [name, promptName, promptArgs]);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">MCP Test</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <label className="flex items-center gap-2">
          <span className="w-24">Name</span>
          <input className="border px-2 py-1 rounded w-full" value={name} onChange={(e)=>setName(e.target.value)} />
        </label>
        <label className="flex items-center gap-2">
          <span className="w-24">Command</span>
          <input className="border px-2 py-1 rounded w-full" value={command} onChange={(e)=>setCommand(e.target.value)} />
        </label>
        <label className="flex items-center gap-2">
          <span className="w-24">Args</span>
          <input className="border px-2 py-1 rounded w-full" value={args} onChange={(e)=>setArgs(e.target.value)} />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="px-3 py-1 rounded bg-blue-600 text-white" onClick={connect}>Connect</button>
        <button className="px-3 py-1 rounded bg-gray-600 text-white" onClick={disconnect}>Disconnect</button>
        <button className="px-3 py-1 rounded bg-emerald-600 text-white" onClick={loadTools}>List Tools</button>
        <div className="flex items-center gap-2">
          <select className="border px-2 py-1 rounded" value={selectedTool} onChange={e=>setSelectedTool(e.target.value)}>
            {tools.map(t => (
              <option key={t.name} value={t.name}>{t.name}</option>
            ))}
          </select>
          <input className="border px-2 py-1 rounded w-64" placeholder='tool args JSON' value={toolArgs} onChange={e=>setToolArgs(e.target.value)} />
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" checked={confirmTool} onChange={e=>setConfirmTool(e.target.checked)} /> Confirm
          </label>
          <button className="px-3 py-1 rounded bg-orange-600 text-white" onClick={callSelectedTool} disabled={!tools.length}>Call Tool</button>
        </div>
        <span className="px-2 py-1 border rounded">Status: {status}</span>
        <button className="px-3 py-1 rounded bg-fuchsia-600 text-white" onClick={useEverythingPreset}>Use Everything Preset</button>
      </div>

      <div>
        <h2 className="font-medium">Tools</h2>
        <pre className="p-2 bg-gray-100 rounded overflow-auto text-xs max-h-64">{JSON.stringify(tools, null, 2)}</pre>
      </div>

      <div className="space-y-2">
        <h2 className="font-medium">Resources</h2>
        <p className="text-xs text-gray-500">
          说明：并非所有 MCP Server 都实现 Resources（如 mcp-server-git 通常没有）。
          如果这里一直为空，尝试将 Command 改为 <code>uvx</code> 或 <code>npx</code>，Args 改为 <code>@modelcontextprotocol/server-everything</code>，
          连接后点击 List Resources。资源 URI 示例：<code>test://static/resource/1</code>
        </p>
        <div className="flex gap-2">
          <button className="px-3 py-1 rounded bg-indigo-600 text-white" onClick={listResources}>List Resources</button>
          <input className="border px-2 py-1 rounded w-full" placeholder="resource uri（如 test://static/resource/1）" value={resourceUri} onChange={e=>setResourceUri(e.target.value)} />
          <button className="px-3 py-1 rounded bg-indigo-700 text-white" onClick={readResource}>Read Resource</button>
        </div>
        {!resources && (
          <div className="text-xs text-gray-500">暂无结果：服务器可能未实现 Resources，或尚未点击 List Resources。</div>
        )}
        <pre className="p-2 bg-gray-100 rounded overflow-auto text-xs max-h-64">{JSON.stringify(resources, null, 2)}</pre>
        <pre className="p-2 bg-gray-100 rounded overflow-auto text-xs max-h-64">{JSON.stringify(resourceContent, null, 2)}</pre>
      </div>

      <div className="space-y-2">
        <h2 className="font-medium">Prompts</h2>
        <p className="text-xs text-gray-500">
          说明：若使用 <code>@modelcontextprotocol/server-everything</code>，List Prompts 会返回多个可用的提示，
          例如 <code>simple_prompt</code> / <code>complex_prompt</code> / <code>resource_prompt</code>。
          在下方输入 Prompt 名称并提供参数 JSON（如 <code>{'{'}"temperature":0.7{'}'}</code> 或 <code>{'{'}"resourceId":1{'}'}</code>），点击 Get Prompt 查看结果。
          其他服务器可能不支持该能力。
        </p>
        <div className="flex gap-2">
          <button className="px-3 py-1 rounded bg-purple-600 text-white" onClick={listPrompts}>List Prompts</button>
        </div>
        <div className="flex gap-2">
          <input className="border px-2 py-1 rounded w-1/3" placeholder="prompt name（如 simple_prompt）" value={promptName} onChange={e=>setPromptName(e.target.value)} />
          <input className="border px-2 py-1 rounded w-2/3" placeholder='args JSON（如 {"temperature":0.7} 或 {"resourceId":1}）' value={promptArgs} onChange={e=>setPromptArgs(e.target.value)} />
          <button className="px-3 py-1 rounded bg-purple-700 text-white" onClick={getPrompt}>Get Prompt</button>
        </div>
        {!prompts && (
          <div className="text-xs text-gray-500">暂无结果：服务器可能未实现 Prompts，或尚未点击 List Prompts。</div>
        )}
        <pre className="p-2 bg-gray-100 rounded overflow-auto text-xs max-h-64">{JSON.stringify(prompts, null, 2)}</pre>
      </div>

      <div>
        <h2 className="font-medium">Log</h2>
        <pre className="p-2 bg-gray-100 rounded overflow-auto text-xs max-h-64 whitespace-pre-wrap">{log}</pre>
      </div>
    </div>
  );
}

