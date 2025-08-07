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

// 简单的Ollama请求处理函数
export function processOllamaRequest(url: string, options: any): { url: string; options: any } {
  // 只处理启用了browserHeaders的Ollama请求
  if (options.browserHeaders && isOllamaRequest(url) && !options.origin) {
    options.origin = 'http://localhost:3000';
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[OllamaCorsPatch] 设置Origin为localhost:3000`);
    }
  }
  return { url, options };
}

// 导出检查函数供其他地方使用
export { isOllamaRequest };

 