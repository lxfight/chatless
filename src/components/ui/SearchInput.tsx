"use client";
import React from "react";

export type SearchInputVariant =
  | "basic"            // 简洁基础型
  | "withIcon"         // 内嵌图标型
  | "underlineAnimated"// 动效下划线型
  | "withButton"       // 按钮组合型
  | "bold";            // 加粗底边

interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onSubmit"> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  variant?: SearchInputVariant;
  onSubmit?: () => void;
  allowClear?: boolean;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "搜索…",
  variant = "withIcon",
  onSubmit,
  className,
  allowClear = false,
  ...rest
}: SearchInputProps) {
  if (variant === "underlineAnimated") {
    return (
      <div className={`relative overflow-hidden ${className || ""}`}>
        <input
          {...rest}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full py-1.5 bg-transparent text-gray-800 dark:text-gray-100 border-0 border-b-2 border-gray-300 dark:border-gray-700 appearance-none focus:outline-none focus:ring-0"
          onKeyDown={(e)=>{ if (e.key === 'Enter') onSubmit?.(); }}
        />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] w-0 bg-blue-500 transition-all duration-300 peer-focus:w-full" />
      </div>
    );
  }

  if (variant === "withButton") {
    return (
      <div className={`flex items-center border-b-2 border-gray-300 dark:border-gray-700 focus-within:border-rose-500 transition-colors duration-300 ${className || ""}`}>
        <input
          {...rest}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full py-1.5 border-0 bg-transparent text-gray-800 dark:text-gray-100 appearance-none focus:outline-none focus:ring-0"
          onKeyDown={(e)=>{ if (e.key === 'Enter') onSubmit?.(); }}
        />
        <button type="button" className="p-1.5 text-gray-400 hover:text-rose-500 transition-colors duration-300" onClick={onSubmit}>
          <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </button>
      </div>
    );
  }

  if (variant === "bold") {
    return (
      <input
        {...rest}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full py-1.5 bg-transparent text-gray-800 dark:text-gray-100 border-0 border-b-4 border-gray-300 dark:border-gray-700 appearance-none focus:outline-none focus:ring-0 focus:border-cyan-500 transition-colors duration-300 ${className || ""}`}
        onKeyDown={(e)=>{ if (e.key === 'Enter') onSubmit?.(); }}
      />
    );
  }

  if (variant === "basic") {
    return (
      <input
        {...rest}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full py-1.5 bg-transparent text-gray-800 dark:text-gray-100 border-0 border-b-2 border-gray-300 dark:border-gray-700 appearance-none focus:outline-none focus:ring-0 focus:border-indigo-500 transition-colors duration-300 ${className || ""}`}
        onKeyDown={(e)=>{ if (e.key === 'Enter') onSubmit?.(); }}
      />
    );
  }

  // withIcon (默认)
  return (
    <div className={`relative ${className || ""}`}>
      <div className="absolute inset-y-0 left-0 flex items-center pl-1 pointer-events-none">
        <svg className="w-4 h-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
      </div>
      {allowClear && value && (
        <button
          type="button"
          aria-label="clear"
          className="absolute inset-y-0 right-1 flex items-center text-gray-400 hover:text-gray-600"
          onClick={() => {
            const ev = { target: { value: "" } } as unknown as React.ChangeEvent<HTMLInputElement>;
            onChange(ev);
          }}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      )}
      <input
        {...rest}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full py-1.5 pl-7 pr-6 bg-transparent text-gray-800 dark:text-gray-100 border-0 border-b-2 border-gray-300 dark:border-gray-700 appearance-none focus:outline-none focus:ring-0 focus:border-blue-500 transition-colors duration-300"
        onKeyDown={(e)=>{ if (e.key === 'Enter') onSubmit?.(); }}
      />
    </div>
  );
}


