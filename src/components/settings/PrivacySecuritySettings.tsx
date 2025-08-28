"use client";

import { PrivacySettings } from "./PrivacySettings";
import { SecuritySettings } from "./SecuritySettings";
import { SettingsDivider } from "./SettingsDivider";

export function PrivacySecuritySettings() {
  return (
    <div className="space-y-6">
         <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">隐私安全设置</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">在此设置隐私安全相关选项，包括聊天记录导出、数据备份等。</p>
      </div>  
      <PrivacySettings />
      <SettingsDivider />
      <SecuritySettings />
    </div>
  );
} 