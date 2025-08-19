import { providerRepository } from "../ProviderRepository";
import { KeyManager } from "@/lib/llm/KeyManager";
import { refreshProviderUseCase } from "./RefreshProvider";
import { syncDynamicProviders } from "@/lib/llm";
import { specializedStorage } from "@/lib/storage";

export class UpdateProviderConfigUseCase {
  async execute(name: string, input: { url?: string; apiKey?: string | null }) {
    const list = await providerRepository.getAll();
    const target = list.find((p) => p.name === name);
    if (!target) return;

    // 1) 同步到 KeyManager（真实密钥存储）
    if (typeof input.apiKey !== "undefined") {
      const cleaned = input.apiKey && input.apiKey.trim() ? input.apiKey.trim() : null;
      if (cleaned) await KeyManager.setProviderKey(name, cleaned);
      else await KeyManager.removeProviderKey(name);
    }

    // 2) 同步到 ProviderRepository（用于 UI 显示 default_api_key）
    await providerRepository.update({
      name,
      url: input.url ?? target.url,
      // 只有当调用方显式传入 apiKey 字段时才更新仓库里的 apiKey，避免误覆盖
      ...(typeof input.apiKey !== "undefined" ? { apiKey: (input.apiKey && input.apiKey.trim()) ? input.apiKey.trim() : null } : {}),
    });

    // 对于 multi 策略（例如 New API），若无设置默认策略，初始化为 openai-compatible
    try {
      const def = await specializedStorage.models.getProviderDefaultStrategy(name);
      if (!def) {
        await specializedStorage.models.setProviderDefaultStrategy(name, 'openai-compatible');
      }
    } catch (_) {}

    // 仅当 URL 变更时触发刷新（含模型）；
    // 纯密钥更新不立刻刷新，减少请求与界面抖动，由用户手动“检查连接”或后续操作触发刷新
    if (typeof input.url !== 'undefined') {
      await refreshProviderUseCase.execute(name, { withModels: true });
    }

    // 同步动态 providers 到运行时注册表
    await syncDynamicProviders();
  }
}

export const updateProviderConfigUseCase = new UpdateProviderConfigUseCase();


