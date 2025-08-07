import { providerRepository } from "@/lib/provider/ProviderRepository";
import { modelRepository } from "@/lib/provider/ModelRepository";
import type { ProviderMetadata, ModelMetadata } from "./types";

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
      providers.map(async p => ({
        name: p.name,
        api_base_url: p.url,
        requiresApiKey: p.requiresKey,
        models: (await modelRepository.get(p.name)) ?? []
      }))
    );
    this.cache = merged;
    this.listeners.forEach(l=>l(merged));
  }

  get(): ProviderMetadata[] { return this.cache; }
  subscribe(cb:(d:ProviderMetadata[])=>void){ this.listeners.add(cb); return ()=>this.listeners.delete(cb);}  
}

export const metadataService = new MetadataService(); 