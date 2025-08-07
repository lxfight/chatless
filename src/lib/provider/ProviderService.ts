import { providerRepository } from "./ProviderRepository";
import { modelRepository } from "./ModelRepository";
import { ProviderEntity, ProviderStatus } from "./types";
import { ProviderRegistry } from "@/lib/llm";
import { KeyManager } from "@/lib/llm/KeyManager";
import { STATIC_PROVIDER_MODELS } from "./staticModels";

/**
 * Service 层：负责将 ProviderRepository、ModelRepository 与策略层粘合。
 * 先实现最小可用功能：初始化 Provider 列表 + 单 Provider 状态刷新。
 */
export class ProviderService {
  /**
   * 第一次启动或手动触发时，构造 Provider 列表并写入仓库
   */
  async saveInitialProviders(): Promise<ProviderEntity[]> {
    console.log('[ProviderService] 开始执行 saveInitialProviders...');
    
    // 确保所有providers都已经注册到ProviderRegistry
    try {
      const { initializeLLM } = await import('@/lib/llm');
      await initializeLLM();
      console.log('[ProviderService] LLM系统初始化完成，确保所有providers已注册');
    } catch (error) {
      console.warn('[ProviderService] LLM系统初始化失败，但继续执行:', error);
    }
    
    // 使用PROVIDER_ORDER确保顺序正确
    const { PROVIDER_ORDER } = await import('@/lib/llm');
    const registryProviders = ProviderRegistry.allInOrder(PROVIDER_ORDER);
    console.log(`[ProviderService] 从注册表获取到 ${registryProviders.length} 个提供商:`, registryProviders.map(p => p.name));
    
    // 验证所有必需的providers都存在
    const requiredProviders = PROVIDER_ORDER;
    const missingProviders = requiredProviders.filter(name => !registryProviders.some(p => p.name === name));
    if (missingProviders.length > 0) {
      console.warn(`[ProviderService] 缺少以下providers: ${missingProviders.join(', ')}`);
    }
    
    // 获取现有的用户配置，避免覆盖用户已保存的设置
    const existingProviders = await providerRepository.getAll();
    console.log(`[ProviderService] 从数据库获取到 ${existingProviders.length} 个现有配置`);
    
    // 如果已有配置，记录详细信息
    if (existingProviders.length > 0) {
      console.log('[ProviderService] 现有配置详情:', existingProviders.map(p => ({
        name: p.name,
        url: p.url,
        status: p.status,
        lastChecked: p.lastChecked
      })));
    }
    
    const existingConfigMap = new Map(
      existingProviders.map(p => [p.name, p])
    );

    const list: ProviderEntity[] = await Promise.all(
      registryProviders.map(async (p): Promise<ProviderEntity> => {
        const slug = p.name.toLowerCase().replace(/\s+/g, "-");
        const requiresKey = p.name !== "Ollama";
        const apiKey = requiresKey ? await KeyManager.getProviderKey(p.name) : null;
        const initStatus = requiresKey && !apiKey ? ProviderStatus.NO_KEY : ProviderStatus.UNKNOWN;
        
        // 优先使用用户已保存的配置，如果没有则使用默认值
        const existingConfig = existingConfigMap.get(p.name);
        
        // 对于Ollama，优先使用OllamaConfigService中的配置
        let url = existingConfig?.url || (p as any).baseUrl || "";
        
        if (p.name === "Ollama") {
          try {
            const { OllamaConfigService } = await import('@/lib/config/OllamaConfigService');
            const ollamaUrl = await OllamaConfigService.getOllamaUrl();
            // 只有在没有现有配置时才使用OllamaConfigService的配置
            if (!existingConfig?.url) {
              url = ollamaUrl;
              console.log(`[ProviderService] 使用OllamaConfigService配置: ${url}`);
            } else {
              console.log(`[ProviderService] 保持现有Ollama配置: ${existingConfig.url}`);
            }
          } catch (error) {
            console.warn('[ProviderService] 获取OllamaConfigService配置失败:', error);
          }
        }
        
        // 记录配置选择过程
        if (existingConfig) {
          console.log(`[ProviderService] 使用现有配置: ${p.name} -> ${existingConfig.url}`);
        } else {
          console.log(`[ProviderService] 使用默认配置: ${p.name} -> ${url}`);
        }
        
        const entity: ProviderEntity = {
          name: p.name,
          url: url,
          requiresKey,
          status: existingConfig?.status || initStatus,
          lastChecked: existingConfig?.lastChecked || 0,
          apiKey: existingConfig?.apiKey || apiKey,
        };

        // 写入静态模型列表（若有）
        const staticList = STATIC_PROVIDER_MODELS[p.name];
        if (staticList?.length) {
          // 强制重新保存静态模型，确保label字段正确
          await modelRepository.save(
            p.name,
            staticList.map((m)=>({ 
              provider:p.name, 
              name:m.id, 
              label:m.label, 
              aliases:[m.id] 
            }))
          );
        }

        return entity;
      })
    );

    console.log(`[ProviderService] 准备保存 ${list.length} 个提供商配置:`, list.map(p => p.name));
    await providerRepository.saveAll(list);
    console.log('[ProviderService] saveInitialProviders 执行完成');
    return list;
  }

  async getProviders(): Promise<ProviderEntity[]> {
    return providerRepository.getAll();
  }

  /**
   * 刷新指定 Provider 的连接状态（简化版：仅调用策略的 checkConnection）
   */
  async refreshProviderStatus(name: string): Promise<ProviderEntity | undefined> {
    const providers = await providerRepository.getAll();
    const target = providers.find((p) => p.name === name);
    if (!target) return undefined;

    // 最新密钥
    const latestKey = target.requiresKey ? await KeyManager.getProviderKey(name) : null;

    // 若需要 key 但未配置 -> 直接 NO_KEY
    if (target.requiresKey && !(latestKey && latestKey.trim())) {
      await providerRepository.update({ name, status: ProviderStatus.NO_KEY, lastChecked: Date.now(), apiKey: null });
      return { ...target, status: ProviderStatus.NO_KEY, apiKey: null } as ProviderEntity;
    }

    // 不立即标记 CONNECTING，保持旧状态，待结果到来后再更新

    let finalStatus = ProviderStatus.NOT_CONNECTED;
    try {
      const strategy = ProviderRegistry.get(name);
      if (strategy) {
        // 同步最新 URL 到策略实例
        const effectiveUrl = target.url?.trim() || (name === 'Ollama' ? 'http://localhost:11434' : '');
        if ((strategy as any).baseUrl !== effectiveUrl) {
          (strategy as any).baseUrl = effectiveUrl;
          console.log(`[ProviderService] 已更新 ${name} 的 baseUrl: ${(strategy as any).baseUrl}`);
        }
        
        // 如果是Ollama，同时更新llm/index中的OllamaProvider
        if (name === 'Ollama') {
          try {
            const { updateOllamaProviderUrl } = await import('@/lib/llm');
            await updateOllamaProviderUrl(effectiveUrl);
            console.log(`[ProviderService] 已同步更新 llm/index 中的 OllamaProvider URL: ${effectiveUrl}`);
          } catch (error) {
            console.warn('[ProviderService] 更新 llm/index 中的 OllamaProvider URL 失败:', error);
          }
        }
        
        // 添加超时机制，防止状态检查卡住
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('连接检查超时')), 10000); // 10秒超时
        });
        
        const checkConnectionPromise = strategy.checkConnection();
        
        const result = await Promise.race([checkConnectionPromise, timeoutPromise]);
        finalStatus = result.success ? ProviderStatus.CONNECTED : ProviderStatus.NOT_CONNECTED;

        // 无论连接成功与否，都尝试刷新模型列表
        if (strategy.fetchModels) {
          try {
            // 为模型获取也添加超时机制
            const fetchModelsPromise = strategy.fetchModels();
            const modelData = await Promise.race([fetchModelsPromise, timeoutPromise]);
            
            if (modelData && modelData.length) {
              const models = modelData.map((model) => ({
                provider: name,
                name: model.name,
                label: model.label,
                aliases: model.aliases || [model.name],
              }));
              await modelRepository.save(name, models);
              console.log(`[ProviderService] 已刷新 ${name} 的模型列表，共 ${models.length} 个模型`);
            }
          } catch (e) {
            console.warn(`[ProviderService] fetchModels for ${name} error`, e);
            // 模型获取失败不影响连接状态
          }
        }
      } else {
        finalStatus = ProviderStatus.UNKNOWN;
      }
    } catch (error) {
      console.error(`[ProviderService] 刷新 ${name} 状态失败:`, error);
      // 根据错误类型设置不同的状态
      if (error instanceof Error) {
        if (error.message.includes('超时')) {
          finalStatus = ProviderStatus.NOT_CONNECTED;
        } else if (error.message.includes('fetch') || error.message.includes('network')) {
          finalStatus = ProviderStatus.NOT_CONNECTED;
        } else {
          finalStatus = ProviderStatus.NOT_CONNECTED;
        }
      } else {
        finalStatus = ProviderStatus.NOT_CONNECTED;
      }
    }

    const updated: ProviderEntity = {
      ...target,
      status: finalStatus,
      lastChecked: Date.now(),
    };
    await providerRepository.update(updated);
    return updated;
  }

  /**
   * 刷新所有 Provider 状态（并行）
   */
  async refreshAll() {
    const providers = await providerRepository.getAll();
    await Promise.all(providers.map((p) => this.refreshProviderStatus(p.name)));
  }
}

export const providerService = new ProviderService(); 