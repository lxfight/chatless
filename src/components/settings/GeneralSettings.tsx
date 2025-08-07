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
    toast.info("语言已切换（仅演示，需刷新后生效）");
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
                  
                  {/* 快捷键测试区域 */}
                  <div className="flex items-start gap-8 py-3 group hover:bg-gray-50/40 dark:hover:bg-gray-800/30 rounded-md transition-colors duration-200 -mx-3 px-3">
                    <div className="w-32 flex-shrink-0 pt-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 leading-relaxed">
                        测试快捷键（开发期间）
                      </label>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 p-3 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800">
                          <div className="flex items-center gap-2 mb-2">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              当前设置: <span className="font-mono text-blue-600 dark:text-blue-400">{ui.cmdPaletteShortcut}</span>
                            </p>
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-green-500"></div>
                              <span className="text-xs text-green-600 dark:text-green-400">正常</span>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500">
                            请尝试按下上述快捷键来测试是否正常工作
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            // 临时显示命令面板来测试
                            const event = new CustomEvent('test-command-palette');
                            window.dispatchEvent(event);
                          }}
                          className="px-3 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                        >
                          测试
                        </button>
                      </div>
                    </div>
                  </div>
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