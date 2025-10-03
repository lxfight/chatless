"use client";

import { PrivacySettings } from "./PrivacySettings";
import { SecuritySettings } from "./SecuritySettings";
import { SettingsDivider } from "./SettingsDivider";

export function PrivacySecuritySettings() {
  return (
    <div className="space-y-6">
         <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">隐私安全设置</h2>
        <div className="rounded-xl border border-slate-200/70 bg-gradient-to-br from-slate-50/50 to-blue-50/30 dark:from-slate-800/30 dark:to-blue-900/10 p-4 dark:border-slate-700/60 shadow-sm">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            在此管理隐私和安全相关设置，包括数据保护、访问控制等选项。
          </p>
        </div>
     </div>  
      <PrivacySettings />
      <SettingsDivider />
      <SecuritySettings />
    </div>
  );
} 