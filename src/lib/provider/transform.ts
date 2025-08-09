import { ProviderEntity, ProviderStatus, ModelEntity } from './types';
import { generateAvatarDataUrl } from '@/lib/avatar';
import type { ProviderWithStatus } from '@/hooks/useProviderManagement';

/**
 * 将持久化的 ProviderEntity + models 映射为 UI 层使用的 ProviderWithStatus
 */
export function mapToProviderWithStatus(
  entity: ProviderEntity & { models?: ModelEntity[] }
): ProviderWithStatus {
  const displayName = entity.displayName || entity.name;
  // 若存在 avatarSeed，则用生成头像替代默认 icon
  const defaultIcon = `/llm-provider-icon/${entity.name.toLowerCase().replace(/\s+/g, '-')}.svg`;
  const icon = entity.avatarSeed
    ? generateAvatarDataUrl(entity.avatarSeed, displayName, 20)
    : defaultIcon;

  return {
    name: displayName,
    aliases: [entity.name],
    icon,
    api_base_url: entity.url,
    requiresApiKey: entity.requiresKey,
    default_api_key: entity.apiKey || null,
    isUserAdded: !!(entity as any).isUserAdded,
    isVisible: (entity as any).isVisible !== false,
    models: (entity.models ?? []).map((m) => ({
      name: m.name,
      aliases: m.aliases,
      label: m.label,
      api_key: (m as any).apiKey ?? null,
    })),
    // 透传运行时显示状态（若存在）
    isConnected: entity.status === ProviderStatus.CONNECTED,
    displayStatus: ((): ProviderWithStatus['displayStatus'] => {
      switch (entity.status) {
        case ProviderStatus.CONNECTED:
          return 'CONNECTED';
        case ProviderStatus.NOT_CONNECTED:
          return 'NOT_CONNECTED';
        case ProviderStatus.NO_KEY:
          return 'NO_KEY';
        case ProviderStatus.CONNECTING:
          return 'CONNECTING';
        case ProviderStatus.UNKNOWN:
        default:
          return 'UNKNOWN';
      }
    })(),
    statusTooltip: (() => {
      if (entity.status === ProviderStatus.NO_KEY) return '未配置 API 密钥';
      if (entity.status === ProviderStatus.NOT_CONNECTED) {
        switch ((entity as any).lastReason) {
          case 'AUTH': return '鉴权失败，请检查 API Key';
          case 'NETWORK': return '网络异常或服务不可达';
          case 'TIMEOUT': return '连接超时，请稍后重试';
          case 'UNKNOWN': return (entity as any).lastMessage || '连接失败';
          default: return (entity as any).lastMessage || '连接失败';
        }
      }
      return null;
    })(),
    healthCheckPath: undefined,
    authenticatedHealthCheckPath: undefined,
  } as ProviderWithStatus;
}