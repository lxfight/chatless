export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  id?: string;
  images?: string[]; // base64 Data URLs
  error?: boolean; // Added for UI error display
}

export interface StreamCallbacks {
  onStart?: () => void;
  onToken?: (token: string) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export interface ChatOptions {
  temperature?: number;
  apiKey?: string;
  baseUrl?: string; // Optional override for provider base URL
  [key: string]: any; // Allow additional provider-specific options
}

