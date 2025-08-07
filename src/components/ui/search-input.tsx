import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, ...props }, ref) => (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
      <input
        ref={ref}
        type="text"
        className={cn(
          "pl-9 pr-3 py-1.5 h-8 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-500 focus:border-transparent transition-colors text-gray-700 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500",
          className
        )}
        {...props}
      />
    </div>
  )
);
SearchInput.displayName = "SearchInput"; 