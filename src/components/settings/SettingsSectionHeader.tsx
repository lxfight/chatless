"use client";

import { useUiPreferences } from "@/store/uiPreferences";
import { SectionIcon } from "./SectionIcon";

interface SettingsSectionHeaderProps {
  icon?: React.ElementType;
  title: string;
  iconBgColor?: string; // Optional background color class like 'bg-blue-500'
  showIcon?: boolean; // 局部控制，可覆盖全局
}

export function SettingsSectionHeader({
  icon: Icon,
  title,
  // 默认使用品牌色的淡色背景，而不是灰色，提升视觉层级
  iconBgColor = "bg-brand-100 dark:bg-brand-900",
  showIcon = true,
}: SettingsSectionHeaderProps) {
  const { showSettingIcons, settingsIconPreset } = useUiPreferences();

  const shouldShowIcon = showSettingIcons && showIcon && Icon;

  const bgClass = iconBgColor;

  return (
    <div
      className="flex items-center gap-3 mb-6 px-1 pt-2"
      data-setting-section
      data-setting-title={title}
      id={`setting-${title.replace(/\s+/g, '-').toLowerCase()}`}
    >
      {shouldShowIcon && Icon && (
        iconBgColor ? (
          <div className={`w-8 h-8 rounded-md ${bgClass} flex items-center justify-center shadow-sm`}>
            <Icon className="w-4 h-4 text-gray-700 dark:text-gray-200" />
          </div>
        ) : (
          <SectionIcon icon={Icon} preset={settingsIconPreset} />
        )
      )}
      <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">
        {title}
      </h2>
    </div>
  );
} 