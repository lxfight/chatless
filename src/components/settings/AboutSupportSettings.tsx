"use client";

import { Button } from "@/components/ui/button";
import { 
  ExternalLink, 
  Check,
  MessageSquare
} from "lucide-react";
import { useState, useEffect } from "react";
import { APP_INFO, getVersionInfo } from "@/config/app-info";
import { linkOpener } from "@/lib/utils/linkOpener";
import { toast } from "sonner";

export function AboutSupportSettings() {
  const [showCopied, setShowCopied] = useState(false);
  const [versionInfo, setVersionInfo] = useState(getVersionInfo());

  // 读取实际版本信息
  useEffect(() => {
    // 尝试从Tauri获取应用版本信息
    const getTauriVersion = async () => {
      try {
        if (typeof window !== 'undefined' && (window as any).__TAURI__) {
          const { getVersion } = await import('@tauri-apps/api/app');
          const tauriVersion = await getVersion();
          setVersionInfo(prev => ({
            ...prev,
            version: tauriVersion
          }));
        }
      } catch (error) {
        console.log('无法获取Tauri版本信息，使用默认版本');
      }
    };

    getTauriVersion();
  }, []);

  const handleOpenLink = async (url: string) => {
    try {
      const success = await linkOpener.openLink(url);
      if (!success) {
        toast.error('无法打开链接，请稍后重试');
      }
    } catch (error) {
      console.error('打开链接失败:', error);
      toast.error('打开链接失败');
    }
  };

  const handleCheckUpdate = async () => {
    // 使用统一的链接打开工具
    await handleOpenLink(APP_INFO.releases);
  };

  return (
    <div className="space-y-8">
      {/* 页面标题 */}
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200 text-left">关于与支持</h1>

      {/* 关于应用 */}
      <section className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 flex items-center space-x-6">
        {/* 应用Logo */}
        <div className="flex-shrink-0">
          <div className="w-20 h-20 bg-white dark:bg-gray-900 rounded-2xl shadow-md flex items-center justify-center">
            <img className="p-2" src="/logo.svg" alt="logo" width={80} height={80} />
          </div>
        </div>
        
        {/* 应用信息 */}
        <div className="flex-1">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {APP_INFO.name}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            版本 {versionInfo.version} (Build {versionInfo.build})
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {APP_INFO.description}
          </p>
          <Button 
            onClick={handleCheckUpdate}
            variant="outline"
            size="sm"
            className="mt-3 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            检查更新
          </Button>
        </div>
      </section>

      {/* 支持与链接 */}
      <section className="mt-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 帮助中心 */}
          <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 hover:shadow-md transition-shadow">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200">帮助中心</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              查找教程和常见问题解答。
            </p>
            <button
              onClick={() => handleOpenLink(APP_INFO.helpCenter)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block"
            >
              前往 →
            </button>
          </div>

          {/* 提交反馈 */}
          <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 hover:shadow-md transition-shadow">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200">提交反馈</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              帮助我们改进产品，报告 Bug 或提出建议。
            </p>
            <button
              onClick={() => handleOpenLink(APP_INFO.feedback)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block"
            >
              前往 →
            </button>
          </div>

          {/* 官方网站 */}
          <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 hover:shadow-md transition-shadow">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200">官方网站</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              了解更多关于 {APP_INFO.name} 的信息。
            </p>
            <button
              onClick={() => handleOpenLink(APP_INFO.website)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block"
            >
              访问官网 →
            </button>
          </div>

          {/* 加入社区 */}
          <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 hover:shadow-md transition-shadow">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200">加入社区</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              与其他用户交流使用心得。
            </p>
            <button
              onClick={() => handleOpenLink(APP_INFO.community)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block"
            >
              立即加入 →
            </button>
          </div>
        </div>
      </section>

      {/* 法律信息 */}
      <footer className="mt-12 text-center text-xs text-gray-400 dark:text-gray-500">
        <div className="space-x-4">
          <button
            onClick={() => handleOpenLink(APP_INFO.terms)}
            className="hover:text-gray-600 dark:hover:text-gray-300 hover:underline"
          >
            服务条款
          </button>
          <span>&middot;</span>
          <button
            onClick={() => handleOpenLink(APP_INFO.privacy)}
            className="hover:text-gray-600 dark:hover:text-gray-300 hover:underline"
          >
            隐私政策
          </button>
        </div>
        <p className="mt-2">© 2025 {APP_INFO.name}. All rights reserved.</p>
      </footer>
    </div>
  );
} 