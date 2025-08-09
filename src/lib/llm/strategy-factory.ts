import { BaseProvider } from './providers/BaseProvider';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { AnthropicProvider } from './providers/AnthropicProvider';
import { GoogleAIProvider } from './providers/GoogleAIProvider';
import { DeepSeekProvider } from './providers/DeepSeekProvider';
import { OllamaProvider } from './providers/OllamaProvider';
import type { CatalogProviderDef } from '@/lib/provider/catalog';

/**
 * 简易工厂：根据目录定义创建 Provider 实例。
 * openai-compatible 默认复用 OpenAIProvider 行为（/v1/models、/v1/chat/completions）。
 */
export function createProviderInstance(def: CatalogProviderDef, url: string, apiKey?: string | null): BaseProvider {
  const baseUrl = (url || '').trim();
  switch (def.strategy) {
    case 'openai':
    case 'openai-compatible':
      return new OpenAIProvider(
        baseUrl || def.defaultUrl || 'https://api.openai.com/v1',
        apiKey || undefined,
        def.name
      );
    case 'anthropic':
      return new AnthropicProvider(baseUrl || def.defaultUrl || 'https://api.anthropic.com/v1', apiKey || undefined);
    case 'gemini':
      return new GoogleAIProvider(baseUrl || def.defaultUrl || 'https://generativelanguage.googleapis.com/v1beta', apiKey || undefined);
    case 'deepseek':
      return new DeepSeekProvider(baseUrl || def.defaultUrl || 'https://api.deepseek.com', apiKey || undefined);
    case 'ollama':
      return new OllamaProvider(baseUrl || 'http://localhost:11434');
    default:
      return new OpenAIProvider(baseUrl || def.defaultUrl || 'https://api.openai.com/v1', apiKey || undefined);
  }
}


