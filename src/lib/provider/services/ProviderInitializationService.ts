import { providerRepository } from "../ProviderRepository";
import { modelRepository } from "../ModelRepository";
import { ProviderEntity, ProviderStatus } from "../types";
import { ProviderRegistry } from "@/lib/llm";
import { KeyManager } from "@/lib/llm/KeyManager";
import { getStaticModels } from "../staticModels";

/**
 * 仅负责初始化 Provider 列表与静态模型写入，不做状态检查。
 */
export class ProviderInitializationService {
  async saveInitialProviders(): Promise<ProviderEntity[]> {
    try {
      const { initializeLLM } = await import("@/lib/llm");
      await initializeLLM();
    } catch (_) {}

    const { PROVIDER_ORDER } = await import("@/lib/llm");
    const registryProviders = ProviderRegistry.allInOrder(PROVIDER_ORDER);

    const existingProviders = await providerRepository.getAll();
    const existingConfigMap = new Map(existingProviders.map((p) => [p.name, p]));

    const list: ProviderEntity[] = await Promise.all(
      registryProviders.map(async (p): Promise<ProviderEntity> => {
        const requiresKey = p.name !== "Ollama";
        const apiKey = requiresKey ? await KeyManager.getProviderKey(p.name) : null;
        const initStatus = requiresKey && !apiKey ? ProviderStatus.NO_KEY : ProviderStatus.UNKNOWN;

        const existingConfig = existingConfigMap.get(p.name);
        let url = existingConfig?.url || (p as any).baseUrl || "";

        if (p.name === "Ollama") {
          try {
            const { OllamaConfigService } = await import("@/lib/config/OllamaConfigService");
            const ollamaUrl = await OllamaConfigService.getOllamaUrl();
            if (!existingConfig?.url) {
              url = ollamaUrl;
            }
          } catch (_) {}
        }

        const entity: ProviderEntity = {
          name: p.name,
          url,
          requiresKey,
          status: existingConfig?.status || initStatus,
          lastChecked: existingConfig?.lastChecked || 0,
          apiKey: existingConfig?.apiKey || apiKey,
          isUserAdded: existingConfig?.isUserAdded ?? false,
          isVisible: existingConfig?.isVisible ?? true,
          strategy: existingConfig?.strategy,
        };

        // 写入静态模型列表（若有）。注意：仅在现有模型不存在时补充，避免覆盖用户自定义模型
        const staticList = getStaticModels(p.name);
        if (staticList?.length) {
          const existing = (await modelRepository.get(p.name)) || [];
          const byName = new Map<string, { provider: string; name: string; label?: string; aliases: string[] }>();
          for (const m of existing) byName.set(m.name, m as any);
          for (const s of staticList) {
            if (!byName.has(s.id)) byName.set(s.id, { provider: p.name, name: s.id, label: s.label, aliases: [s.id] });
          }
          const merged = Array.from(byName.values());
          await modelRepository.save(p.name, merged as any);
        }
        return entity;
      })
    );

    await providerRepository.saveAll(list);
    return list;
  }
}

export const providerInitializationService = new ProviderInitializationService();


