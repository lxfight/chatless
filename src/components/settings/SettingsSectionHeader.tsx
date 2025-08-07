"use client";

import { useUiPreferences } from "@/store/uiPreferences";

interface SettingsSectionHeaderProps {
  icon?: React.ElementType;
  title: string;
  iconBgColor?: string; // Optional background color class like 'bg-blue-500'
  showIcon?: boolean; // 局部控制，可覆盖全局
}

export function SettingsSectionHeader({
  icon: Icon,
  title,
  iconBgColor = "bg-gray-200 dark:bg-gray-700",
  showIcon = true,
}: SettingsSectionHeaderProps) {
  const { showSettingIcons } = useUiPreferences();

  const shouldShowIcon = showSettingIcons && showIcon && Icon;

  // 若传入渐变，则转换为灰色背景
  const bgClass =
    iconBgColor.includes("from-") || iconBgColor.includes("to-")
      ? "bg-gray-200 dark:bg-gray-700"
      : iconBgColor;

  return (
    <div
      className="flex items-center gap-3 mb-6 px-1 pt-6"
      data-setting-section
      data-setting-title={title}
      id={`setting-${title.replace(/\s+/g, '-').toLowerCase()}`}
    >
      {shouldShowIcon && (
        <div
          className={`w-8 h-8 rounded-md ${bgClass} flex items-center justify-center shadow-sm bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800`}
        >
          <Icon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
        </div>
      )}
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
        {title}
      </h2>
    </div>
  );
} 