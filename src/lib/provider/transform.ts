import { ProviderEntity, ProviderStatus, ModelEntity } from './types';
import { getAvatarSync } from '@/lib/utils/logoService';
import { AVAILABLE_PROVIDERS_CATALOG } from './catalog';
import type { ProviderWithStatus } from '@/hooks/useProviderManagement';
import { getStaticModels } from './staticModels';

/**
 * 将持久化的 ProviderEntity + models 映射为 UI 层使用的 ProviderWithStatus
 */
export function mapToProviderWithStatus(
  entity: ProviderEntity & { models?: ModelEntity[] }
): ProviderWithStatus {
  const displayName = entity.displayName || entity.name;
  // 若存在 avatarSeed，则用生成头像替代默认 icon
  // 重要：catalog/static 解析必须使用稳定的主键 name，而不是可编辑的 displayName
  const catalog = AVAILABLE_PROVIDERS_CATALOG.find((c) => c.name === entity.name);
  const baseName = catalog ? catalog.id : entity.name.toLowerCase().replace(/\s+/g, '-');
  const defaultIcon = `/llm-provider-icon/${baseName}.png`;
  const icon = entity.avatarSeed
    ? getAvatarSync(entity.avatarSeed, displayName, 20)
    : defaultIcon;

  // 预先加载该 Provider 的静态模型，便于为缺失 label 的旧数据补全展示名
  // 使用稳定主键 name 查找；displayName 仅用于 UI 展示
  const staticList = getStaticModels(entity.name) || getStaticModels(displayName) || [];
  const idToLabel = new Map(staticList.map((m) => [m.id, m.label]));

  return {
    name: entity.name, // 保持原始name作为唯一标识
    displayName: displayName, // 添加displayName字段
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
      label: m.label || idToLabel.get(m.name) || m.name,
      api_key: (m as any).apiKey ?? null,
    })),
    // 透传运行时显示状态（若存在）
    isConnected: entity.status === ProviderStatus.CONNECTED,
    // 新的状态映射逻辑：配置状态映射为configStatus
    configStatus: ((): ProviderWithStatus['configStatus'] => {
      switch (entity.status) {
        case ProviderStatus.NO_KEY:
          return 'NO_KEY';
        default:
          return undefined;
      }
    })(),
    displayStatus: ((): ProviderWithStatus['displayStatus'] => {
      switch (entity.status) {
        case ProviderStatus.CONNECTED:
          return 'CONNECTED';
        case ProviderStatus.NOT_CONNECTED:
          return 'NOT_CONNECTED';
        // NO_KEY 现在映射为 configStatus，不在这里处理
        // CONNECTING 永远不应该从持久化数据中读取，如果发现则当作UNKNOWN处理
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
          case 'TIMEOUT': return '检查超时，请稍后重试';
          case 'UNKNOWN': return (entity as any).lastMessage || '检查失败';
          default: return (entity as any).lastMessage || '检查失败';
        }
      }
      return null;
    })(),
    healthCheckPath: undefined,
    authenticatedHealthCheckPath: undefined,
    // 映射 preferences 字段
    preferences: entity.preferences,
  } as ProviderWithStatus;
}