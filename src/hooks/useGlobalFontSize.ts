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
  const [initialized, setInitialized] = useState(false);

  // 初始化：读取已保存的用户偏好
  useEffect(() => {
    (async () => {
      const stored = await storage.getItem(STORAGE_KEY);
      if (stored === "small" || stored === "medium" || stored === "large") {
        setSizeState(stored);
      }
      setInitialized(true);
    })();
  }, []);

  // 当字体大小变化时，更新 DOM class 并持久化
  useEffect(() => {
    if (!initialized || typeof document === "undefined") return;
    const root = document.documentElement;
    const cls = size === "small" ? "text-sm" : size === "large" ? "text-lg" : "text-base";
    // 若当前已是目标类，避免重复移除/添加导致的闪烁
    if (root.classList.contains(cls)) return;
    root.classList.remove("text-sm", "text-base", "text-lg");
    root.classList.add(cls);
  }, [size, initialized]);

  const setSize = async (newSize: GlobalFontSize) => {
    setSizeState(newSize);
    await storage.setItem(STORAGE_KEY, newSize);
  };

  return { size, setSize };
} 