import { providerRepository } from "../ProviderRepository";
import { KeyManager } from "@/lib/llm/KeyManager";
import { refreshProviderUseCase } from "./RefreshProvider";

export class UpdateProviderConfigUseCase {
  async execute(name: string, input: { url?: string; apiKey?: string | null }) {
    const list = await providerRepository.getAll();
    const target = list.find((p) => p.name === name);
    if (!target) return;

    // 1) 同步到 KeyManager（真实密钥存储）
    if (typeof input.apiKey !== "undefined") {
      if (input.apiKey) await KeyManager.setProviderKey(name, input.apiKey);
      else await KeyManager.removeProviderKey(name);
    }

    // 2) 同步到 ProviderRepository（用于 UI 显示 default_api_key）
    await providerRepository.update({
      name,
      url: input.url ?? target.url,
      // 只有当调用方显式传入 apiKey 字段时才更新仓库里的 apiKey，避免误覆盖
      ...(typeof input.apiKey !== "undefined" ? { apiKey: input.apiKey ?? null } : {}),
    });

    // 保存配置后触发一次刷新（含模型）
    await refreshProviderUseCase.execute(name, { withModels: true });
  }
}

export const updateProviderConfigUseCase = new UpdateProviderConfigUseCase();


