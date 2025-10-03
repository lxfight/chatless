import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SidebarNavButtonProps {
  href: string;
  label: string;
  icon: LucideIcon | React.ComponentType<React.SVGProps<SVGSVGElement>>;
  /** 是否为开发工具，展示特殊边框/颜色 */
  dev?: boolean;
}

/**
 * 统一的侧边栏导航按钮。封装了激活态、hover 动效及 Tooltip。
 */
export function SidebarNavButton({ href, label, icon: Icon, dev }: SidebarNavButtonProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + '/');

  return (
    <TooltipProvider delayDuration={80}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={href}
            className={cn(
              'nav-item flex flex-col items-center justify-center h-12 w-12 rounded-xl transition-all duration-200 relative group cursor-pointer',
              isActive
                ? 'bg-gradient-to-br from-blue-50 to-indigo-50/80 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-600 dark:text-blue-400 shadow-md ring-2 ring-blue-400/30 dark:ring-blue-500/30'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gradient-to-br hover:from-gray-100/80 hover:to-gray-50/60 dark:hover:from-gray-800/60 dark:hover:to-gray-850/50 hover:text-gray-900 dark:hover:text-gray-100 hover:shadow-sm',
              dev && 'border-2 border-orange-400/40 dark:border-orange-500/40'
            )}
            aria-label={label}
          >
            <Icon
              style={{ width: 'var(--sidebar-icon-size, 1.3rem)', height: 'var(--sidebar-icon-size, 1.3rem)' }}
              className={cn('transition-all duration-200 group-hover:scale-110', dev && 'text-orange-500 dark:text-orange-400')}
            />
          </Link>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          sideOffset={12}
          className="px-3 py-1.5 text-xs rounded-lg border border-gray-200/60 dark:border-gray-700/60 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md text-gray-700 dark:text-gray-100 shadow-xl"
        >
          {label}
          {dev && <span className="ml-1 text-orange-500">(开发)</span>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
} 