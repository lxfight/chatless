"use client";

import { PrivacySettings } from "./PrivacySettings";
import { SecuritySettings } from "./SecuritySettings";
import { SettingsDivider } from "./SettingsDivider";

export function PrivacySecuritySettings() {
  return (
    <div className="space-y-6">
         <div className="mb-8">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2 mb-2">隐私安全设置</h2>
        <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            在此添加/编辑隐私安全设置，并进行连接管理。聊天会话中可选择已连接知识库，AI 将按需调用工具/资源/提示。
          </p>
        </div>
     </div>  
      <PrivacySettings />
      <SettingsDivider />
      <SecuritySettings />
    </div>
  );
} 