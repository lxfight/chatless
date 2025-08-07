import { fetch as httpFetch } from '@tauri-apps/plugin-http';
import { useNetworkPreferences } from '@/store/networkPreferences';
import { isDevelopmentEnvironment } from '@/lib/utils/environment';

// 导入Ollama CORS补丁（自动初始化）
import './request-patches';



// 临时启用生产环境调试日志
const __DEV__ = isDevelopmentEnvironment();
const __DEBUG_PROD__ = true; // 临时启用生产环境调试
const __SHOULD_LOG__ = __DEV__ || __DEBUG_PROD__;

/**
 * 通用HTTP请求选项
 * 支持超时、重试、代理、CORS等配置
 */
export interface RequestOptions {
  /** 请求超时时间 (ms) – 传递给 tauri fetch */
  timeout?: number;
  /** 最大重试次数 (默认 0 不重试) */
  retries?: number;
  /** 重试间隔 (ms)，每次翻倍 (默认 1000) */
  retryDelay?: number;
  /** 是否直接返回 Response 对象 */
  rawResponse?: boolean;
  /** 是否添加浏览器请求头 */
  browserHeaders?: boolean;
  /** 自定义Origin头，用于解决CORS问题 */
  origin?: string;
  /** 额外透传给 tauri fetch 的任何字段 */
  [key: string]: any;
}

type RequestInterceptor = (url: string, options: RequestOptions) => Promise<{ url: string; options: RequestOptions }> | { url: string; options: RequestOptions };
type ResponseInterceptor = (response: Response) => Promise<Response> | Response;

const requestInterceptors: RequestInterceptor[] = [];
const responseInterceptors: ResponseInterceptor[] = [];



export function addRequestInterceptor(fn: RequestInterceptor) {
  requestInterceptors.push(fn);
}

export function addResponseInterceptor(fn: ResponseInterceptor) {
  responseInterceptors.push(fn);
}



async function applyRequestInterceptors(initialUrl: string, initialOptions: RequestOptions): Promise<{ url: string; options: RequestOptions }> {
  let current = { url: initialUrl, options: initialOptions };
  for (const interceptor of requestInterceptors) {
    current = await interceptor(current.url, current.options);
  }
  return current;
}

async function applyResponseInterceptors(resp: Response): Promise<Response> {
  let current = resp;
  for (const interceptor of responseInterceptors) {
    current = await interceptor(current);
  }
  return current;
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}



/**
 * 通用HTTP请求函数
 * 基于Tauri HTTP插件，支持拦截器、重试、代理配置等功能
 * 
 * @param inputUrl 请求URL
 * @param opts 请求选项
 * @returns 响应数据或Response对象
 */
export async function request<T = any>(inputUrl: string, opts: RequestOptions = {}): Promise<T | Response> {
  const defaultedOpts: RequestOptions = {
    retries: 0,
    retryDelay: 1000,
    ...opts,
  };

  // 应用网络偏好设置（代理、离线模式等）
  const { proxyUrl, useSystemProxy, offline } = useNetworkPreferences.getState();
  if (offline) {
    throw new Error('离线模式已开启');
  }
  if (proxyUrl && !useSystemProxy) {
    (defaultedOpts as any).proxy = { all: proxyUrl };
  }

  // 执行请求拦截器 (可修改 url / options)
  const { url, options } = await applyRequestInterceptors(inputUrl, defaultedOpts);

  // 添加浏览器请求头（模拟浏览器行为）
  if (options.browserHeaders) {
    const browserHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'cross-site'
    };
    
    // 设置Origin头（如果指定）
    if (options.origin) {
      browserHeaders['Origin'] = options.origin;
      if (__SHOULD_LOG__) {
        console.log(`[tauriFetch] 设置自定义Origin: "${options.origin}"`);
      }
    }
    // 注意：如果不指定origin，则不设置Origin头，让Tauri自动处理
    
    options.headers = {
      ...browserHeaders,
      ...(options.headers || {})
    };
  }

  // 添加默认的安全配置（允许自签名证书等）
  if (!options.danger) {
    options.danger = {
      acceptInvalidCerts: true,
      acceptInvalidHostnames: false
    };
  }

  // --- 调试日志：打印真实请求头信息 ---
  if (__SHOULD_LOG__) {
    const headers = options.headers as Record<string, string> || {};
    console.log(`[tauriFetch] ${options.method || 'GET'} ${url}`);
    console.log(`[tauriFetch] Headers:`, headers);
    // 特别显示Origin头，帮助调试CORS问题
    if (headers['Origin']) {
      console.log(`[tauriFetch] Origin Header: "${headers['Origin']}"`);
    } else {
      console.log(`[tauriFetch] Origin Header: 未设置`);
    }
  }

  let attempt = 0;
  let resp: Response | null = null;
  let error: any = null;

  const maxAttempts = (options.retries ?? 0) + 1;

  while (attempt < maxAttempts) {
    try {
      resp = await httpFetch(url, options as any);

      if (__SHOULD_LOG__) {
        console.log(`[tauriFetch] Response: ${resp.status} ${resp.statusText}`);
        // 打印响应头
        const responseHeaders: Record<string, string> = {};
        resp.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });
        console.log(`[tauriFetch] Response Headers:`, responseHeaders);
      }
      
      // 如果 status >= 500 且还有重试机会，进行重试
      if (!resp.ok && resp.status >= 500 && attempt < maxAttempts - 1) {
        await sleep(options.retryDelay! * Math.pow(2, attempt));
        attempt++;
        continue;
      }
      // 成功或客户端错误，跳出循环
      break;
    } catch (err) {
      error = err;
      if (attempt < maxAttempts - 1) {
        await sleep(options.retryDelay! * Math.pow(2, attempt));
        attempt++;
        continue;
      }
      // exhausted retries
      throw error;
    }
  }

  if (!resp) throw error ?? new Error('Unknown network error');

  // 响应拦截器
  resp = await applyResponseInterceptors(resp);

  // 若调用方需要原始 Response，则直接返回
  if (options.rawResponse) return resp;

  // 非 2xx 状态时抛出包含正文的错误，方便上层捕获并展示
  if (!resp.ok) {
    let errorBody: string | undefined;
    try {
      errorBody = await (resp.clone() as any).text();
    } catch {}
    const errMsg = `HTTP ${resp.status} ${resp.statusText}` + (errorBody ? `\nBody: ${errorBody}` : '');
    throw new Error(errMsg);
  }

  // 默认按 JSON 解析
  try {
    return await (resp as any).json();
  } catch {
    return resp as unknown as T;
  }
}

export { request as tauriFetch }; // 兼容旧引用 