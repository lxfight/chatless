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
        const updated = await providerStatusService.refresh(p.name);
        if ((updated as any)?.status === 'CONNECTED' || (updated as any)?.status === 0) {
          await providerModelService.fetchIfNeeded(p.name);
        }
      }
    };
    for (let i = 0; i < Math.min(concurrency, list.length); i += 1) {
      workers.push(runWorker());
    }
    await Promise.all(workers);
  }
}

export const refreshAllProvidersUseCase = new RefreshAllProvidersUseCase();


