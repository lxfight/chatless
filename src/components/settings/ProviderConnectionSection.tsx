"use client";
import React from "react";
import { InputField } from "./InputField";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Undo2, KeyRound, ExternalLink } from "lucide-react";
import type { ProviderWithStatus } from "@/hooks/useProviderManagement";
import { toast } from "sonner";

interface ProviderConnectionSectionProps {
  provider: ProviderWithStatus;
  localUrl: string;
  setLocalUrl: (v: string) => void;
  onUrlChange: (providerName: string, url: string) => void;
  onUrlBlur: (providerName: string) => void;
  onResetUrl: () => void;
  showApiKeyFields: boolean;
  localDefaultApiKey: string;
  setLocalDefaultApiKey: (v: string) => void;
  docUrl?: string;
  onDefaultApiKeyChange: (providerName: string, apiKey: string) => void;
  onDefaultApiKeyBlur: (providerName: string) => void;
  endpointPreview?: string; // 新增：展示实际请求地址示例
}

export function ProviderConnectionSection(props: ProviderConnectionSectionProps) {
  const {
    provider,
    localUrl,
    setLocalUrl,
    onUrlChange,
    onUrlBlur,
    onResetUrl,
    showApiKeyFields,
    localDefaultApiKey,
    setLocalDefaultApiKey,
    docUrl,
    onDefaultApiKeyChange,
    onDefaultApiKeyBlur,
    endpointPreview,
  } = props;

  return (
    <div className="space-y-3">
      <div className="group mb-2 flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 w-28 mb-0">
          服务地址
        </label>
        <div className="flex-1 flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              value={localUrl}
              onChange={(e) => { setLocalUrl(e.target.value); }}
              onBlur={() => {
                const repoName = provider.aliases?.[0] || provider.name;
                onUrlChange(repoName, localUrl);
                // 取消失焦即刷新，刷新会在保存逻辑中按需触发
              }}
              placeholder={provider.name.toLowerCase()==='ollama' ? 'http://localhost:11434' : '服务地址 (http://...)'}
              className="w-full p-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary focus:border-transparent transition-all duration-200 hover:border-primary dark:hover:border-primary dark:text-gray-200 h-8 text-sm"
            />
            {endpointPreview && (
              <p className="mt-1 text-[12px] text-gray-400 dark:text-gray-500 select-text break-all">
                地址预览：{endpointPreview}
              </p>
            )}
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onResetUrl}
                  className="p-2 text-gray-500 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-1 dark:focus:ring-offset-gray-800 transition-all duration-200"
                  title="重置为默认地址"
                >
                  <Undo2 className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>重置为默认地址</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {showApiKeyFields && (
        <div className="flex items-center gap-2">
          <InputField
            label="默认 API Key"
            type="password"
            value={localDefaultApiKey}
            onChange={(e) => {
              setLocalDefaultApiKey(e.target.value);
            }}
            onBlur={() => {
              const repoName = provider.aliases?.[0] || provider.name;
              onDefaultApiKeyChange(repoName, localDefaultApiKey);
              onDefaultApiKeyBlur(repoName);
            }}
            placeholder="API Key"
            className="h-8 text-sm w-full"
            wrapperClassName="mb-0 flex-1"
            icon={<KeyRound className="w-4 h-4 text-gray-400" />}
            inline
            labelWidthClassName="w-28"
          />
          {docUrl && (
            <button
              type="button"
              onClick={async () => {
                try {
                  const { linkOpener } = await import("@/lib/utils/linkOpener");
                  const success = await linkOpener.openLink(docUrl);
                  if (!success) toast.error('无法打开链接，请稍后重试');
                } catch (error) {
                  console.error('打开链接失败:', error);
                  toast.error('打开链接失败');
                }
              }}
              className="h-8 w-8 flex items-center justify-center text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded focus:outline-none"
              title="前往秘钥管理"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

