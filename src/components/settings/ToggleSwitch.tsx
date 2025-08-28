import { useId } from 'react';
import { HelpCircle } from 'lucide-react';

interface ToggleSwitchProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  tooltip?: string;
}

export function ToggleSwitch({
  label,
  description,
  checked,
  onChange,
  tooltip,
}: ToggleSwitchProps) {
  const id = useId();
  return (
    <div className="flex items-center justify-between py-3">
      {/* 左侧：标题 */}
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
      
      {/* 右侧：开关按钮 */}
      <div className="flex-shrink-0">
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            id={id}
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-12 h-7 bg-gray-100 dark:bg-gray-700 rounded-full relative transition-all duration-300 ease-out peer-checked:bg-blue-500 peer-checked:shadow-lg
          after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-6 after:w-6 after:shadow-sm after:transition-all after:duration-300 after:ease-out peer-checked:after:translate-x-5">
          </div>
        </label>
      </div>
    </div>
  );
} 