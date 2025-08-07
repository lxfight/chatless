import { registerCommand } from './commandRegistry';
import { settingsIndex } from '@/config/settingsIndex';

// 简易导航函数，保持与 defaultCommands 一致
function navigate(path: string) {
  window.location.href = path;
}

settingsIndex.forEach((s) => {
  registerCommand({
    id: `setting-${s.id}`,
    titleI18n: s.i18nKey,
    section: 'settings',
    keywords: s.keywords,
    action: () => {
      // 通过 URL 包含 tab 参数和锚点跳转
      navigate(`/settings?tab=${s.tab}#${s.anchor}`);
    },
  });
}); 