export interface StaticModelDef { id: string; label?: string }

export const STATIC_PROVIDER_MODELS: Record<string, StaticModelDef[]> = {
  "DeepSeek": [
    { id: "deepseek-chat", label: "DeepSeek Chat" },
    { id: "deepseek-reasoner", label: "DeepSeek R1" }
  ],
  "Google AI": [
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" }
  ],
  "Anthropic": [
    { id: "claude-3-opus-20240229", label: "Claude 3 Opus" },
    { id: "claude-3-sonnet-20240229", label: "Claude 3 Sonnet" },
    { id: "claude-3-haiku-20240307", label: "Claude 3 Haiku" }
  ],
  "OpenAI": [
    { id: "gpt-4o", label: "GPT-4o" },
    { id: "gpt-4o-mini", label: "GPT-4o Mini" },
    { id: "gpt-4-turbo", label: "GPT-4 Turbo" },
    { id: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" }
  ]
}; 