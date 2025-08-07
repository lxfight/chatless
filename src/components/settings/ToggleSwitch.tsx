import { useId } from 'react';

interface ToggleSwitchProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function ToggleSwitch({
  label,
  description,
  checked,
  onChange,
}: ToggleSwitchProps) {
  const id = useId();
  return (
    <div className="flex items-start justify-between py-3 min-h-[48px] group hover:bg-gray-50/40 dark:hover:bg-gray-800/30 rounded-md transition-colors duration-200 -mx-3 px-3">
      {/* 左侧：标题和描述 */}
      <div className="flex-1 min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-gray-700 dark:text-gray-300 leading-relaxed">
          {label}
        </label>
        {description && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      
      {/* 右侧：开关按钮 */}
      <div className="flex-shrink-0 ml-4">
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            id={id}
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 rounded-full relative transition-all duration-300 ease-out peer-checked:bg-blue-500 peer-checked:shadow-md
          after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:shadow-sm after:transition-all after:duration-300 after:ease-out peer-checked:after:translate-x-5 peer-checked:after:shadow-lg">
          </div>
        </label>
      </div>
    </div>
  );
} 