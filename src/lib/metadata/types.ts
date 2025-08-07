export interface ModelMetadata {
  name: string;
  aliases: string[];
  /** 面向用户展示的名称；如果缺失则回退 name */
  label?: string;
  api_key?: string | null;
}

export interface ProviderMetadata {
  name: string;
  api_base_url: string;
  requiresApiKey: boolean;
  aliases?: string[];
  icon?: string;
  default_api_key?: string | null;
  models: ModelMetadata[];
} 