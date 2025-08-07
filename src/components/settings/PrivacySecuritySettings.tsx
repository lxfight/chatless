"use client";

import { PrivacySettings } from "./PrivacySettings";
import { SecuritySettings } from "./SecuritySettings";
import { SettingsDivider } from "./SettingsDivider";

export function PrivacySecuritySettings() {
  return (
    <div className="space-y-6">
         {/* 页面标题 */}
         <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200 text-left">隐私与安全</h1>
      <PrivacySettings />
      <SettingsDivider />
      <SecuritySettings />
    </div>
  );
} 