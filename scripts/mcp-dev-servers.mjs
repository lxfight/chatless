#!/usr/bin/env node
/**
 * Launch three local MCP servers for debugging:
 * - everything (stdio)  → launched on demand via stdio, no port
 * - everything (sse)    → http://127.0.0.1:8789/sse
 * - everything (http)   → http://127.0.0.1:8790/mcp
 *
 * Usage:
 *   node scripts/mcp-dev-servers.mjs
 *
 * Stop:
 *   Ctrl+C 一次将优雅退出并杀掉所有子进程。
 */
import { spawn } from 'node:child_process';

function launch(cmd, args, opts = {}) {
  const child = spawn(cmd, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...opts,
  });
  child.on('exit', (code, signal) => {
    console.log(`[mcp-dev] process ${cmd} ${args.join(' ')} exited:`, { code, signal });
  });
  return child;
}

const children = [];

// 1) everything - SSE at 8789
children.push(
  launch('npx', ['-y', '@modelcontextprotocol/server-everything', 'sse'], {
    env: { ...process.env, PORT: '8789' },
  })
);

// 2) everything - Streamable HTTP at 8790
children.push(
  launch('npx', ['-y', '@modelcontextprotocol/server-everything', 'streamableHttp'], {
    env: { ...process.env, PORT: '8790' },
  })
);

console.log('\n[mcp-dev] Servers started:');
console.log('  SSE:  http://127.0.0.1:8789/sse');
console.log('  HTTP: http://127.0.0.1:8790/mcp');
console.log('按 Ctrl+C 停止所有测试服务\n');

function shutdown() {
  console.log('\n[mcp-dev] Shutting down...');
  for (const c of children) {
    try { c.kill('SIGINT'); } catch {}
  }
  setTimeout(() => process.exit(0), 200);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);


