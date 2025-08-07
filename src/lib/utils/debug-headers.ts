/**
 * HTTP头部调试工具
 * 用于在开发和生产环境中查看请求和响应头
 */

export interface HeaderDebugInfo {
  url: string;
  method: string;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  status: number;
  statusText: string;
  timestamp: string;
  environment: 'development' | 'production';
}

/**
 * 打印HTTP请求和响应头信息
 */
export function debugHeaders(info: HeaderDebugInfo): void {
  console.group(`🔍 HTTP Headers Debug - ${info.environment.toUpperCase()}`);
  console.log(`📅 时间: ${info.timestamp}`);
  console.log(`🌐 URL: ${info.url}`);
  console.log(`📤 方法: ${info.method}`);
  console.log(`📊 状态: ${info.status} ${info.statusText}`);
  
  console.group('📤 请求头:');
  Object.entries(info.requestHeaders).forEach(([key, value]) => {
    console.log(`${key}: ${value}`);
  });
  console.groupEnd();
  
  console.group('📥 响应头:');
  Object.entries(info.responseHeaders).forEach(([key, value]) => {
    console.log(`${key}: ${value}`);
  });
  console.groupEnd();
  
  console.groupEnd();
}

/**
 * 从Response对象提取头部信息
 */
export function extractHeadersFromResponse(
  response: Response, 
  url: string, 
  method: string
): HeaderDebugInfo {
  const requestHeaders: Record<string, string> = {};
  const responseHeaders: Record<string, string> = {};
  
  // 提取响应头
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });
  
  return {
    url,
    method,
    requestHeaders,
    responseHeaders,
    status: response.status,
    statusText: response.statusText,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV === 'development' ? 'development' : 'production'
  };
}

/**
 * 增强的fetch函数，自动记录头部信息
 */
export async function debugFetch(
  url: string, 
  options: RequestInit = {}
): Promise<Response> {
  const startTime = Date.now();
  
  try {
    console.log(`🚀 开始请求: ${url}`);
    console.log(`📤 请求选项:`, options);
    
    const response = await fetch(url, options);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`✅ 请求完成: ${response.status} ${response.statusText} (${duration}ms)`);
    
    // 提取并打印头部信息
    const headerInfo = extractHeadersFromResponse(response, url, options.method || 'GET');
    debugHeaders(headerInfo);
    
    return response;
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.error(`❌ 请求失败: ${url} (${duration}ms)`, error);
    throw error;
  }
}

/**
 * 检查特定头部是否存在
 */
export function checkHeader(
  headers: Record<string, string>, 
  headerName: string
): { exists: boolean; value?: string } {
  const lowerHeaderName = headerName.toLowerCase();
  const entry = Object.entries(headers).find(([key]) => 
    key.toLowerCase() === lowerHeaderName
  );
  
  return {
    exists: !!entry,
    value: entry?.[1]
  };
}

/**
 * 比较两个请求的头部差异
 */
export function compareHeaders(
  headers1: Record<string, string>,
  headers2: Record<string, string>
): {
  onlyInFirst: Record<string, string>;
  onlyInSecond: Record<string, string>;
  different: Array<{ header: string; value1: string; value2: string }>;
} {
  const onlyInFirst: Record<string, string> = {};
  const onlyInSecond: Record<string, string> = {};
  const different: Array<{ header: string; value1: string; value2: string }> = [];
  
  // 检查只在第一个中存在的头部
  Object.entries(headers1).forEach(([key, value]) => {
    if (!(key in headers2)) {
      onlyInFirst[key] = value;
    } else if (headers2[key] !== value) {
      different.push({ header: key, value1: value, value2: headers2[key] });
    }
  });
  
  // 检查只在第二个中存在的头部
  Object.entries(headers2).forEach(([key, value]) => {
    if (!(key in headers1)) {
      onlyInSecond[key] = value;
    }
  });
  
  return { onlyInFirst, onlyInSecond, different };
} 