// src/hooks/useGlobalFontSize.ts
"use client";
import { useEffect, useState } from "react";
import { storage } from "@/lib/storage";

export type GlobalFontSize = "small" | "medium" | "large";

const STORAGE_KEY = "global_font_size";

/**
 * 提供全局字体大小读取、设置并应用到根元素的 Hook
 */
export function useGlobalFontSize() {
  const [size, setSizeState] = useState<GlobalFontSize>("medium");

  // 初始化：读取已保存的用户偏好
  useEffect(() => {
    (async () => {
      const stored = await storage.getItem(STORAGE_KEY);
      if (stored === "small" || stored === "medium" || stored === "large") {
        setSizeState(stored);
      }
    })();
  }, []);

  // 当字体大小变化时，更新 DOM class 并持久化
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    // 先移除旧的 size class
    root.classList.remove("text-sm", "text-base", "text-lg");

    const cls = size === "small" ? "text-sm" : size === "large" ? "text-lg" : "text-base";
    root.classList.add(cls);
  }, [size]);

  const setSize = async (newSize: GlobalFontSize) => {
    setSizeState(newSize);
    await storage.setItem(STORAGE_KEY, newSize);
  };

  return { size, setSize };
} 