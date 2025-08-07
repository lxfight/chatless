"use client";

import { SettingsCard } from "./SettingsCard";
import { SettingsSectionHeader } from "./SettingsSectionHeader";
import { ShieldCheck } from 'lucide-react';

export function SecuritySettings() {
  return (
    <SettingsCard>
      <SettingsSectionHeader icon={ShieldCheck} title="安全设置" iconBgColor="from-amber-500 to-yellow-500" />
      <p className="text-gray-500 dark:text-gray-400">安全设置内容将在后续实现。</p>
    </SettingsCard>
  );
} 