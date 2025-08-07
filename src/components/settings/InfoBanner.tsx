import { AlertTriangle, X } from 'lucide-react';
import { cn } from "@/lib/utils";
import { useEffect, useState } from 'react';
import StorageUtil from '@/lib/storage';

interface InfoBannerProps extends React.HTMLAttributes<HTMLDivElement> {
  id?: string; // unique id for persist dismiss
  message: string;
  type?: 'warning' | 'info' | 'error';
}

export function InfoBanner({ id, message, type = 'warning', className, ...rest }: InfoBannerProps) {
  const storageKey = id ? `banner_dismiss_${id}` : undefined;
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    (async () => {
      if (storageKey) {
        const dismissed = await StorageUtil.getItem<string>(storageKey, null, 'user-preferences.json');
        if (dismissed === '1') setHidden(true);
      }
    })();
  }, [storageKey]);

  const handleClose = () => {
    setHidden(true);
    if (storageKey) StorageUtil.setItem(storageKey, '1', 'user-preferences.json');
  };

  if (hidden) return null;

  const colors = {
    warning: "bg-yellow-50 dark:bg-yellow-900 border-yellow-400 dark:border-yellow-600 text-yellow-800 dark:text-yellow-200",
    info: "bg-blue-50 dark:bg-blue-900 border-blue-400 dark:border-blue-600 text-blue-800 dark:text-blue-200",
    error: "bg-red-50 dark:bg-red-900 border-red-400 dark:border-red-600 text-red-800 dark:text-red-200",
  };

  return (
    <div {...rest} className={cn("border-l p-3 rounded-md flex items-start justify-between", colors[type], className)}>
      <div className="flex items-center gap-2 text-xs">
        <AlertTriangle className="w-4 h-4 opacity-70 flex-shrink-0" />
        <span className="opacity-80 leading-snug">{message}</span>
      </div>
      <button onClick={handleClose} className="p-1 ml-2 text-xs opacity-60 hover:opacity-100">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
} 