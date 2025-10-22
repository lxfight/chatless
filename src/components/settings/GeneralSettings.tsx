"use client";

import { useState, useEffect } from "react";
import { SelectField } from "./SelectField";
import { SlidersHorizontal } from "lucide-react";
import StorageUtil from "@/lib/storage";
import { useMarkdownFontSize } from "@/hooks/useMarkdownFontSize";
import { useGlobalFontSize } from "@/hooks/useGlobalFontSize";
// Markdown主题系统已禁用
// import { useMarkdownTheme, MARKDOWN_THEMES } from "@/hooks/useMarkdownTheme";
import { PersonalizationSettings } from "./PersonalizationSettings";
import { useUiPreferences } from '@/store/uiPreferences';
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
  // Markdown主题系统已禁用
  // const { theme: markdownTheme, setTheme: setMarkdownTheme } = useMarkdownTheme();
  const ui = useUiPreferences();

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
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">常规设置</h2>
        <div className="rounded-xl border border-slate-200/70 bg-gradient-to-br from-slate-50/50 to-blue-50/30 dark:from-slate-800/30 dark:to-blue-900/10 p-4 dark:border-slate-700/60 shadow-sm">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            在此设置常规选项，包括界面语言、主题模式、字体大小等。
          </p>
        </div>
        </div>

             {/* 主要设置卡片 */}
       <div className="border border-slate-200/70 dark:border-slate-700/60 rounded-xl p-6 space-y-6 bg-white/70 dark:bg-slate-900/40 shadow-sm backdrop-blur-sm">
         {/* 头部 */}
         <div className="flex items-center gap-3 pb-4 border-b border-slate-100/80 dark:border-slate-800/60">
           {/* 主图标使用品牌色以提升层级 */}
           <SlidersHorizontal className="w-5 h-5 text-blue-600 dark:text-blue-400" />
           <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">常用选项</h3>
         </div>

                 {/* 设置内容 */}
         <div className="space-y-6">
                 <SelectField
           label="界面语言"
           options={[
             { value: "zh", label: "简体中文" },
             { value: "en", label: "English" },
           ]}
           value={lang}
           onChange={setLang}
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
         />

        {/* 聊天显示 */}
        <div className="pt-4 border-t border-slate-100/80 dark:border-slate-800/60">
          <div className=" text-xs font-medium text-slate-500 dark:text-slate-400 mb-3">聊天显示</div>

           <div className="space-y-6">
           <ToggleSwitch
           label="默认折叠聊天侧边栏"
           checked={ui.collapseChatSidebar}
           onChange={ui.setCollapseChatSidebar}
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
          />

          {/* Markdown主题选择已移除 - 使用Streamdown原生渲染 */}

          <SelectField
            label="逐字淡入强度"
            options={[
              { value: 'off', label: '关闭' },
              { value: 'light', label: '轻' },
              { value: 'normal', label: '中（默认）' },
              { value: 'strong', label: '重' },
            ]}
            value={ui.charFadeIntensity as any}
            onChange={(v) => ui.setCharFadeIntensity(v as any)}
          />
           </div>
         
        </div>

        {/* 界面显示 */}
        <div className="pt-4 border-t border-slate-100/80 dark:border-slate-800/60">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3">界面显示</div>
          <SelectField
            label="界面文本大小"
            options={[
              { value: "small", label: "小" },
              { value: "medium", label: "中" },
              { value: "large", label: "大" },
            ]}
            value={globalFontSize}
            onChange={(v) => setGlobalFontSize(v as any)}
          />
        </div>

                 {/* 应用行为设置 */}
         {(() => {
           const ui = useUiPreferences();
           return (
             <>
               <div className="pt-4 border-t border-gray-50 dark:border-gray-800">
                 <div className="space-y-6">
                   <ToggleSwitch
                     label="关闭时显示确认对话框"
                     checked={ui.showCloseConfirmation}
                     onChange={(v) => ui.setShowCloseConfirmation(v)}
                   />

                   <ToggleSwitch
                     label="启用快捷指令面板"
                     checked={ui.cmdPaletteEnabled}
                     onChange={(v) => ui.setCmdPaletteEnabled(v)}
                     tooltip="启用后可以使用快捷键快速搜索和执行各种操作"
                   />

                   {ui.cmdPaletteEnabled && (
                     <ShortcutField
                       label="快捷键映射"
                       value={ui.cmdPaletteShortcut}
                       onChange={ui.setCmdPaletteShortcut}
                       tooltip="点击输入框后按下组合键设置，需包含 Ctrl/⌘/Alt/Shift 等修饰键"
                     />
                   )}
                 </div>
               </div>
             </>
           );
         })()}

              </div>
      </div>

      {/* 个性化设置 */}
      <PersonalizationSettings />
    </div>
  );
} 