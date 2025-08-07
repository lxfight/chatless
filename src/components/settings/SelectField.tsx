import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useId } from 'react';

interface SelectFieldProps {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  description?: string;
}

export function SelectField({
  label,
  options,
  value,
  onChange,
  description,
}: SelectFieldProps) {
  const id = useId();
  return (
    <div className="flex items-start gap-8 py-3 group hover:bg-gray-50/40 dark:hover:bg-gray-800/30 rounded-md transition-colors duration-200 -mx-3 px-3">
      {/* label */}
      <div className="w-32 flex-shrink-0 pt-2">
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 leading-relaxed">
          {label}
        </label>
      </div>
      {/* control + description */}
      <div className="flex-1 min-w-0">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger id={id} className="setting-trigger-enhanced">
            <SelectValue placeholder="请选择" />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {description && (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            {description}
          </p>
        )}
      </div>
    </div>
  );
} 