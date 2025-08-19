import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, ...props }, ref) => (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
      <input
        ref={ref}
        type="text"
        className={cn(
          "pl-8 pr-2.5 py-1.5 h-8 text-sm bg-transparent border-0 rounded-md focus:outline-none focus:ring-0 transition-colors text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500",
          className
        )}
        {...props}
      />
    </div>
  )
);
SearchInput.displayName = "SearchInput"; 