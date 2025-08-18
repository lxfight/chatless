import React, { useState, useId } from "react";
import { cn } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  description?: string;
  icon?: React.ReactNode;
  wrapperClassName?: string;
  inline?: boolean; // 行内显示：标签与输入框同一行
  labelWidthClassName?: string; // 行内模式下标签宽度，例如 w-28
}

export function InputField({
  label,
  description,
  icon,
  wrapperClassName,
  className,
  type,
  inline,
  labelWidthClassName,
  ...props
}: InputFieldProps) {
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = type === 'password';
  const inputHasValue = typeof props.value === 'string' ? props.value.length > 0 : (typeof props.defaultValue === 'string' ? (props.defaultValue as string).length > 0 : false);
  const shouldShowEye = isPassword && inputHasValue;
  const currentType = isPassword ? (showPassword ? 'text' : 'password') : type;
  const id = useId();

  return (
    <div className={cn("group mb-4", inline ? "flex items-center gap-3" : "", wrapperClassName)}>
      <label
        htmlFor={id}
        className={cn(
          "text-sm font-medium text-gray-700 dark:text-gray-300",
          inline ? cn(labelWidthClassName ?? "w-28", "mb-0") : "block mb-1.5"
        )}
      >
        {label}
      </label>
      <div className={cn("relative", inline ? "flex-1" : "")}>
        {icon && (
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            {icon}
          </span>
        )}
        <input
          id={id}
          {...props}
          type={currentType}
          className={cn(
            "w-full p-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary focus:border-transparent transition-all duration-200 hover:border-primary dark:hover:border-primary dark:text-gray-200",
            icon ? "pl-10" : "",
            shouldShowEye ? "pr-10" : "",
            className
          )}
        />
        {shouldShowEye && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"
            aria-label={showPassword ? "隐藏密码" : "显示密码"}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      {description && (
        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
          {description}
        </p>
      )}
    </div>
  );
} 