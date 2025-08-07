import { ProviderRegistry } from './ProviderRegistry';
import { OllamaProvider } from './providers/OllamaProvider';
import { DeepSeekProvider } from './providers/DeepSeekProvider';
import { GoogleAIProvider } from './providers/GoogleAIProvider';
import { AnthropicProvider } from './providers/AnthropicProvider';
import { OpenAIProvider } from './providers/OpenAIProvider';

// —— 实例化并按指定顺序注册 Provider ——
// 1. Ollama - 使用异步初始化确保配置正确加载
let ollamaProvider: OllamaProvider;

// 异步初始化OllamaProvider，确保使用正确的配置
async function initializeOllamaProvider(): Promise<OllamaProvider> {
  if (ollamaProvider) {
    return ollamaProvider;
  }

  try {
    // 优先从OllamaConfigService获取配置
    const { OllamaConfigService } = await import('@/lib/config/OllamaConfigService');
    let ollamaUrl = await OllamaConfigService.getOllamaUrl();
    
    // 如果OllamaConfigService没有配置，从ProviderRepository获取
    if (!ollamaUrl || ollamaUrl === 'http://localhost:11434') {
      const { providerRepository } = await import('@/lib/provider/ProviderRepository');
      const providerList = await providerRepository.getAll();
      const saved = providerList.find(p => p.name === 'Ollama');
      if (saved && saved.url && saved.url.trim() && saved.url !== 'http://localhost:11434') {
        ollamaUrl = saved.url;
        console.log(`[llm/index] 使用 ProviderRepository 配置的 URL: ${saved.url}`);
      }
    }
    
    // 确保有有效的URL
    if (!ollamaUrl || ollamaUrl === 'http://localhost:11434') {
      ollamaUrl = 'http://localhost:11434';
      console.log(`[llm/index] 使用默认 URL: ${ollamaUrl}`);
    } else {
      console.log(`[llm/index] 使用配置的 URL: ${ollamaUrl}`);
    }
    
    ollamaProvider = new OllamaProvider(ollamaUrl);
    ProviderRegistry.register(ollamaProvider);
    return ollamaProvider;
  } catch (error) {
    console.warn('[llm/index] 读取 Ollama 配置失败，使用默认配置:', error);
    ollamaProvider = new OllamaProvider('http://localhost:11434');
    ProviderRegistry.register(ollamaProvider);
    return ollamaProvider;
  }
}

// 2. DeepSeek
const deepseekApiKey: string | undefined = undefined;
ProviderRegistry.register(new DeepSeekProvider('https://api.deepseek.com', deepseekApiKey));

// 3. Google AI
const googleApiKey: string | undefined = undefined;
ProviderRegistry.register(new GoogleAIProvider('https://generativelanguage.googleapis.com/v1beta', googleApiKey));

// 4. Anthropic (Claude)
const anthropicKey: string | undefined = undefined;
ProviderRegistry.register(new AnthropicProvider('https://api.anthropic.com/v1', anthropicKey));

// 5. OpenAI
const openaiKey: string | undefined = undefined;
ProviderRegistry.register(new OpenAIProvider('https://api.openai.com/v1', openaiKey));

import { LLMInterpreter } from './interpreter';

let _interpreterInstance: LLMInterpreter | null = null;

export async function initializeLLM(forceUpdate = false): Promise<boolean> {
  try {
    // 确保OllamaProvider已正确初始化
    await initializeOllamaProvider();
    
    if (!_interpreterInstance) {
      _interpreterInstance = new LLMInterpreter();
    }
    await _interpreterInstance.initialize(forceUpdate);
    return true;
  } catch (err) {
    console.error('[initializeLLM] 初始化失败', err);
    return false;
  }
}

// 添加更新OllamaProvider URL的函数
export async function updateOllamaProviderUrl(newUrl: string): Promise<void> {
  try {
    if (ollamaProvider) {
      // 如果URL为空，使用默认值
      const effectiveUrl = newUrl.trim() || 'http://localhost:11434';
      (ollamaProvider as any).baseUrl = effectiveUrl;
      console.log(`[llm/index] 已更新 OllamaProvider URL: ${effectiveUrl}`);
    }
  } catch (error) {
    console.error('[llm/index] 更新 OllamaProvider URL 失败:', error);
  }
}

export function getInterpreter(): LLMInterpreter | null {
  return _interpreterInstance;
}

// ---- 类型 re-export ----
export type { Message, StreamCallbacks } from './types';

// ---- 兼容旧 Hook 包装函数 ----
export async function chat(
  provider: string,
  model: string,
  messages: import('./types').Message[],
  options: Record<string, any> = {}
): Promise<{ content: string; raw: any }> {
  await initializeLLM();
  const inst = getInterpreter();
  if (!inst) throw new Error('LLMInterpreter not initialized');
  return inst.chat(provider, model, messages as any, options);
}

export async function streamChat(
  provider: string,
  model: string,
  messages: import('./types').Message[],
  callbacks: import('./types').StreamCallbacks,
  options: Record<string, any> = {}
) {
  await initializeLLM();
  const inst = getInterpreter();
  if (!inst) throw new Error('LLMInterpreter not initialized');
  return inst.streamChat(provider, model, messages as any, callbacks as any, options);
}

export function cancelStream() {
  const inst = getInterpreter();
  if (inst) {
    inst.cancelStream();
  }
}

export { ProviderRegistry };

