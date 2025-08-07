import { BaseProvider } from './providers/BaseProvider';

/**
 * 简单注册表，用于运行时获取 Provider 实例
 */
export class ProviderRegistry {
  private static providers: Record<string, BaseProvider> = {};
  private static order: string[] = [];

  static register(provider: BaseProvider) {
    this.providers[provider.name] = provider;
    // 记录注册顺序
    if (!this.order.includes(provider.name)) {
      this.order.push(provider.name);
    }
  }

  static get(name: string): BaseProvider | undefined {
    return this.providers[name];
  }

  static all(): BaseProvider[] {
    // 按注册顺序返回providers
    return this.order.map(name => this.providers[name]).filter(Boolean);
  }

  /**
   * 按指定顺序获取providers
   */
  static allInOrder(preferredOrder: string[]): BaseProvider[] {
    const result: BaseProvider[] = [];
    const used = new Set<string>();
    
    // 首先按偏好顺序添加
    for (const name of preferredOrder) {
      const provider = this.providers[name];
      if (provider) {
        result.push(provider);
        used.add(name);
      }
    }
    
    // 然后添加剩余的providers（按注册顺序）
    for (const name of this.order) {
      if (!used.has(name)) {
        const provider = this.providers[name];
        if (provider) {
          result.push(provider);
        }
      }
    }
    
    return result;
  }

  /**
   * 清除所有注册的providers
   */
  static clear(): void {
    this.providers = {};
    this.order = [];
  }
}
