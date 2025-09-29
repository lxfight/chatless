"use client";

import { create } from "zustand";

interface UiSessionState {
  /** 本次应用会话内，聊天输入框的手动高度（px）。null 表示未手动设置，走自动自适应 */
  chatInputHeight: number | null;
  setChatInputHeight: (h: number | null) => void;
}

export const useUiSession = create<UiSessionState>((set) => ({
  chatInputHeight: null,
  setChatInputHeight: (h) => set({ chatInputHeight: typeof h === 'number' ? Math.max(0, h) : null })
}));


