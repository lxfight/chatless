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
    <>
      <Sonner
        theme={theme as ToasterProps["theme"]}
        className="toaster group"
        // 使用更高对比度且更轻盈的样式，确保亮色/暗色模式的可读性
        position={props.position || "bottom-right"}
        toastOptions={{
          ...props.toastOptions,
          classNames: {
            ...props.toastOptions?.classNames,
            // 精致轻盈风格：半透明毛玻璃、柔和阴影、可选中文本
            toast:
              "relative rounded-xl border px-3.5 py-2.5 backdrop-blur-lg " +
              "shadow-[0_8px_28px_rgba(0,0,0,0.08)] ring-1 ring-black/5 " +
              "bg-white/80 text-slate-800 border-white/40 " +
              "dark:bg-slate-900/80 dark:text-slate-100 dark:border-white/10 dark:ring-white/10 " +
              "[&]:cursor-text select-text",
            title: "text-[13px] font-semibold leading-5",
            description: "text-[12px] leading-5 text-slate-600 dark:text-slate-300",
            actionButton: "text-[12px]",
            cancelButton: "text-[12px]",
          },
        }}
        {...props}
      />

      {/* 全局覆写：1) 允许文本选择 2) 禁止拖动位移 3) 细化左右色条与主题色 */}
      <style jsx global>{`
        /* 允许在通知内选择文本以便复制 */
        .toaster [data-sonner-toast] {
          -webkit-user-select: text;
          user-select: text;
          /* 细化外观：左侧细色条用于类型区分 */
          border-left-width: 2px;
          border-left-style: solid;
        }

        /* 禁止在拖拽/滑动状态下的平移，避免选中文本时卡片跟随鼠标移动 */
        .toaster [data-sonner-toast][data-swiping],
        .toaster [data-sonner-toast][data-dragging],
        .toaster [data-sonner-toast][data-swipe] {
          transform: none !important;
          translate: 0 !important;
        }

        /* 触摸环境下也避免横向滑动导致位移 */
        .toaster [data-sonner-toast] { touch-action: manipulation; }

        /* 不同类型的轻量配色（左侧色条） */
        .toaster [data-sonner-toast][data-type='success'] { border-left-color: #10b981; }
        .toaster [data-sonner-toast][data-type='error'] { border-left-color: #ef4444; }
        .toaster [data-sonner-toast][data-type='warning'] { border-left-color: #f59e0b; }
        .toaster [data-sonner-toast][data-type='info'],
        .toaster [data-sonner-toast][data-type='message'] { border-left-color: #0ea5e9; }

        /* 悬停时略微提升阴影与背景透明度，保持轻盈质感 */
        .toaster [data-sonner-toast]:hover {
          box-shadow: 0 10px 30px rgba(0,0,0,0.10);
          background: color-mix(in srgb, rgba(255,255,255,0.86) 100%, transparent);
        }
        @media (prefers-color-scheme: dark) {
          .toaster [data-sonner-toast]:hover {
            box-shadow: 0 10px 30px rgba(0,0,0,0.35);
            background: color-mix(in srgb, rgba(15,23,42,0.86) 100%, transparent);
          }
        }
      `}</style>
    </>
  )
}

export { Toaster }
