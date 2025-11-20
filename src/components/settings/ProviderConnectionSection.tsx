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
    <div className="space-y-2.5">
       <div className="group flex items-center gap-2">
         <label className="text-xs font-medium text-slate-600 dark:text-slate-400 w-20 flex-shrink-0">
           服务地址
         </label>
         <div className="flex-1 flex items-center gap-1.5">
           <div className="flex-1 relative">
             <input
               value={localUrl}
               onChange={(e) => { setLocalUrl(e.target.value); }}
               onBlur={() => {
                 const repoName = provider.aliases?.[0] || provider.name;
                 onUrlChange(repoName, localUrl);
               }}
               placeholder={provider.name.toLowerCase()==='ollama' ? 'http://localhost:11434' : '服务地址'}
               className="w-full h-8 px-2.5 bg-white dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-400/50 transition-colors hover:border-slate-300 dark:hover:border-slate-600 dark:text-slate-200 text-xs placeholder:text-slate-400 dark:placeholder:text-slate-500"
             />
           </div>
           {/* 地址预览按钮 - Tooltip形式 */}
           {endpointPreview && (
             <TooltipProvider>
               <Tooltip>
                 <TooltipTrigger asChild>
                   <button
                     type="button"
                     className="h-7 w-7 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded transition-colors"
                     title="查看地址预览"
                   >
                     <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                       <path d="M12 5C7 5 2.73 8.11 1 12.5 2.73 16.89 7 20 12 20s9.27-3.11 11-7.5C21.27 8.11 17 5 12 5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="currentColor"/>
                     </svg>
                   </button>
                 </TooltipTrigger>
                 <TooltipContent side="bottom" align="end" className="max-w-md">
                   <p className="text-xs break-all">{endpointPreview}</p>
                 </TooltipContent>
               </Tooltip>
             </TooltipProvider>
           )}
           {props.showInlineMenu !== false && (
          <TooltipProvider>
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={`relative p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded focus:outline-none transition-colors ${
                        provider.preferences?.useBrowserRequest ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : ''
                      }`}
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                      {provider.preferences?.useBrowserRequest && (
                        <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full border border-white dark:border-slate-800"></div>
                      )}
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[10px]">
                  高级设置
                  {provider.preferences?.useBrowserRequest && <div className="text-blue-400">（已启用浏览器模式）</div>}
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex items-center gap-1.5 text-xs font-semibold">
                  <Settings className="w-3.5 h-3.5 text-blue-600" />
                  提供商设置
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                <DropdownMenuItem 
                  onClick={onResetUrl} 
                  className="flex items-center gap-2 px-2 py-2 text-xs"
                >
                  <div className="flex items-center justify-center w-7 h-7 bg-slate-100 dark:bg-slate-700 rounded">
                    <Undo2 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium">重置地址</span>
                    <span className="text-[10px] text-slate-500">恢复默认配置</span>
                  </div>
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem 
                  onClick={() => setShowAdvancedDialog(true)} 
                  className="flex items-center gap-2 px-2 py-2 text-xs"
                >
                  <div className="flex items-center justify-center w-7 h-7 bg-blue-100 dark:bg-blue-900/50 rounded">
                    <Sliders className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">高级选项</span>
                      {provider.preferences?.useBrowserRequest && (
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500">请求方式等</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TooltipProvider>
          )}
        </div>
      </div>

      {showApiKeyFields && (
        <div className="flex items-center gap-1.5">
          <InputField
            label="API密钥"
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
            placeholder="密钥"
            className="h-8 text-xs w-full"
            wrapperClassName="mb-0 flex-1"
            icon={<KeyRound className="w-3.5 h-3.5 text-slate-400" />}
            inline
            labelWidthClassName="w-20"
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
              className="h-7 w-7 flex items-center justify-center text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded transition-colors"
              title="前往密钥管理"
            >
              <ExternalLink className="w-3.5 h-3.5" />
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

