// 自动生成文件，请勿手动修改。
// 由 scripts/generate-settings-index.cjs 根据 src/config/settingsIndex.json 生成。

export interface SettingEntry {
  id: string;
  tab: string;
  i18nKey: string;
  anchor: string;
  keywords?: string[];
}

export const settingsIndex: SettingEntry[] = [
  {
    "id": "theme-mode",
    "tab": "general",
    "i18nKey": "settings.themeMode",
    "anchor": "setting-主题模式",
    "keywords": [
      "主题",
      "mode",
      "dark",
      "light"
    ]
  },
  {
    "id": "interface-font",
    "tab": "general",
    "i18nKey": "settings.interfaceFontSize",
    "anchor": "setting-界面文本大小",
    "keywords": [
      "文字",
      "font"
    ]
  },
  {
    "id": "simple-mode",
    "tab": "general",
    "i18nKey": "settings.simpleMode",
    "anchor": "setting-外观与体验",
    "keywords": [
      "简洁"
    ]
  },
  {
    "id": "low-animation",
    "tab": "general",
    "i18nKey": "settings.lowAnimationMode",
    "anchor": "setting-外观与体验",
    "keywords": [
      "动画",
      "motion"
    ]
  },
  {
    "id": "clear-chat",
    "tab": "privacySecurity",
    "i18nKey": "settings.clearChats",
    "anchor": "setting-隐私设置",
    "keywords": [
      "删除",
      "聊天"
    ]
  }
] as const;
