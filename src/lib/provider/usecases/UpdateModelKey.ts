import { KeyManager } from "@/lib/llm/KeyManager";

export class UpdateModelKeyUseCase {
  async execute(providerName: string, modelName: string, apiKey: string | null): Promise<void> {
    if (apiKey && apiKey.trim()) {
      await KeyManager.setModelKey(providerName, modelName, apiKey.trim());
    } else {
      await KeyManager.removeModelKey(providerName, modelName);
    }
  }
}

export const updateModelKeyUseCase = new UpdateModelKeyUseCase();


