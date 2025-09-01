import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useId } from 'react';
import { HelpCircle } from 'lucide-react';

interface SelectFieldProps {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  description?: string;
  tooltip?: string;
}

export function SelectField({
  label,
  options,
  value,
  onChange,
  description,
  tooltip,
}: SelectFieldProps) {
  const id = useId();
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="text-sm font-medium text-gray-800 dark:text-gray-200">
          {label}
        </label>
        {tooltip && (
          <div className="group relative">
            {/* 使用品牌色增强提示图标 */}
            <HelpCircle className="w-4 h-4 text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300 cursor-help transition-colors" />
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-brand-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
              {tooltip}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        )}
      </div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger 
          id={id} 
          className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800/40 text-sm
                     hover:border-brand-300 dark:hover:border-brand-500
                     focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-300 dark:focus:ring-brand-400/40 dark:focus:border-brand-400
                     transition-all duration-150"
        >
          <SelectValue placeholder="请选择" />
        </SelectTrigger>
        <SelectContent className="border border-gray-100 rounded-lg shadow-lg bg-white dark:bg-gray-800 dark:border-gray-700">
          {options.map((option) => (
            <SelectItem 
              key={option.value} 
              value={option.value}
              className="text-sm
                         data-[highlighted]:bg-brand-50 dark:data-[highlighted]:bg-brand-900/30 data-[highlighted]:text-brand-700 dark:data-[highlighted]:text-brand-300
                         data-[state=checked]:bg-brand-300 dark:data-[state=checked]:bg-brand-900/40 data-[state=checked]:text-brand-800 dark:data-[state=checked]:text-brand-100"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
} 