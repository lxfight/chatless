import { providerRepository } from "../ProviderRepository";
import { modelRepository } from "../ModelRepository";
import { ProviderEntity, ProviderStatus } from "../types";
import { ProviderRegistry } from "@/lib/llm";
import { KeyManager } from "@/lib/llm/KeyManager";
import { STATIC_PROVIDER_MODELS } from "../staticModels";

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
        };

        // 写入静态模型列表（若有）
        const staticList = STATIC_PROVIDER_MODELS[p.name];
        if (staticList?.length) {
          await modelRepository.save(
            p.name,
            staticList.map((m) => ({ provider: p.name, name: m.id, label: m.label, aliases: [m.id] }))
          );
        }
        return entity;
      })
    );

    await providerRepository.saveAll(list);
    return list;
  }
}

export const providerInitializationService = new ProviderInitializationService();


