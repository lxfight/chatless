export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  id?: string;
  images?: string[]; // base64 Data URLs
  error?: boolean; // Added for UI error display
}

import type { StreamEvent } from './types/stream-events';

export interface StreamCallbacks {
  /**
   * 结构化事件回调（推荐）
   */
  onEvent?: (event: StreamEvent) => void;
  onStart?: () => void;
  /**
   * 文本token回调（向后兼容）
   */
  onToken?: (token: string) => void;
  onImage?: (image: { mimeType: string; data: string }) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export interface ChatOptions {
  temperature?: number;
  apiKey?: string;
  baseUrl?: string; // Optional override for provider base URL
  [key: string]: any; // Allow additional provider-specific options
}

