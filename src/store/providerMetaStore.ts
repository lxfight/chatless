/**
 * providerMetaStore
 * --------------------------------------------------
 * 「UI 元数据层」
 * • 仅保存供前端展示的轻量信息 (QuickProviderMeta)
 * • 永远由 useProviderManagement 调用 setList() 进行同步
 * • UI 组件可以自由读 list，但 **严禁**直接调用 setList
 *   需要写入时，请走 useProviderManagement / ProviderService
 * • list 使用 ReadonlyArray 提升类型安全，避免误改
 * --------------------------------------------------
 */

import { create } from 'zustand';
import { ProviderRegistry } from '@/lib/llm';

export interface QuickProviderMeta {
  name: string;
  aliases: string[];
  icon: string;
  api_base_url: string;
  requiresApiKey: boolean;
  models: any[]; // placeholder
  displayStatus: 'UNKNOWN' | 'CONNECTING' | 'NO_KEY' | 'NOT_CONNECTED' | 'CONNECTED';
  statusTooltip: string;
}

interface ProviderMetaState {
  list: ReadonlyArray<QuickProviderMeta>;
  setList: (l: QuickProviderMeta[]) => void;
}

function buildQuickList(): QuickProviderMeta[] {
  return ProviderRegistry.all().map((p) => {
    const slug = p.name.toLowerCase().replace(/\s+/g, '-');
    const requiresKey = p.name !== 'Ollama';
    return {
      name: p.name,
      aliases: [p.name],
      icon: `/llm-provider-icon/${slug}.svg`,
      api_base_url: (p as any).baseUrl ?? '',
      requiresApiKey: requiresKey,
      models: [],
      displayStatus: p.name === 'Ollama' ? 'CONNECTING' : requiresKey ? 'UNKNOWN' : 'CONNECTING',
      statusTooltip: '初始化…',
    };
  });
}

export const useProviderMetaStore = create<ProviderMetaState>((set) => ({
  list: buildQuickList(),
  setList: (l) => set({ list: l } as any),
})); 