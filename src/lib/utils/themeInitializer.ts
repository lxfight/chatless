import { StorageUtil } from '../storage';

const THEME_KEY = "app_theme"; // 与GeneralSettings中的键名保持一致

/**
 * 主题初始化服务
 * 在应用启动时立即读取和应用用户的主题偏好设置
 */
export class ThemeInitializer {
  private static initialized = false;

  /**
   * 初始化主题设置
   * 在应用启动时立即调用，避免主题闪烁
   */
  static async initializeTheme(): Promise<void> {
    if (this.initialized || typeof document === 'undefined') {
      return;
    }

    try {
      console.log('🎨 [ThemeInitializer] 开始初始化主题设置...');
      
      // 读取用户保存的主题设置
      const savedTheme = await StorageUtil.getItem<string>(THEME_KEY, "system");
      const theme = savedTheme || "system";
      
      console.log(`🎨 [ThemeInitializer] 用户主题偏好: ${theme}`);
      
      // 立即应用主题设置
      this.applyTheme(theme);
      
      this.initialized = true;
      console.log('✅ [ThemeInitializer] 主题初始化完成');
    } catch (error) {
      console.error('❌ [ThemeInitializer] 主题初始化失败:', error);
      // 即使失败也要应用默认主题，避免界面异常
      this.applyTheme("system");
    }
  }

  /**
   * 应用主题设置
   * @param theme 主题类型: "light" | "dark" | "system"
   */
  static applyTheme(theme: string): void {
    if (typeof document === 'undefined') {
      return;
    }

    const root = document.documentElement;
    
    // 移除现有的主题类
    root.classList.remove("dark", "light");
    
    // 根据主题设置应用对应的类
    if (theme === "dark") {
      root.classList.add("dark");
      console.log('🌙 [ThemeInitializer] 应用暗色主题');
    } else if (theme === "light") {
      root.classList.add("light");
      console.log('☀️ [ThemeInitializer] 应用亮色主题');
    } else {
      // system 主题：根据系统偏好自动切换
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        root.classList.add("dark");
        console.log('🌙 [ThemeInitializer] 应用系统暗色主题');
      } else {
        root.classList.add("light");
        console.log('☀️ [ThemeInitializer] 应用系统亮色主题');
      }
    }
  }

  /**
   * 监听系统主题变化（仅对system主题有效）
   */
  static setupSystemThemeListener(): void {
    if (typeof window === 'undefined') {
      return;
    }

    // 监听系统主题变化
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    
    const handleThemeChange = async () => {
      try {
        const savedTheme = await StorageUtil.getItem<string>(THEME_KEY, "system");
        if (savedTheme === "system") {
          this.applyTheme("system");
        }
      } catch (error) {
        console.error('❌ [ThemeInitializer] 系统主题变化处理失败:', error);
      }
    };

    // 添加监听器
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleThemeChange);
    } else {
      // 兼容旧版浏览器
      mediaQuery.addListener(handleThemeChange);
    }

    console.log('👂 [ThemeInitializer] 系统主题变化监听器已设置');
  }

  /**
   * 获取当前主题状态
   */
  static getCurrentTheme(): string {
    if (typeof document === 'undefined') {
      return "system";
    }

    const root = document.documentElement;
    if (root.classList.contains("dark")) {
      return "dark";
    } else if (root.classList.contains("light")) {
      return "light";
    } else {
      return "system";
    }
  }

  /**
   * 检查是否为暗色主题
   */
  static isDarkMode(): boolean {
    if (typeof document === 'undefined') {
      return false;
    }

    const root = document.documentElement;
    return root.classList.contains("dark");
  }

  /**
   * 同步主题设置到存储
   * @param theme 主题类型
   */
  static async syncThemeToStorage(theme: string): Promise<void> {
    try {
      await StorageUtil.setItem(THEME_KEY, theme);
      console.log(`💾 [ThemeInitializer] 主题设置已同步到存储: ${theme}`);
    } catch (error) {
      console.error('❌ [ThemeInitializer] 主题设置同步失败:', error);
    }
  }
}

/**
 * 快速主题初始化函数
 * 用于在应用启动时立即执行，避免主题闪烁
 */
export async function initializeThemeOnStartup(): Promise<void> {
  await ThemeInitializer.initializeTheme();
  ThemeInitializer.setupSystemThemeListener();
} 