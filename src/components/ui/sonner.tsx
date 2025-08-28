"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, ToasterProps, toast as sonnerToast } from "sonner"

/**
 * 项目统一的Toast通知组件封装
 * 
 * 规范说明：
 * 1. 项目中所有右下角通知必须使用此封装的toast组件，禁止直接使用sonner库
 * 2. 此封装提供了统一的接口和样式，确保通知的一致性
 * 3. 支持success、error、info、warning、message五种通知类型
 * 4. 每种类型都支持description和duration参数
 * 5. 对于特殊需求，可以通过toast.raw访问原始的sonner toast
 * 
 * 使用示例：
 * ```typescript
 * import { toast } from "@/components/ui/sonner";
 * 
 * // 成功通知
 * toast.success("操作成功", { description: "详细信息" });
 * 
 * // 错误通知
 * toast.error("操作失败", { description: "错误详情", duration: 5000 });
 * 
 * // 信息通知
 * toast.info("提示信息");
 * 
 * // 警告通知
 * toast.warning("警告信息");
 * 
 * // 普通消息
 * toast.message("普通消息");
 * ```
 */

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

// 封装好的toast工具函数，提供统一的接口
export const toast = {
  success: (message: string, options?: { description?: string; duration?: number; action?: any }) => {
    return sonnerToast.success(message, {
      description: options?.description,
      duration: options?.duration || 4000,
      action: options?.action,
    });
  },
  
  error: (message: string, options?: { description?: string; duration?: number; action?: any }) => {
    return sonnerToast.error(message, {
      description: options?.description,
      duration: options?.duration || 5000,
      action: options?.action,
    });
  },
  
  info: (message: string, options?: { description?: string; duration?: number; action?: any }) => {
    return sonnerToast.info(message, {
      description: options?.description,
      duration: options?.duration || 4000,
      action: options?.action,
    });
  },
  
  warning: (message: string, options?: { description?: string; duration?: number; action?: any }) => {
    return sonnerToast.warning(message, {
      description: options?.description,
      duration: options?.duration || 4000,
      action: options?.action,
    });
  },
  
  message: (message: string, options?: { description?: string; duration?: number; action?: any }) => {
    return sonnerToast.message(message, {
      description: options?.description,
      duration: options?.duration || 4000,
      action: options?.action,
    });
  },
  
  // 直接暴露sonner的toast，用于特殊需求
  raw: sonnerToast,
};

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
