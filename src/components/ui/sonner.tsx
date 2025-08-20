"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, ToasterProps } from "sonner"

// 统一裁剪描述文本，避免右下角弹窗过长
export function trimToastDescription(input: unknown, maxLen: number = 180): string | undefined {
  if (input == null) return undefined;
  let raw: string;
  if (typeof input === 'string') raw = input;
  else if ((input as any)?.message) raw = String((input as any).message);
  else {
    try { raw = JSON.stringify(input); } catch { raw = String(input); }
  }
  raw = raw.replace(/\s+/g, ' ').trim();
  if (raw.length > maxLen) return raw.slice(0, maxLen) + '…';
  return raw;
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      // 使用更高对比度且更轻盈的样式，确保亮色模式可读性
      position={props.position || "bottom-right"}
      toastOptions={{
        ...props.toastOptions,
        classNames: {
          ...props.toastOptions?.classNames,
          toast:
            "rounded-lg border px-3 py-2 backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.08)] " +
            "bg-white/90 text-slate-800 border-slate-200 " +
            "dark:bg-slate-900/90 dark:text-slate-100 dark:border-slate-700",
          title: "text-[13px] font-semibold",
          description: "text-[12px] text-slate-600 dark:text-slate-300",
          actionButton: "text-[12px]",
          cancelButton: "text-[12px]",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
