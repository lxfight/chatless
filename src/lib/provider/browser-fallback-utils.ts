/**
 * 浏览器请求兜底工具模块
 * 提供统一的Provider偏好检查和URL匹配逻辑
 */

// 缓存Provider配置，避免频繁查询
let providerConfigCache: Array<{
  name: string;
  url: string;
  useBrowserRequest: boolean;
}> | null = null;

let cacheTimestamp = 0;
const CACHE_TTL = 30000; // 30秒缓存

/**
 * 刷新Provider配置缓存
 */
async function refreshProviderCache(): Promise<void> {
  try {
    const { providerRepository } = await import('@/lib/provider/ProviderRepository');
    const providers = await providerRepository.getAll();
    
    providerConfigCache = providers
      .filter(provider => provider.url) // 只缓存有URL的provider
      .map(provider => ({
        name: provider.name,
        url: provider.url!,
        useBrowserRequest: provider.preferences?.useBrowserRequest || false
      }));
    
    cacheTimestamp = Date.now();
  } catch (error) {
    console.warn('[browser-fallback] Failed to refresh provider cache:', error);
    // 保持旧缓存，避免功能完全失效
  }
}

/**
 * 获取Provider配置缓存
 */
async function getProviderCache(): Promise<typeof providerConfigCache> {
  const now = Date.now();
  
  // 检查缓存是否需要刷新
  if (!providerConfigCache || (now - cacheTimestamp) > CACHE_TTL) {
    await refreshProviderCache();
  }
  
  return providerConfigCache;
}

/**
 * 标准化URL，用于比较
 */
function normalizeUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    // 移除尾部斜杠，统一协议和主机格式
    return `${urlObj.protocol}//${urlObj.host}`.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * 检查URL是否匹配Provider
 */
function isUrlMatchProvider(requestUrl: string, providerUrl: string): boolean {
  try {
    // 方法1: 精确的base URL匹配
    const normalizedRequestUrl = normalizeUrl(requestUrl);
    const normalizedProviderUrl = normalizeUrl(providerUrl);
    
    if (normalizedRequestUrl && normalizedProviderUrl) {
      if (normalizedRequestUrl === normalizedProviderUrl) {
        return true;
      }
    }
    
    // 方法2: 前缀匹配（处理子路径）
    const cleanProviderUrl = providerUrl.replace(/\/$/, '');
    if (requestUrl.startsWith(cleanProviderUrl)) {
      return true;
    }
    
    return false;
  } catch {
    return false;
  }
}

/**
 * 检查URL对应的Provider是否设置了使用浏览器请求方式
 * @param url 请求URL
 * @param context 调用上下文，用于日志标识
 * @returns 是否应该使用浏览器请求方式
 */
export async function shouldUseBrowserRequest(url: string, context: string = 'request'): Promise<boolean> {
  try {
    if (!url) {
      return false;
    }
    
    const providerCache = await getProviderCache();
    if (!providerCache || providerCache.length === 0) {
      return false;
    }
    
    // 查找匹配的Provider
    const matchingProvider = providerCache.find(provider => 
      isUrlMatchProvider(url, provider.url)
    );
    
    const shouldUse = matchingProvider?.useBrowserRequest || false;
    
    if (shouldUse) {
      console.log(`[${context}] 检测到Provider "${matchingProvider?.name}" 启用浏览器请求方式`);
    }
    
    return shouldUse;
  } catch (error) {
    console.warn(`[${context}] Failed to check provider browser request preference:`, error);
    return false;
  }
}

/**
 * 手动刷新Provider配置缓存
 * 当Provider配置发生变化时调用
 */
export function invalidateProviderCache(): void {
  providerConfigCache = null;
  cacheTimestamp = 0;
}

/**
 * 获取当前缓存状态（用于调试）
 */
export function getCacheInfo(): {
  hasCachedData: boolean;
  cacheAge: number;
  cachedProviders: number;
} {
  const now = Date.now();
  return {
    hasCachedData: providerConfigCache !== null,
    cacheAge: now - cacheTimestamp,
    cachedProviders: providerConfigCache?.length || 0
  };
}

/**
 * 获取启用浏览器请求的Provider列表（用于调试）
 */
export async function getBrowserRequestProviders(): Promise<Array<{
  name: string;
  url: string;
  useBrowserRequest: boolean;
}>> {
  const cache = await getProviderCache();
  return cache?.filter(p => p.useBrowserRequest) || [];
}

/**
 * 测试URL匹配逻辑（用于调试）
 */
export async function testUrlMatching(testUrl: string): Promise<{
  matchedProvider: string | null;
  shouldUseBrowser: boolean;
  allProviders: Array<{ name: string; url: string; useBrowserRequest: boolean }>;
}> {
  const cache = await getProviderCache();
  const allProviders = cache || [];
  
  const matchingProvider = allProviders.find(provider => 
    isUrlMatchProvider(testUrl, provider.url)
  );
  
  return {
    matchedProvider: matchingProvider?.name || null,
    shouldUseBrowser: matchingProvider?.useBrowserRequest || false,
    allProviders
  };
}
