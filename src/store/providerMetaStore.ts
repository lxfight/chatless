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

// 简化的 Provider 元数据，用于 UI 展示
export interface QuickProviderMeta {
  name: string;
  aliases: string[];
  icon?: string;
  api_base_url: string;
  requiresApiKey: boolean;
  models: any[];
  displayStatus?: 'CONNECTED' | 'CONNECTING' | 'NOT_CONNECTED' | 'NO_KEY' | 'UNKNOWN' | 'NO_FETCHER';
  statusTooltip?: string | null;
}

interface ProviderMetaState {
  list: QuickProviderMeta[];
  setList: (list: QuickProviderMeta[]) => void;
}

function buildQuickList(): QuickProviderMeta[] {
  // 直接从ProviderRegistry获取所有providers，按PROVIDER_ORDER排序
  const { PROVIDER_ORDER } = require('@/lib/llm');
  const providers = ProviderRegistry.allInOrder(PROVIDER_ORDER);
  console.log(`[providerMetaStore] 从ProviderRegistry获取到 ${providers.length} 个providers:`, providers.map(p => p.name));
  
  return providers.map((p) => {
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
      statusTooltip: '初始化中…',
    };
  });
}

export const useProviderMetaStore = create<ProviderMetaState>((set) => ({
  list: buildQuickList(),
  setList: (list) => set({ list }),
})); 