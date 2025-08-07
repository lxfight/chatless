"use client";

import { create } from "zustand";
import StorageUtil from "@/lib/storage";

const SHOW_SETTING_ICONS_KEY = "ui_show_setting_icons";
const SIMPLE_MODE_KEY = "ui_simple_mode";
const LOW_ANIMATION_KEY = "ui_low_animation";
const SIDEBAR_WIDTH_KEY = "ui_sidebar_width"; // 'narrow' | 'medium' | 'wide'
const COLLAPSE_CHAT_SIDEBAR_KEY = "ui_collapse_chat_sidebar";
const TIMEZONE_KEY = "ui_timezone"; // e.g. 'local', 'UTC', 'UTC+8', 'America/New_York'

type SidebarWidth = 'narrow' | 'medium' | 'wide' | 'xwide';
type IconSize = 'small' | 'medium' | 'large';

interface UiPreferencesState {
  // 基础
  initialized: boolean;

  // 视觉
  showSettingIcons: boolean;
  simpleMode: boolean;
  lowAnimationMode: boolean;

  // 布局
  sidebarWidth: SidebarWidth;
  collapseChatSidebar: boolean;

  sidebarIconSize: IconSize;

  // 时间
  timezone: string; // 使用 IANA 或简写

  // 快捷指令面板
  cmdPaletteEnabled: boolean;
  cmdPaletteShortcut: string;

  // setter
  setShowSettingIcons: (show: boolean) => void;
  setSimpleMode: (flag: boolean) => void;
  setLowAnimationMode: (flag: boolean) => void;
  setSidebarWidth: (w: SidebarWidth) => void;
  setSidebarIconSize: (s: IconSize) => void;
  setCollapseChatSidebar: (flag: boolean) => void;
  setTimezone: (tz: string) => void;
  setCmdPaletteEnabled: (flag: boolean) => void;
  setCmdPaletteShortcut: (sc: string) => void;
}

export const useUiPreferences = create<UiPreferencesState>((set) => ({
  initialized: false,

  showSettingIcons: true,
  simpleMode: true,
  lowAnimationMode: false,

  sidebarWidth: 'narrow',
  collapseChatSidebar: true,

  sidebarIconSize: 'small',

  timezone: 'local',

  cmdPaletteEnabled: true,
  cmdPaletteShortcut: 'alt+o',

  setShowSettingIcons: (show) => {
    set({ showSettingIcons: show });
    StorageUtil.setItem<boolean>(SHOW_SETTING_ICONS_KEY, show, 'user-preferences.json');
  },

  setSimpleMode: (flag) => {
    set({ simpleMode: flag });
    StorageUtil.setItem<boolean>(SIMPLE_MODE_KEY, flag, 'user-preferences.json');
  },

  setLowAnimationMode: (flag) => {
    set({ lowAnimationMode: flag });
    StorageUtil.setItem<boolean>(LOW_ANIMATION_KEY, flag, 'user-preferences.json');
  },

  setSidebarWidth: (w) => {
    set({ sidebarWidth: w });
    StorageUtil.setItem<SidebarWidth>(SIDEBAR_WIDTH_KEY, w, 'user-preferences.json');
  },

  setSidebarIconSize: (s) => {
    set({ sidebarIconSize: s });
    StorageUtil.setItem<IconSize>('ui_sidebar_icon_size', s, 'user-preferences.json');
  },

  setCollapseChatSidebar: (flag) => {
    set({ collapseChatSidebar: flag });
    StorageUtil.setItem<boolean>(COLLAPSE_CHAT_SIDEBAR_KEY, flag, 'user-preferences.json');
  },

  setTimezone: (tz) => {
    set({ timezone: tz });
    StorageUtil.setItem<string>(TIMEZONE_KEY, tz, 'user-preferences.json');
  },

  setCmdPaletteEnabled: (flag) => {
    set({ cmdPaletteEnabled: flag });
    StorageUtil.setItem<boolean>('ui_cmd_palette_enabled', flag, 'user-preferences.json');
  },

  setCmdPaletteShortcut: (sc) => {
    set({ cmdPaletteShortcut: sc });
    StorageUtil.setItem<string>('ui_cmd_palette_shortcut', sc, 'user-preferences.json');
  },
}));

// 异步初始化首选项
(async () => {
  const [showIcon, simple, lowAnim, width, collapse, tz, iconSize, cpEnabled, cpShortcut] = await Promise.all([
    StorageUtil.getItem<boolean>(SHOW_SETTING_ICONS_KEY, true, 'user-preferences.json'),
    StorageUtil.getItem<boolean>(SIMPLE_MODE_KEY, true, 'user-preferences.json'),
    StorageUtil.getItem<boolean>(LOW_ANIMATION_KEY, false, 'user-preferences.json'),
    StorageUtil.getItem<SidebarWidth>(SIDEBAR_WIDTH_KEY, 'narrow', 'user-preferences.json'),
    StorageUtil.getItem<boolean>(COLLAPSE_CHAT_SIDEBAR_KEY, true, 'user-preferences.json'),
    StorageUtil.getItem<string>(TIMEZONE_KEY, 'local', 'user-preferences.json'),
    StorageUtil.getItem<IconSize>('ui_sidebar_icon_size', 'small', 'user-preferences.json'),
    StorageUtil.getItem<boolean>('ui_cmd_palette_enabled', true, 'user-preferences.json'),
    StorageUtil.getItem<string>('ui_cmd_palette_shortcut', 'alt+o', 'user-preferences.json'),
  ]);

  useUiPreferences.setState({
    showSettingIcons: showIcon ?? true,
    simpleMode: simple ?? false,
    lowAnimationMode: lowAnim ?? false,
    sidebarWidth: (width as SidebarWidth) ?? 'medium',
    collapseChatSidebar: collapse ?? false,
    sidebarIconSize: (iconSize as IconSize) ?? 'small',
    timezone: tz || 'local',
    cmdPaletteEnabled: cpEnabled ?? true,
    cmdPaletteShortcut: cpShortcut || 'alt+o',
    initialized: true,
  });
})(); 