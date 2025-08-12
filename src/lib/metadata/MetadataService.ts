import { providerRepository } from "@/lib/provider/ProviderRepository";
import { modelRepository } from "@/lib/provider/ModelRepository";
import type { ProviderMetadata, ModelMetadata } from "./types";
import { getAvatarSync } from '@/lib/utils/logoService';

class MetadataService {
  private cache: ProviderMetadata[] = [];
  private listeners = new Set<(d: ProviderMetadata[]) => void>();

  constructor() {
    this.rebuild();
    providerRepository.subscribe(()=>this.rebuild());
    modelRepository.subscribeAll(()=>this.rebuild());
  }

  private async rebuild() {
    const providers = await providerRepository.getAll();
    const merged: ProviderMetadata[] = await Promise.all(
      providers.map(async (p) => {
        const displayName = (p as any).displayName || p.name;
        const slug = String(displayName).toLowerCase().replace(/\s+/g, '-');
        // 默认优先 png，减少首次 404；用户自定义走缓存头像
        const icon = p.avatarSeed
          ? getAvatarSync(p.avatarSeed, displayName, 20)
          : `/llm-provider-icon/${slug}.png`;

        const rawModels = (await modelRepository.get(p.name)) ?? [];
        const models: ModelMetadata[] = rawModels.map((m: any) => ({
          name: m.name,
          aliases: m.aliases || [],
          label: m.label || m.name,
          api_key: m.apiKey ?? null,
        }));

        return {
          name: displayName,
          api_base_url: p.url,
          requiresApiKey: p.requiresKey,
          aliases: [p.name],
          icon,
          default_api_key: p.apiKey ?? null,
          models,
        } as ProviderMetadata;
      })
    );
    this.cache = merged;
    this.listeners.forEach(l=>l(merged));
  }

  get(): ProviderMetadata[] { return this.cache; }
  subscribe(cb:(d:ProviderMetadata[])=>void){ this.listeners.add(cb); return ()=>this.listeners.delete(cb);}  
}

export const metadataService = new MetadataService(); 