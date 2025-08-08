import { ProviderEntity } from "./types";
import { providerInitializationService } from "./services/ProviderInitializationService";
import { providerStatusService } from "./services/ProviderStatusService";
import { providerRepository } from "./ProviderRepository";

/**
 * Service 层：负责将 ProviderRepository、ModelRepository 与策略层粘合。
 * 先实现最小可用功能：初始化 Provider 列表 + 单 Provider 状态刷新。
 */
export class ProviderService {
  async saveInitialProviders(): Promise<ProviderEntity[]> {
    return providerInitializationService.saveInitialProviders();
  }

  async getProviders(): Promise<ProviderEntity[]> {
    return providerRepository.getAll();
  }

  /**
   * 刷新指定 Provider 的连接状态（简化版：仅调用策略的 checkConnection）
   */
  async refreshProviderStatus(name: string) {
    return providerStatusService.refresh(name);
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