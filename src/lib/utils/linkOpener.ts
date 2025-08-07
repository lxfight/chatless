import { detectTauriEnvironment } from './environment';

/**
 * 链接打开服务
 * 提供跨平台的链接打开功能，优先使用Tauri的opener插件，失败时回退到浏览器window.open
 */
export class LinkOpenerService {
  private static instance: LinkOpenerService;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): LinkOpenerService {
    if (!LinkOpenerService.instance) {
      LinkOpenerService.instance = new LinkOpenerService();
    }
    return LinkOpenerService.instance;
  }

  /**
   * 打开链接
   * @param url 要打开的URL
   * @param options 打开选项
   * @returns 是否成功打开
   */
  async openLink(
    url: string,
    options: {
      fallbackToBrowser?: boolean;
      showError?: boolean;
    } = {}
  ): Promise<boolean> {
    const { fallbackToBrowser = true, showError = true } = options;
    
    console.log('[LinkOpener] 开始打开链接:', url);
    
    try {
      // 检测是否在Tauri环境中
      const isTauri = await detectTauriEnvironment();
      console.log('[LinkOpener] 环境检测:', { isTauri });
      
      if (isTauri) {
        // 在Tauri环境中，使用opener插件
        console.log('[LinkOpener] 使用Tauri opener插件');
        return await this.openWithTauri(url);
      }
      
      // 在浏览器环境中，使用window.open
      console.log('[LinkOpener] 使用浏览器window.open');
      return this.openWithBrowser(url);
      
    } catch (error) {
      console.error('[LinkOpener] 打开链接失败:', error);
      
      // 如果失败且允许回退到浏览器
      if (fallbackToBrowser) {
        console.log('[LinkOpener] 回退到浏览器打开');
        return this.openWithBrowser(url);
      }
      
      if (showError) {
        console.error('[LinkOpener] 无法打开链接:', url);
      }
      
      return false;
    }
  }

  /**
   * 使用Tauri opener插件打开链接
   */
  private async openWithTauri(url: string): Promise<boolean> {
    try {
      console.log('[LinkOpener] 导入Tauri opener插件...');
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      console.log('[LinkOpener] Tauri opener插件导入成功');
      
      console.log('[LinkOpener] 调用opener.openUrl...');
      await openUrl(url);
      console.log('[LinkOpener] 链接已通过Tauri opener打开');
      
      return true;
    } catch (error) {
      console.error('[LinkOpener] Tauri opener失败:', error);
      return false;
    }
  }

  /**
   * 使用浏览器window.open打开链接
   */
  private openWithBrowser(url: string): boolean {
    try {
      console.log('[LinkOpener] 使用window.open打开链接');
      
      // 验证URL格式
      if (!this.isValidUrl(url)) {
        console.error('[LinkOpener] 无效的URL格式:', url);
        return false;
      }
      
      // 在新标签页中打开链接
      const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
      
      if (newWindow) {
        console.log('[LinkOpener] 浏览器窗口已打开');
        return true;
      } else {
        console.warn('[LinkOpener] 浏览器可能阻止了弹窗');
        return false;
      }
    } catch (error) {
      console.error('[LinkOpener] 浏览器打开失败:', error);
      return false;
    }
  }

  /**
   * 验证URL格式
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 打开GitHub链接
   */
  async openGitHub(path: string = ''): Promise<boolean> {
    const githubUrl = `https://github.com/kamjin3086/chatless${path}`;
    return this.openLink(githubUrl);
  }

  /**
   * 打开GitHub Releases页面
   */
  async openReleases(): Promise<boolean> {
    return this.openGitHub('/releases');
  }

  /**
   * 打开GitHub Issues页面
   */
  async openIssues(): Promise<boolean> {
    return this.openGitHub('/issues');
  }

  /**
   * 打开帮助中心
   */
  async openHelpCenter(): Promise<boolean> {
    return this.openLink('https://help.chatless.app');
  }

  /**
   * 打开反馈页面
   */
  async openFeedback(): Promise<boolean> {
    return this.openLink('https://feedback.chatless.app');
  }

  /**
   * 打开官方网站
   */
  async openWebsite(): Promise<boolean> {
    return this.openLink('https://chatless.app');
  }

  /**
   * 打开社区页面
   */
  async openCommunity(): Promise<boolean> {
    return this.openLink('https://community.chatless.app');
  }

  /**
   * 打开服务条款
   */
  async openTerms(): Promise<boolean> {
    return this.openLink('https://chatless.app/terms');
  }

  /**
   * 打开隐私政策
   */
  async openPrivacy(): Promise<boolean> {
    return this.openLink('https://chatless.app/privacy');
  }

  /**
   * 打开邮件客户端
   */
  async openEmail(to: string, subject: string = '', body: string = ''): Promise<boolean> {
    const mailtoUrl = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    return this.openLink(mailtoUrl);
  }

  /**
   * 打开支持邮件
   */
  async openSupportEmail(): Promise<boolean> {
    return this.openEmail('support@chatless.app', 'Chatless Support Request');
  }
}

// 导出单例实例
export const linkOpener = LinkOpenerService.getInstance(); 