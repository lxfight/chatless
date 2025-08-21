"use client";
import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type Strategy = 'openai' | 'openai-responses' | 'openai-compatible' | 'anthropic' | 'gemini' | 'deepseek';

const STRATEGY_OPTIONS: Array<{ value: Strategy; label: string }> = [
  { value: 'openai-compatible', label: 'OpenAI Compatible (/v1/chat/completions)' },
  { value: 'openai-responses', label: 'OpenAI Responses (/v1/responses)' },
  { value: 'openai', label: 'OpenAI Strict' },
  { value: 'anthropic', label: 'Anthropic (messages)' },
  { value: 'gemini', label: 'Google Gemini (generateContent)' },
  { value: 'deepseek', label: 'DeepSeek (chat/completions)' },
];

export function ProviderStrategySelector({
  providerName,
  value,
  onChange,
}: {
  providerName: string;
  value: Strategy;
  onChange: (v: Strategy) => void;
}) {
  return (
    <div className="mb-3">
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">默认请求策略</label>
      <div className="flex items-center gap-2">
        <Select
          value={value}
          onValueChange={async (val: Strategy) => {
            try {
              onChange(val);
              const { specializedStorage } = await import('@/lib/storage');
              await specializedStorage.models.setProviderDefaultStrategy(providerName, val as any);
              toast.success('已更新默认策略');
            } catch (e) {
              console.error(e);
              toast.error('更新默认策略失败');
            }
          }}
        >
          <SelectTrigger className="w-80 h-8 text-xs">
            <SelectValue placeholder="选择默认请求策略" />
          </SelectTrigger>
          <SelectContent>
            {STRATEGY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="mt-1 text-[10px] text-gray-400">对于 New API 等聚合服务，默认策略会应用到未单独指定策略的模型上。</p>
    </div>
  );
}

