"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { 
  Globe, AlertTriangle, Loader2
} from "lucide-react";
import type { ProviderWithStatus } from "@/hooks/useProviderManagement";

interface AdvancedSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: ProviderWithStatus;
  onPreferenceChange?: (providerName: string, preferences: { useBrowserRequest?: boolean }) => Promise<void>;
}

export function AdvancedSettingsDialog({
  open,
  onOpenChange,
  provider,
  onPreferenceChange,
}: AdvancedSettingsDialogProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [browserMode, setBrowserMode] = useState<boolean>(provider.preferences?.useBrowserRequest ?? false);

  React.useEffect(() => {
    if (open) {
      setBrowserMode(provider.preferences?.useBrowserRequest ?? false);
    }
  }, [open, provider.preferences?.useBrowserRequest]);

  const handleBrowserRequestToggle = async (checked: boolean) => {
    if (!onPreferenceChange || isUpdating) return;

    setIsUpdating(true);
    try {
      const repoName = provider.aliases?.[0] || provider.name;
      setBrowserMode(checked); // 先本地回显
      await onPreferenceChange(repoName, { useBrowserRequest: checked });
      // 不再在此处触发“立即检查”，避免弹窗被打断或列表刷新
      // 该偏好仅在发起网络请求时读取生效
    } catch (error) {
      console.error('Failed to update preference:', error);
      // 回滚本地显示
      setBrowserMode((prev)=>!prev);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-600" />
            {provider.name} - 高级设置
          </DialogTitle>
          <DialogDescription>
            配置网络请求方式和其他高级选项
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 浏览器请求模式设置 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium">浏览器请求模式</h3>
                  {isUpdating && (
                    <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  默认请求方式已适合大多数情况，如遇网络问题可尝试此模式
                </p>
              </div>
              <Switch
                checked={browserMode}
                onCheckedChange={handleBrowserRequestToggle}
                disabled={isUpdating}
                size="md"
              />
            </div>

            {/* 跨域警告 - 仅在启用时显示 */}
            {provider.preferences?.useBrowserRequest && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-amber-700 dark:text-amber-300">
                    <div className="font-medium mb-1">注意事项：</div>
                    <ul className="space-y-0.5 text-amber-600 dark:text-amber-400">
                      <li>• 不支持跨域受限的API接口</li>
                      <li>• 某些代理设置可能不生效</li>
                      <li>• 建议仅在网络异常时启用</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 预留其他高级设置的位置 */}
          {/* <div className="border-t pt-4">
            <div className="text-xs text-gray-400 text-center">
              更多高级设置功能正在开发中
            </div>
          </div> */}
        </div>
      </DialogContent>
    </Dialog>
  );
}
