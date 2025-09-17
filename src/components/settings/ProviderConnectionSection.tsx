"use client";
import React, { useState } from "react";
import { InputField } from "./InputField";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  MoreVertical, Undo2, KeyRound, ExternalLink, Settings, 
  Sliders
} from "lucide-react";
import type { ProviderWithStatus } from "@/hooks/useProviderManagement";
import { toast } from "@/components/ui/sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { AdvancedSettingsDialog } from "@/components/settings/AdvancedSettingsDialog";

interface ProviderConnectionSectionProps {
  provider: ProviderWithStatus;
  localUrl: string;
  setLocalUrl: (v: string) => void;
  onUrlChange: (providerName: string, url: string) => void;
  onResetUrl: () => void;
  showApiKeyFields: boolean;
  localDefaultApiKey: string;
  setLocalDefaultApiKey: (v: string) => void;
  docUrl?: string;
  onDefaultApiKeyChange: (providerName: string, apiKey: string) => void;
  onDefaultApiKeyBlur: (providerName: string) => void;
  endpointPreview?: string; // 新增：展示实际请求地址示例
  // 新增：高级设置相关
  onPreferenceChange?: (providerName: string, preferences: { useBrowserRequest?: boolean }) => Promise<void>;
  /** 是否显示行内的三点菜单（默认显示）。外部已提供总菜单时可关闭 */
  showInlineMenu?: boolean;
}

export function ProviderConnectionSection(props: ProviderConnectionSectionProps) {
  const {
    provider,
    localUrl,
    setLocalUrl,
    onUrlChange,
    onResetUrl,
    showApiKeyFields,
    localDefaultApiKey,
    setLocalDefaultApiKey,
    docUrl,
    onDefaultApiKeyChange,
    onDefaultApiKeyBlur,
    endpointPreview,
    onPreferenceChange,
  } = props;

  const [showAdvancedDialog, setShowAdvancedDialog] = useState(false);

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
          {props.showInlineMenu !== false && (
          <TooltipProvider>
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={`relative p-2 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:focus:ring-offset-gray-800 transition-all duration-200 ${
                        provider.preferences?.useBrowserRequest ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : ''
                      }`}
                    >
                      <MoreVertical className="w-4 h-4" />
                      {provider.preferences?.useBrowserRequest && (
                        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border border-white dark:border-gray-800"></div>
                      )}
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  高级设置
                  {provider.preferences?.useBrowserRequest && <div className="text-blue-400">（已启用浏览器模式）</div>}
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-60">
                {/* 标题 */}
                <DropdownMenuLabel className="flex items-center gap-2 text-sm font-semibold">
                  <Settings className="w-4 h-4 text-blue-600" />
                  提供商设置
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                {/* 重置地址 */}
                <DropdownMenuItem 
                  onClick={onResetUrl} 
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-md"
                >
                  <div className="flex items-center justify-center w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-md">
                    <Undo2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">重置服务地址</span>
                    <span className="text-xs text-gray-500">恢复为默认配置</span>
                  </div>
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                
                {/* 高级选项 */}
                <DropdownMenuItem 
                  onClick={() => setShowAdvancedDialog(true)} 
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md"
                >
                  <div className="flex items-center justify-center w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-md">
                    <Sliders className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">高级选项</span>
                      {provider.preferences?.useBrowserRequest && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">网络请求方式等高级设置</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TooltipProvider>
          )}
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

      {/* 高级设置弹窗 */}
      <AdvancedSettingsDialog
        open={showAdvancedDialog}
        onOpenChange={setShowAdvancedDialog}
        provider={provider}
        onPreferenceChange={onPreferenceChange}
      />
    </div>
  );
}

