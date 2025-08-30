"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SwitchProps {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  className?: string
  size?: "sm" | "md" | "lg"
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked = false, onCheckedChange, disabled = false, size = "md", ...props }, ref) => {
    const sizeClasses = {
      sm: {
        root: "h-4 w-7",
        thumb: "h-3 w-3 data-[state=checked]:translate-x-3 data-[state=unchecked]:translate-x-0.5"
      },
      md: {
        root: "h-5 w-9",
        thumb: "h-3.5 w-3.5 data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0.5"
      },
      lg: {
        root: "h-6 w-11",
        thumb: "h-4 w-4 data-[state=checked]:translate-x-6 data-[state=unchecked]:translate-x-1"
      }
    }

    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        data-state={checked ? "checked" : "unchecked"}
        disabled={disabled}
        className={cn(
          "peer inline-flex items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:focus:ring-offset-gray-800 disabled:cursor-not-allowed disabled:opacity-50",
          sizeClasses[size].root,
          checked 
            ? "bg-blue-600 dark:bg-blue-500" 
            : "bg-gray-200 dark:bg-gray-600",
          className
        )}
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          if (!disabled) {
            onCheckedChange?.(!checked)
          }
        }}
        ref={ref}
        {...props}
      >
        <span
          className={cn(
            "pointer-events-none block rounded-full bg-white shadow-lg ring-0 transition-transform",
            sizeClasses[size].thumb
          )}
        />
      </button>
    )
  }
)

Switch.displayName = "Switch"

export { Switch }
