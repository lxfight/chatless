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
        <label htmlFor={id} className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
        {tooltip && (
          <div className="group relative">
            <HelpCircle className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help transition-colors" />
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
              {tooltip}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        )}
      </div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger 
          id={id} 
          className="w-full px-3 py-2.5 border border-gray-100 rounded-lg focus:ring-1 focus:ring-blue-500/30 focus:border-blue-200 transition-all duration-150 bg-white dark:bg-gray-800/30 dark:border-gray-700/30 hover:border-gray-200 dark:hover:border-gray-600/50 text-sm"
        >
          <SelectValue placeholder="请选择" />
        </SelectTrigger>
        <SelectContent className="border border-gray-100 rounded-lg shadow-lg bg-white dark:bg-gray-800 dark:border-gray-700">
          {options.map((option) => (
            <SelectItem 
              key={option.value} 
              value={option.value}
              className="text-sm focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:text-blue-700 dark:focus:text-blue-300"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
} 