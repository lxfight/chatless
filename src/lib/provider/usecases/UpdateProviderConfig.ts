import { providerRepository } from "../ProviderRepository";
import { KeyManager } from "@/lib/llm/KeyManager";
import { refreshProviderUseCase } from "./RefreshProvider";

export class UpdateProviderConfigUseCase {
  async execute(name: string, input: { url?: string; apiKey?: string | null }) {
    const list = await providerRepository.getAll();
    const target = list.find((p) => p.name === name);
    if (!target) return;

    if (typeof input.apiKey !== "undefined") {
      if (input.apiKey) await KeyManager.setProviderKey(name, input.apiKey);
      else await KeyManager.removeProviderKey(name);
    }

    await providerRepository.update({ name, url: input.url ?? target.url });

    // 保存配置后触发一次刷新（含模型）
    await refreshProviderUseCase.execute(name, { withModels: true });
  }
}

export const updateProviderConfigUseCase = new UpdateProviderConfigUseCase();


