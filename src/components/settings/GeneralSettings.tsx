"use client";

import { useState, useEffect } from "react";
import { SettingsCard } from "./SettingsCard";
import { SettingsSectionHeader } from "./SettingsSectionHeader";
import { SelectField } from "./SelectField";
import { SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import StorageUtil from "@/lib/storage";
import { useMarkdownFontSize } from "@/hooks/useMarkdownFontSize";
import { useGlobalFontSize } from "@/hooks/useGlobalFontSize";
import { PersonalizationSettings } from "./PersonalizationSettings";
import { useUiPreferences } from '@/store/uiPreferences';
import { InputField } from './InputField';
import { ToggleSwitch } from './ToggleSwitch';
import { ShortcutField } from './ShortcutField';
import { ThemeInitializer } from "@/lib/utils/themeInitializer";

// 主题设置键名
const THEME_KEY = "app_theme"; // system / light / dark
const LANG_KEY = "app_lang"; // zh / en

export function GeneralSettings() {
  const [theme, setTheme] = useState<string>("system");
  const [lang, setLang] = useState<string>("zh");
  const [initialized, setInitialized] = useState(false);
  const { size: chatFontSize, setSize: setChatFontSize } = useMarkdownFontSize();
  const { size: globalFontSize, setSize: setGlobalFontSize } = useGlobalFontSize();

  // 加载初始设置
  useEffect(() => {
    const loadSettings = async () => {
      const savedTheme = await StorageUtil.getItem<string>(THEME_KEY, "system");
      const savedLang = await StorageUtil.getItem<string>(LANG_KEY, "zh");
      setTheme(savedTheme || "system");
      setLang(savedLang || "zh");
      setInitialized(true);
    };
    loadSettings();
  }, []);

  // 应用主题 & 保存
  useEffect(() => {
    // 未加载完成不处理，避免默认值导致闪烁
    if (!initialized || typeof document === "undefined") return;
    
    // 使用主题初始化服务同步主题设置
    ThemeInitializer.syncThemeToStorage(theme);
    
    // 立即应用主题设置
    ThemeInitializer.applyTheme(theme);
  }, [theme, initialized]);

  // 保存语言
  useEffect(() => {
    if (typeof window === "undefined") return;
    StorageUtil.setItem(LANG_KEY, lang);
    //toast.info("语言已切换（仅演示，需刷新后生效）");
  }, [lang]);

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      {/* <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200 text-left">常规设置</h1> */}

    <SettingsCard>
      <SettingsSectionHeader icon={SlidersHorizontal} title="常规设置" />
      <div className="space-y-6 pt-6 px-6 pb-6">
        <SelectField
          label="界面语言"
          options={[
            { value: "zh", label: "简体中文" },
            { value: "en", label: "English" },
          ]}
          value={lang}
          onChange={setLang}
          description="选择应用显示语言（需刷新后完全生效）"
        />

        <SelectField
          label="主题模式"
          options={[
            { value: "system", label: "跟随系统" },
            { value: "light", label: "亮色" },
            { value: "dark", label: "暗色" },
          ]}
          value={theme}
          onChange={setTheme}
          description="立即生效，可在亮/暗色之间切换或自动跟随系统。"
        />

        <SelectField
          label="聊天内容字体大小"
          options={[
            { value: "small", label: "小" },
            { value: "medium", label: "中" },
            { value: "large", label: "大" },
          ]}
          value={chatFontSize}
          onChange={(v) => setChatFontSize(v as any)}
          description="调整聊天窗口中 Markdown 文本的大小，立即生效"
        />

        <SelectField
          label="界面文本大小"
          options={[
            { value: "small", label: "小" },
            { value: "medium", label: "中" },
            { value: "large", label: "大" },
          ]}
          value={globalFontSize}
          onChange={(v) => setGlobalFontSize(v as any)}
          description="控制整个界面的基础文字大小，立即生效"
        />

        {/* 应用行为设置 */}
        {(() => {
          const ui = useUiPreferences();
          return (
            <>
              <ToggleSwitch
                label="关闭时显示确认对话框"
                description="关闭应用时显示确认对话框，防止意外关闭"
                checked={ui.showCloseConfirmation}
                onChange={(v) => ui.setShowCloseConfirmation(v)}
              />

              <ToggleSwitch
                label="启用快捷指令面板"
                description="使用Alt+O / 自定义快捷键呼出指令搜索窗口，快速导航和执行操作"
                checked={ui.cmdPaletteEnabled}
                onChange={(v) => ui.setCmdPaletteEnabled(v)}
              />

              {ui.cmdPaletteEnabled && (
                <>
                  <ShortcutField
                    label="快捷键映射"
                    value={ui.cmdPaletteShortcut}
                    onChange={ui.setCmdPaletteShortcut}
                    description="按下组合键以设置；需包含 Ctrl/⌘/Alt/Shift 且避免常用系统快捷键"
                  />
                
                </>
              )}
            </>
          );
        })()}

      </div>

      {/* 个性化设置 */}
      <PersonalizationSettings />
    </SettingsCard>
    </div>
  );
} 