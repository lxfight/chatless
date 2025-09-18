"use client";

import { Palette } from 'lucide-react';
import { ToggleSwitch } from "./ToggleSwitch";
import { SelectField } from "./SelectField";
import { useUiPreferences } from "@/store/uiPreferences";
import type { SectionIconPreset } from "./SectionIcon";

export function PersonalizationSettings() {
  const ui = useUiPreferences();

  return (
    <div className="border border-gray-100 rounded-2xl p-6 space-y-6 bg-white dark:bg-gray-900/50 shadow-sm">
      {/* 头部 */}
      <div className="flex items-center gap-3 pb-4 border-b border-gray-50 dark:border-gray-800">
        <Palette className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">外观与体验</h3>
      </div>

             {/* 设置内容 */}
       <div className="space-y-6">
         <ToggleSwitch
           label="简洁模式"
           checked={ui.simpleMode}
           onChange={ui.setSimpleMode}
           tooltip="弱化颜色、阴影和装饰元素，提供更简洁的界面"
         />

         <ToggleSwitch
           label="低动画模式"
           checked={ui.lowAnimationMode}
           onChange={ui.setLowAnimationMode}
           tooltip="减少过渡动画和淡入淡出效果，适合性能较弱的设备"
         />

         <ToggleSwitch
           label="显示设置页图标"
           checked={ui.showSettingIcons}
           onChange={ui.setShowSettingIcons}
         />

         <SelectField
           label="主侧边栏宽度"
           options={[
             { value: 'narrow', label: '窄' },
             { value: 'medium', label: '中' },
             { value: 'wide', label: '宽' },
             { value: 'xwide', label: '超宽' },
           ]}
           value={ui.sidebarWidth}
           onChange={(v) => ui.setSidebarWidth(v as any)}
         />

         <SelectField
           label="侧边栏图标大小"
           options={[
             { value: 'small', label: '小' },
             { value: 'medium', label: '中' },
             { value: 'large', label: '大' },
           ]}
           value={ui.sidebarIconSize}
           onChange={(v) => ui.setSidebarIconSize(v as any)}
         />

         <ToggleSwitch
           label="默认折叠聊天侧边栏"
           checked={ui.collapseChatSidebar}
           onChange={ui.setCollapseChatSidebar}
         />

         <SelectField
           label="显示时间时区"
           options={[
             { value: 'local', label: '本地时区' },
             { value: 'UTC', label: 'UTC' },
             { value: 'UTC+8', label: 'UTC+8' },
             { value: 'America/New_York', label: '纽约 (UTC-4/5)' },
             { value: 'Europe/London', label: '伦敦 (UTC+0)' },
             { value: 'Asia/Tokyo', label: '东京 (UTC+9)' },
           ]}
           value={ui.timezone}
           onChange={ui.setTimezone}
         />

         <SelectField
           label="聊天滚屏速度"
           options={[
             { value: 'calm', label: '平缓' },
             { value: 'normal', label: '适中' },
             { value: 'fast', label: '快速' },
           ]}
           value={ui.chatScrollSpeed as any}
           onChange={(v) => ui.setChatScrollSpeed(v as any)}
         />

        <SelectField
          label="设置页图标样式"
          options={[
            { value: 'brand', label: '品牌渐变' },
            { value: 'teal', label: '绿色渐变' },
            { value: 'indigo', label: '靛蓝渐变' },
            { value: 'gray', label: '中性灰底' },
            { value: 'glass', label: '玻璃质感' },
            { value: 'outline', label: '细边框' },
          ]}
          value={ui.settingsIconPreset as SectionIconPreset}
          onChange={(v) => ui.setSettingsIconPreset(v as SectionIconPreset)}
        />
       </div>
    </div>
  );
} 