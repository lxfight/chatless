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
      // 边框更醒目 + 悬停强调，未选中也更易见
      "peer h-4 w-4 shrink-0 rounded-sm border cursor-pointer",
      "border-gray-300 hover:border-gray-400 focus-visible:ring-2 focus-visible:ring-blue-500 ring-offset-white focus-visible:ring-offset-2",
      "disabled:cursor-not-allowed disabled:opacity-50",
      // 选中态
      "data-[state=checked]:bg-gray-900 data-[state=checked]:text-gray-50",
      // 暗色模式
      "dark:border-gray-600 dark:hover:border-gray-500 dark:ring-offset-gray-950 dark:focus-visible:ring-blue-400",
      "dark:data-[state=checked]:bg-gray-50 dark:data-[state=checked]:text-gray-900",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center text-current")}
    >
      <Check className="h-4 w-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
