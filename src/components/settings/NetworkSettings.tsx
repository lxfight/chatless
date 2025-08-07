"use client";

import { SettingsSectionHeader } from "./SettingsSectionHeader";
import { InputField } from "./InputField";
import { ToggleSwitch } from "./ToggleSwitch";
import { Network, Globe } from "lucide-react";
import { useNetworkPreferences } from '@/store/networkPreferences';

export function NetworkSettings() {
  const { proxyUrl, useSystemProxy, offline, setProxyUrl, setUseSystemProxy, setOffline } = useNetworkPreferences();

  return (
    <div className="pt-8 mt-8 border-t border-gray-200 dark:border-gray-700">
      <SettingsSectionHeader
        icon={Globe}
        title="网络设置"
        iconBgColor="from-green-500 to-teal-500"
      />
      <div className="flex flex-col gap-4">
        <InputField
          label="代理地址"
          value={proxyUrl}
          onChange={(e) => setProxyUrl(e.target.value)}
          placeholder="http://127.0.0.1:7890"
          description="如需使用自定义代理，请输入代理地址 (支持 http:// 或 socks5://)"
        />
        <ToggleSwitch
          label="使用系统代理"
          description="自动使用系统配置的代理服务器 (设置后将忽略自定义代理地址)"
          checked={useSystemProxy}
          onChange={setUseSystemProxy}
        />

        <ToggleSwitch
          label="离线模式"
          description="开启后，应用将阻止所有网络请求，仅可使用本地模型"
          checked={offline}
          onChange={setOffline}
        />
      </div>
    </div>
  );
} 