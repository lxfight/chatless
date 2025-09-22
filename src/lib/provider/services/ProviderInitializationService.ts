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
  private async buildEntityFromRegistry(
    p: any,
    existingConfig?: ProviderEntity
  ): Promise<ProviderEntity> {
    // 从catalog中获取正确的requiresKey值
    const { AVAILABLE_PROVIDERS_CATALOG } = await import("../catalog");
    const catalogDef = AVAILABLE_PROVIDERS_CATALOG.find(def => def.name === p.name);
    const requiresKey = catalogDef ? catalogDef.requiresKey : p.name !== "Ollama"; // 兜底逻辑

    const apiKey = requiresKey ? await KeyManager.getProviderKey(p.name) : null;
    const initStatus = requiresKey && !apiKey ? ProviderStatus.NO_KEY : ProviderStatus.UNKNOWN;

    let url = existingConfig?.url || p.baseUrl || "";
    if (p.name === "Ollama") {
      try {
        const { OllamaConfigService } = await import("@/lib/config/OllamaConfigService");
        const ollamaUrl = await OllamaConfigService.getOllamaUrl();
        if (!existingConfig?.url) {
          url = ollamaUrl;
        }
      } catch {
        // ignore
      }
    }

    // 保留用户可编辑字段与偏好设置，避免被初始化覆盖
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
      displayName: existingConfig?.displayName,
      avatarSeed: existingConfig?.avatarSeed,
      preferences: existingConfig?.preferences,
    };
    return entity;
  }

  private async mergeStaticModelsIfNeeded(providerName: string): Promise<void> {
    const staticList = getStaticModels(providerName);
    if (!staticList?.length) return;
    const existing = (await modelRepository.get(providerName)) || [];
    const byName = new Map<string, { provider: string; name: string; label?: string; aliases: string[] }>();
    for (const m of existing) byName.set(m.name, m as any);
    for (const s of staticList) {
      if (!byName.has(s.id)) byName.set(s.id, { provider: providerName, name: s.id, label: s.label, aliases: [s.id] });
    }
    const merged = Array.from(byName.values());
    await modelRepository.save(providerName, merged as any);
  }

  private collectFinalList(
    builtInList: ProviderEntity[],
    existingProviders: ProviderEntity[],
    registryProviders: any[]
  ): ProviderEntity[] {
    const builtInNames = new Set(registryProviders.map((p) => p.name));
    const customProviders = existingProviders.filter((p) => !builtInNames.has(p.name));
    return [...builtInList, ...customProviders];
  }

  async saveInitialProviders(): Promise<ProviderEntity[]> {
    try {
      const { initializeLLM } = await import("@/lib/llm");
      await initializeLLM();
    } catch {
      // ignore
    }

    const { PROVIDER_ORDER } = await import("@/lib/llm");
    const registryProviders = ProviderRegistry.allInOrder(PROVIDER_ORDER);

    const existingProviders = await providerRepository.getAll();
    const existingConfigMap = new Map(existingProviders.map((p) => [p.name, p]));

    // 1) 生成内置（注册表）Provider 列表，并保留用户字段
    const builtInList: ProviderEntity[] = await Promise.all(
      registryProviders.map(async (p): Promise<ProviderEntity> => {
        const existingConfig = existingConfigMap.get(p.name);
        const entity = await this.buildEntityFromRegistry(p, existingConfig);
        await this.mergeStaticModelsIfNeeded(p.name);
        return entity;
      })
    );

    // 2) 合并自定义 Provider（不在注册表中的，原样保留） & 3) 汇总列表
    const finalList = this.collectFinalList(builtInList, existingProviders, registryProviders);

    await providerRepository.saveAll(finalList);
    return finalList;
  }
}

export const providerInitializationService = new ProviderInitializationService();


