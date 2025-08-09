import { providerStatusService } from "../services/ProviderStatusService";
import { providerModelService } from "../services/ProviderModelService";
import { providerRepository } from "../ProviderRepository";

export class RefreshAllProvidersUseCase {
  async execute(): Promise<void> {
    const list = await providerRepository.getAll();
    const concurrency = 3;
    const queue = [...list];
    const workers: Array<Promise<void>> = [];
    const runWorker = async () => {
      while (queue.length) {
        const p = queue.shift()!;
        await providerStatusService.refresh(p.name);
        // 无论连接状态如何，都写入静态模型，确保界面可见
        await providerModelService.fetchIfNeeded(p.name);
      }
    };
    for (let i = 0; i < Math.min(concurrency, list.length); i += 1) {
      workers.push(runWorker());
    }
    await Promise.all(workers);
  }
}

export const refreshAllProvidersUseCase = new RefreshAllProvidersUseCase();


