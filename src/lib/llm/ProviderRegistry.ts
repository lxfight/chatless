import { BaseProvider } from './providers/BaseProvider';

/**
 * 简单注册表，用于运行时获取 Provider 实例
 */
export class ProviderRegistry {
  private static providers: Record<string, BaseProvider> = {};

  static register(provider: BaseProvider) {
    this.providers[provider.name] = provider;
  }

  static get(name: string): BaseProvider | undefined {
    return this.providers[name];
  }

  static all(): BaseProvider[] {
    return Object.values(this.providers);
  }
}
