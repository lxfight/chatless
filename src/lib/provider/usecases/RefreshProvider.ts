import { providerStatusService } from "../services/ProviderStatusService";
import { providerModelService } from "../services/ProviderModelService";
import { ProviderEntity } from "../types";
import { modelRepository } from "../ModelRepository";

export class RefreshProviderUseCase {
  async execute(name: string, options?: { withModels?: boolean }): Promise<{ provider?: ProviderEntity; modelsLength?: number }> {
    const updated = await providerStatusService.refresh(name);
    if (!updated) return { provider: undefined };

    if (options?.withModels) {
      // 无论连接状态如何，都写入静态模型，确保界面可见
      await providerModelService.fetchIfNeeded(name);
      const models = await modelRepository.get(name);
      return { provider: updated, modelsLength: models?.length };
    }
    return { provider: updated };
  }
}

export const refreshProviderUseCase = new RefreshProviderUseCase();


