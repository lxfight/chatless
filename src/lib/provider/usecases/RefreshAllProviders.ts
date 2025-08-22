import { providerStatusService } from "../services/ProviderStatusService";
import { providerModelService } from "../services/ProviderModelService";
import { providerRepository } from "../ProviderRepository";

export class RefreshAllProvidersUseCase {
  async execute(): Promise<void> {
    // 按你的需求：默认不做自动批量刷新；保留方法供将来可能的手动入口调用
    const list = await providerRepository.getAll();
    for (const p of list) {
      await providerStatusService.refresh(p.name);
      // 仅在已连接时才尝试拉取模型
      // 实际是否拉取由上层手动控制；此处不做 fetch，避免额外请求
    }
  }
}

export const refreshAllProvidersUseCase = new RefreshAllProvidersUseCase();


