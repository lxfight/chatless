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
      "relative inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border border-gray-300 bg-white cursor-pointer transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 ring-offset-white",
      "disabled:cursor-not-allowed disabled:opacity-60",
      className
    )}
    {...props}
  >
    {/* 选中/半选中时：用指示器铺满背景，避免 data-state 变体兼容性问题 */}
    <CheckboxPrimitive.Indicator
      className={cn(
        "absolute inset-0 rounded-[3px] bg-blue-600 text-white flex items-center justify-center"
      )}
    >
      <Check className="h-3.5 w-3.5" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
