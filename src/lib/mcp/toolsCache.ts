import { serverManager } from './ServerManager';
import { LIST_TOOLS_TTL_MS, LIST_TOOLS_TIMEOUT_MS } from './constants';

type ToolsEntry = { tools: any[]; expiresAt: number };

const cache = new Map<string, ToolsEntry>();

async function withTimeout<T>(p: Promise<T>, ms = LIST_TOOLS_TIMEOUT_MS): Promise<T> {
  return await Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]) as T;
}

export async function getToolsCached(server: string): Promise<any[] | null> {
  const now = Date.now();
  const entry = cache.get(server);
  if (entry && entry.expiresAt > now) return entry.tools;
  try {
    const tools = await withTimeout(serverManager.listTools(server) as any, LIST_TOOLS_TIMEOUT_MS);
    if (Array.isArray(tools)) {
      cache.set(server, { tools, expiresAt: now + LIST_TOOLS_TTL_MS });
      return tools;
    }
  } catch {}
  return null;
}

export function invalidateTools(server?: string) {
  if (server) cache.delete(server);
  else cache.clear();
}
