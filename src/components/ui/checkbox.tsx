"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      // 尺寸与形态：小圆角精致、可点区域清晰
      "peer h-4 w-4 shrink-0 rounded-[3px] border cursor-pointer transition-colors duration-150",
      // 亮色默认态
      "bg-white border-gray-300 hover:border-gray-400 hover:bg-gray-50",
      // 暗色默认态
      "dark:bg-slate-900/20 dark:border-slate-600 dark:hover:border-slate-500 dark:hover:bg-slate-800/40",
      // 焦点可达性
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:focus-visible:ring-blue-400/60 focus-visible:ring-offset-2 ring-offset-white dark:ring-offset-slate-900",
      // 禁用
      "disabled:cursor-not-allowed disabled:opacity-60",
      // 选中/半选中态：统一品牌色，边框与背景一致
      "data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 data-[state=checked]:text-white",
      "data-[state=indeterminate]:bg-blue-600 data-[state=indeterminate]:border-blue-600 data-[state=indeterminate]:text-white",
      // 暗色下选中/半选中保持对比度
      "dark:data-[state=checked]:bg-blue-400 dark:data-[state=checked]:border-blue-400",
      "dark:data-[state=indeterminate]:bg-blue-400 dark:data-[state=indeterminate]:border-blue-400",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center text-current")}
    >
      <Check className="h-3.5 w-3.5" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
