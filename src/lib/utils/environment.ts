/**
 * Environment Detection Utilities
 * 检测当前应用运行环境（Tauri应用 vs 浏览器）
 */

// 扩展window对象类型以支持Tauri全局对象
declare global {
  interface Window {
    __TAURI__?: {
      core?: {
        invoke?: Function;
      };
    };
    __TAURI_INTERNALS__?: any;
  }
}

// 环境检测结果类型
export interface EnvironmentDetection {
  isTauri: boolean;
  inBrowser: boolean;
  userAgent: string;
  hasWindow: boolean;
  hasTauriGlobal: boolean;
  hasTauriInternals: boolean;
  canCallInvoke: boolean;
  nodeEnv: string;
  testResult?: {
    success: boolean;
    method: string;
    result?: any;
    error?: string;
  };
}

/**
 * 简单的Tauri环境检测（仅用于基础判断）
 * 真正的检测应该使用 detectTauriEnvironment()
 */
export function isTauriEnvironment(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return typeof window.__TAURI__ !== 'undefined' || typeof window.__TAURI_INTERNALS__ !== 'undefined';
}

/**
 * 异步检测Tauri环境并测试API可用性
 * 直接通过greet方法调用来判断
 */
export async function detectTauriEnvironment(): Promise<boolean> {
  try {
    
    // 尝试调用greet方法 - 这是最直接的判断方式
    const { invoke } = await import('@tauri-apps/api/core');
    
    const result = await invoke('greet');
    
    return true;
  } catch (error) {
    // 如果greet调用失败，说明不在Tauri环境中
    return false;
  }
}

/**
 * 检查是否在浏览器环境中运行
 */
export function isBrowserEnvironment(): boolean {
  return typeof window !== 'undefined' && !isTauriEnvironment();
}

/**
 * 获取详细的环境信息用于调试
 */
export function getEnvironmentDetails(): EnvironmentDetection {
  const hasWindow = typeof window !== 'undefined';
  const userAgent = hasWindow ? navigator.userAgent : 'Server';
  const nodeEnv = process.env.NODE_ENV || 'unknown';
  
  // 基础检查
  const hasTauriGlobal = hasWindow && typeof window.__TAURI__ !== 'undefined';
  const hasTauriInternals = hasWindow && typeof window.__TAURI_INTERNALS__ !== 'undefined';
  const canCallInvoke = hasTauriGlobal && typeof window.__TAURI__?.core?.invoke === 'function';
  
  // 简单判断：有Tauri标识就认为是Tauri环境
  // 真正的验证通过greet调用在performEnvironmentCheck中进行
  const isTauri = hasTauriGlobal || hasTauriInternals;

  return {
    isTauri,
    inBrowser: hasWindow && !isTauri,
    userAgent,
    hasWindow,
    hasTauriGlobal,
    hasTauriInternals,
    canCallInvoke,
    nodeEnv
  };
}

/**
 * 执行完整的环境检查包括API测试
 * 最终判断基于greet方法调用结果
 */
export async function performEnvironmentCheck(): Promise<EnvironmentDetection> {
  const basic = getEnvironmentDetails();
  
  // 始终尝试greet调用来确定真实环境
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const result = await invoke('greet');
    
    // greet成功，确认在Tauri环境中
    basic.isTauri = true;
    basic.inBrowser = false;
    basic.testResult = {
      success: true,
      method: 'greet',
      result
    };
    
  } catch (error) {
    // greet失败，确认在浏览器环境中
    basic.isTauri = false;
    basic.inBrowser = true;
    basic.testResult = {
      success: false,
      method: 'greet',
      error: error instanceof Error ? error.message : String(error)
    };
    
  }

  return basic;
}

/**
 * 记录环境检测信息到控制台
 */
export function logEnvironmentInfo(detection: EnvironmentDetection): void {
  console.group('🔍 Environment Detection Results');
  
  console.log('Environment Type:', detection.isTauri ? '🖥️ Tauri App' : '🌐 Browser');
  console.log('User Agent:', detection.userAgent);
  console.log('Node Environment:', detection.nodeEnv);
  
  console.group('Tauri Detection Details');
  console.log('Has Window Object:', detection.hasWindow);
  console.log('Has __TAURI__ Global:', detection.hasTauriGlobal);
  console.log('Has __TAURI_INTERNALS__:', detection.hasTauriInternals);
  console.log('Can Call Invoke:', detection.canCallInvoke);
  console.groupEnd();
  
  if (detection.testResult) {
    console.group('API Test Results');
    console.log('Test Method:', detection.testResult.method);
    console.log('Success:', detection.testResult.success);
    if (detection.testResult.success && detection.testResult.result) {
      console.log('Result:', detection.testResult.result);
    }
    if (!detection.testResult.success && detection.testResult.error) {
      console.log('Error:', detection.testResult.error);
    }
    console.groupEnd();
  }
  
  console.groupEnd();
}

/**
 * 更可靠的开发环境检测：
 * 1. 编译时常量 `process.env.NODE_ENV`
 * 2. Vite / ESM `import.meta.env.DEV`
 * 3. 运行时主机名为 localhost / 127.0.0.1
 */
export function isDevelopmentEnvironment(): boolean {
  try {
    // 1. 编译时常量 (Next.js & many bundlers都会替换)
    if (typeof process !== 'undefined' && typeof process.env !== 'undefined') {
      if (process.env.NODE_ENV === 'development') return true;
      // 如果显示标明 production，则继续后续检查，以兼容 "production" 构建但仍在 dev server 运行的情况
    }

    // 2. Vite-style import.meta.env.DEV / .MODE
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (import.meta.env.DEV === true) return true;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (import.meta.env.MODE === 'development') return true;
    }

    // 3. 运行时 window host 检测 (Tauri dev 使用 localhost:3000)
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (host === 'localhost' || host === '127.0.0.1') return true;
    }
  } catch (_) {
    /* 安静失败，返回 false */
  }
  return false;
}

export function isDevelopment(): boolean {
  return isDevelopmentEnvironment();
}

/**
 * 生产环境标识
 */
export function isProduction(): boolean {
  return !isDevelopmentEnvironment();
}

/**
 * 检测是否可以使用Tauri API
 * 注意：这只是基础检查，实际使用请用 detectTauriEnvironment()
 */
export function canUseTauriAPI(): boolean {
  return isTauriEnvironment();
}

/**
 * 真正的Tauri环境检测 - 通过greet调用验证
 * 这是最可靠的检测方法
 */
export async function canUseTauriAPIAsync(): Promise<boolean> {
  return await detectTauriEnvironment();
}

/**
 * 简化的环境状态检测
 * 返回开发工具是否可用的状态
 */
export async function getDevToolsStatus(): Promise<{
  isDevEnv: boolean;
  isTauriApp: boolean;
  canUseDevTools: boolean;
}> {
  console.log('🚀 开始检测开发工具状态...');
  
  const isDevEnv = isDevelopment();
  console.log('🔧 开发环境检测:', isDevEnv ? '是' : '否');
  
  const isTauriApp = await detectTauriEnvironment();
  console.log('🖥️ Tauri应用检测:', isTauriApp ? '是' : '否');
  
  const canUseDevTools = isDevEnv && isTauriApp;
  console.log('🛠️ 开发工具可用:', canUseDevTools ? '是' : '否');
  
  return {
    isDevEnv,
    isTauriApp,
    canUseDevTools
  };
}

/**
 * 检测是否应该显示开发工具
 */
export function shouldShowDevTools(): boolean {
  return isDevelopmentEnvironment();
} 