import { create } from 'zustand';
import StorageUtil from '@/lib/storage';

export type MarkdownFontSize = 'sm' | 'md' | 'lg';

interface MarkdownPreferencesState {
  fontSize: MarkdownFontSize;
  setFontSize: (size: MarkdownFontSize) => void;
  initialized: boolean;
}

export const useMarkdownPreferences = create<MarkdownPreferencesState>((set, get) => ({
  fontSize: 'md',
  initialized: false,
  setFontSize: (size) => {
    set({ fontSize: size });
    // persist asynchronously
    StorageUtil.setItem('markdown_font_size', size, 'user-preferences.json');
  },
}));

// 初始加载用户存储中的首选项
(async () => {
  const stored = await StorageUtil.getItem<MarkdownFontSize>('markdown_font_size', 'md', 'user-preferences.json');
  useMarkdownPreferences.setState({ fontSize: stored || 'md', initialized: true });
})(); 