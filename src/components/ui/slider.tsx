"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SliderProps {
  value: number[];
  onValueChange: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  id?: string;
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, value, onValueChange, min = 0, max = 100, step = 1, id, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = parseFloat(e.target.value);
      onValueChange([newValue]);
    };

    return (
      <input
        type="range"
        id={id}
        className={cn(
          "w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer dark:bg-gray-700",
          "transition-all duration-200 ease-in-out",
          "hover:bg-gray-300 dark:hover:bg-gray-600",
          // 自定义滑块样式 - 更精致的尺寸
          "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4",
          "[&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full",
          "[&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white",
          "[&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:duration-200",
          "[&::-webkit-slider-thumb]:hover:bg-blue-600 [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:hover:shadow-lg",
          "[&::-webkit-slider-thumb]:active:scale-95",
          // Firefox 滑块样式 - 更精致的尺寸
          "[&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4",
          "[&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:rounded-full",
          "[&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white",
          "[&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:transition-all [&::-moz-range-thumb]:duration-200",
          "[&::-moz-range-thumb]:hover:bg-blue-600 [&::-moz-range-thumb]:hover:scale-110 [&::-moz-range-thumb]:hover:shadow-lg",
          "[&::-moz-range-thumb]:active:scale-95",
          // 轨道样式
          "[&::-webkit-slider-track]:bg-transparent [&::-webkit-slider-track]:h-1.5 [&::-webkit-slider-track]:rounded-full",
          "[&::-moz-range-track]:bg-transparent [&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full",
          // 进度条效果 - 更有活力的蓝色
          "bg-gradient-to-r from-blue-500 to-blue-600",
          "dark:from-blue-400 dark:to-blue-500",
          className
        )}
        style={{
          background: `linear-gradient(to right, rgb(59 130 246) 0%, rgb(59 130 246) ${((value[0] - min) / (max - min)) * 100}%, rgb(229 231 235) ${((value[0] - min) / (max - min)) * 100}%, rgb(229 231 235) 100%)`,
        }}
        value={value[0]}
        onChange={handleChange}
        min={min}
        max={max}
        step={step}
        ref={ref}
        {...props}
      />
    );
  }
);

Slider.displayName = "Slider";

export { Slider }; 