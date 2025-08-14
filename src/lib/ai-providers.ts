import { tauriFetch } from '@/lib/request';
import { useOllamaStore } from '@/store/ollamaStore';

// 定义一个通用的模型获取函数类型
// 允许返回 null 表示获取失败, "NO_KEY" 表示缺少 API Key
type ModelFetcher = (url: string, apiKey?: string | null) => Promise<string[] | null | "NO_KEY">;

// --- Ollama ---
export const fetchOllamaModels: (url: string, apiKey?: string | null) => Promise<string[] | "NO_KEY" | null> = async (url, apiKey) => {
    const endpoint = `${url.replace(/\/$/, '')}/api/tags`;
    try {
        console.log(`Attempting to fetch Ollama models from ${endpoint}...`);
        console.log(`Using Tauri HTTP plugin with URL: ${endpoint}`);
        
        const response = await tauriFetch(endpoint, {
            method: 'GET',
            rawResponse: true,
            browserHeaders: true,
            danger: { acceptInvalidCerts: true, acceptInvalidHostnames: true }
        });
        if (!response.ok) {
            const errorBody = await response.text().catch(() => 'Could not read error body');
            console.error(`Ollama API request failed at ${endpoint}: ${response.status} ${response.statusText}`, errorBody);
            if (response.status === 404) {
                 console.warn(`Ollama endpoint /api/tags 不可用，返回空模型列表`);
                 return [];
            }
            return null;
        }
        const data = await response.json() as { models?: { name: string }[] };
        if (data && Array.isArray(data.models)) {
            const modelNames = data.models
                .filter((model: any) => typeof model.name === 'string')
                .map((model: any) => model.name);
            console.log(`Successfully fetched Ollama models from ${endpoint}:`, modelNames);
            
            // 使用 Zustand store 更新模型列表
            useOllamaStore.getState().setModels(modelNames);
            
            return modelNames;
        }
        console.warn(`Unexpected response structure from Ollama ${endpoint}:`, data);
        return null;
    } catch (error) {
        console.error(`Detailed error when fetching Ollama models:`, error);
        
        if (error instanceof Error) {
            console.error(`Error name: ${error.name}, message: ${error.message}`);
            console.error(`Error stack: ${error.stack}`);
            
            if (error.message.startsWith('error sending request for url')) {
                console.error(`Connection Error: Ollama server may not be running at ${url} or is not accessible`);
            } else if (error.message.includes('Network Error')) { 
                console.error(`Network Error: Check firewall/CORS settings if the server is running`);
            } else if (error.message.includes('Failed to fetch')) {
                console.error(`Failed to fetch: This could be a CORS issue or the Tauri HTTP plugin permissions`);
                console.error(`Try manually accessing ${endpoint} in your browser to verify the server is responding`);
            }
        }
        
        return null;
    }
};

// --- OpenAI ---
export const fetchOpenAiModels: ModelFetcher = async (url, apiKey) => {
    if (!apiKey) {
        console.warn("OpenAI API Key not configured.");
        return "NO_KEY";
    }
    const fullUrl = `${url.replace(/\/$/, '')}/models`;
    try {
        console.log(`Fetching OpenAI models from ${fullUrl}...`);
        const response = await tauriFetch(fullUrl, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (!response.ok) {
             console.error(`OpenAI API request failed: ${response.status}`, await response.text());
             return null;
        }
        const data = await response.json() as { data?: { id: string }[] };
        if (data && Array.isArray(data.data)) {
             const modelNames = data.data
                .map((model: any) => model.id)
                .filter((id: any): id is string => typeof id === 'string');
            console.log("Successfully fetched OpenAI models:", modelNames);
            return modelNames;
        }
        console.warn(`Unexpected OpenAI models response structure from ${fullUrl}:`, data);
        return null;
    } catch (error) {
        console.error(`Failed to fetch OpenAI models from ${fullUrl}:`, error);
        return null;
    }
};

// --- Anthropic (Placeholder) ---
export const fetchAnthropicModels: ModelFetcher = async (url, apiKey) => {
  if (!apiKey) {
    console.warn("Anthropic API Key not configured, cannot fetch models.");
    return "NO_KEY";
  }
  // Anthropic 没有公开简单的模型列表 API 端点。
  // v1/models 需要 beta 访问权限。
  // 作为替代，我们可以返回已知的主要模型或让用户手动添加。
  // 这里返回一个硬编码列表作为占位符。
  console.warn("Anthropic model fetching via standard API is not available. Returning a common model list as placeholder. Configure models manually if needed.");
  return ["claude-3-5-sonnet-20240620", "claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307", "claude-2.1", "claude-2.0", "claude-instant-1.2"];
};

// --- Google AI (Gemini) ---
export const fetchGoogleAiModels: ModelFetcher = async (url, apiKey) => {
   if (!apiKey) {
        console.warn("Google AI API Key not configured, cannot fetch models.");
        return "NO_KEY";
    }
    // Google AI 使用 API Key 作为查询参数
    const fullUrl = `${url.replace(/\/$/, '')}/models`;
    try {
        console.log(`Fetching Google AI models from ${fullUrl}...`);
        const response = await tauriFetch(fullUrl, { method: 'GET', headers: { 'x-goog-api-key': apiKey } });
        if (!response.ok) {
             console.error(`Google AI API request failed: ${response.status}`, await response.text());
             return null;
        }
        const data = await response.json() as { models?: { name: string, displayName?: string, description?: string }[] };
        if (data && Array.isArray(data.models)) {
             // Google 返回的 name 格式是 "models/gemini-1.5-flash-latest"
             // 我们通常想要的是 "gemini-1.5-flash-latest" 这部分
             const modelNames = data.models
                .map((model: any) => model.name?.startsWith('models/') ? model.name.split('/')[1] : model.name)
                .filter((name: any): name is string => typeof name === 'string');
            console.log("Successfully fetched Google AI models:", modelNames);
            return modelNames;
        }
        console.warn(`Unexpected Google AI models response structure from ${fullUrl}:`, data);
        return null;
    } catch (error) {
        console.error(`Failed to fetch Google AI models from ${fullUrl}:`, error);
        return null;
    }
};

// --- LocalAI (Placeholder) ---
export const fetchLocalAiModels: (url: string, apiKey?: string | null) => Promise<string[] | null> = async (url, apiKey) => {
  // LocalAI 可能模仿 OpenAI 的 /v1/models 端点
  // 1. 修正 URL 拼接
  const cleanBaseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
  let modelsUrl: string;
  if (cleanBaseUrl.endsWith('/v1')) {
      modelsUrl = `${cleanBaseUrl}/models`; 
  } else {
      modelsUrl = `${cleanBaseUrl}/v1/models`; 
  }
  console.log(`Fetching models for LocalAI at ${cleanBaseUrl}. Using endpoint: ${modelsUrl}`);

  try {
        // 使用修正后的 modelsUrl
        const response = await tauriFetch(modelsUrl, {
            method: 'GET',
            // headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : undefined, // 根据 LocalAI 是否需要 Key 添加
        });

        if (!response.ok) {
             console.error(`Failed to fetch LocalAI models from ${modelsUrl}: API request failed with status ${response.status}`);
             // 2. 关键修改：失败时返回 null
             // throw new Error(`API request failed: ${response.status}`); 
             return null; 
        }

        const data = await response.json() as { data?: { id: string }[] };
        // 检查返回的数据结构是否符合预期 (OpenAI 格式)
        if (data && Array.isArray(data.data)) {
             const modelNames = data.data
                .map((model: any) => model.id)
                .filter((id: any): id is string => typeof id === 'string');
            console.log(`Successfully fetched LocalAI models from ${modelsUrl}:`, modelNames);
            return modelNames;
        } else {
            // 如果数据结构不符合预期，也视为失败
            console.warn(`Unexpected data structure from LocalAI models endpoint ${modelsUrl}:`, data);
            return null; 
        }

    } catch (error: any) {
        console.error(`Failed to fetch LocalAI models from ${cleanBaseUrl}:`, error.message || error);
        // 2. 关键修改：捕获到错误时返回 null
        return null;
    }
};


// 提供商名称到获取函数的映射
interface ProviderFetchers {
    // 调整类型以适应不同的 fetcher 签名
    [providerName: string]: ((url: string, apiKey?: string | null) => Promise<string[] | null | "NO_KEY">) | undefined;
}

export const providerFetchers: ProviderFetchers = {
    "Ollama": fetchOllamaModels,
    "OpenAI": fetchOpenAiModels,
    "Anthropic": fetchAnthropicModels, // 使用占位符
    "Google AI": fetchGoogleAiModels,
    "LocalAI": fetchLocalAiModels,     // 尝试 OpenAI 兼容端点
    // 如果添加新的 Provider，在此处添加映射
}; 