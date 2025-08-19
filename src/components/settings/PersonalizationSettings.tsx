"use client";

import { SettingsSectionHeader } from "./SettingsSectionHeader";
import { Palette } from 'lucide-react';
import { ToggleSwitch } from "./ToggleSwitch";
import { SelectField } from "./SelectField";
import { useUiPreferences } from "@/store/uiPreferences";

export function PersonalizationSettings() {
  const ui = useUiPreferences();

  return (
    <div className="pt-8 mt-8 border-t border-gray-200 dark:border-gray-700">
      <SettingsSectionHeader icon={Palette} title="外观与体验" />
      <div className="space-y-6 pt-6 px-6 pb-6">
        {/* 简洁模式 */}
        <ToggleSwitch
          label="简洁模式"
          description="弱化颜色、阴影和装饰元素"
          checked={ui.simpleMode}
          onChange={ui.setSimpleMode}
        />

        {/* 低动画模式 */}
        <ToggleSwitch
          label="低动画模式"
          description="减少过渡、淡入淡出等界面动画"
          checked={ui.lowAnimationMode}
          onChange={ui.setLowAnimationMode}
        />

        {/* 设置页图标开关 */}
        <ToggleSwitch
          label="显示设置页图标"
          description="控制设置卡片标题左侧小图标的显示"
          checked={ui.showSettingIcons}
          onChange={ui.setShowSettingIcons}
        />

        {/* 侧边栏宽度 */}
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

        {/* 侧边栏图标大小 */}
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

        {/* 聊天会话列表默认折叠 */}
        <ToggleSwitch
          label="默认折叠聊天侧边栏"
          description="进入聊天页时隐藏会话列表，可通过按钮展开"
          checked={ui.collapseChatSidebar}
          onChange={ui.setCollapseChatSidebar}
        />

        {/* 时区选择 */}
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

        {/* 滚屏速度 */}
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
      </div>
    </div>
  );
} 