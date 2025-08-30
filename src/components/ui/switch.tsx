"use client"

import * as React from "react";
import { cn } from "@/lib/utils";

interface SwitchProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeCfg = {
  sm: { track: "w-10 h-5", knob: 16, shift: 20 },
  md: { track: "w-12 h-6", knob: 20, shift: 24 },
  lg: { track: "w-14 h-7", knob: 24, shift: 28 },
} as const;

const SwitchImpl = React.forwardRef<HTMLInputElement, SwitchProps>(
  (
    {
      checked = false,
      onCheckedChange,
      disabled = false,
      className,
      size = "md",
      ...props
    },
    ref
  ) => {
    const cfg = sizeCfg[size];

    return (
      <label className={cn("relative inline-flex items-center select-none", className)}>
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          ref={ref}
          {...(props as any)}
        />
        {/* track */}
        <span
          aria-hidden
          className={cn(
            "block rounded-full transition-colors duration-200 ease-out",
            cfg.track,
            disabled
              ? "bg-gray-200 dark:bg-gray-700 opacity-50"
              : checked
              ? "bg-blue-600 dark:bg-blue-500"
              : "bg-gray-200 dark:bg-gray-700"
          )}
        />
        {/* knob */}
        <span
          aria-hidden
          className="absolute top-0.5 left-0.5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out"
          style={{
            width: cfg.knob,
            height: cfg.knob,
            transform: `translateX(${checked ? cfg.shift : 0}px)`,
          }}
        />
      </label>
    );
  }
);

SwitchImpl.displayName = "Switch";

export { SwitchImpl as Switch };
