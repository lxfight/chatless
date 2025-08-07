// Ollama API端点列表
const OLLAMA_ENDPOINTS = [
  '/api/tags',      // 获取模型列表
  '/api/generate',  // 生成文本
  '/api/chat',      // 聊天对话
  '/api/embeddings', // 嵌入向量
  '/api/show',      // 显示模型信息
  '/api/pull',      // 拉取模型
  '/api/push',      // 推送模型
  '/api/create',    // 创建模型
  '/api/copy',      // 复制模型
  '/api/delete'     // 删除模型
];

// 检查是否为Ollama请求
function isOllamaRequest(url: string): boolean {
  return OLLAMA_ENDPOINTS.some(endpoint => url.includes(endpoint));
}

// 单例初始化标记
let initialized = false;

// 简单的Ollama CORS补丁
async function initOllamaCorsPatch() {
  if (initialized) return;
  
  const { addRequestInterceptor } = await import('./request');
  
  addRequestInterceptor(async (url, options) => {
    // 只处理启用了browserHeaders的Ollama请求
    if (options.browserHeaders && isOllamaRequest(url) && !options.origin) {
      options.origin = 'http://localhost:3000';
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[OllamaCorsPatch] 设置Origin为localhost:3000`);
      }
    }
    return { url, options };
  });
  
  initialized = true;
  console.log('[OllamaCorsPatch] 已初始化');
}

// 延迟初始化
setTimeout(() => initOllamaCorsPatch(), 0);

 