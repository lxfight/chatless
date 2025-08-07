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
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={href}
            className={cn(
              'nav-item flex flex-col items-center justify-center h-9 w-9 rounded-2xl transition-all duration-200 relative group cursor-pointer',
              isActive
                ? 'bg-blue-500/15 dark:bg-blue-500/20 text-blue-600 dark:text-[var(--nav-active)] shadow-sm'
                : 'text-slate-600 dark:text-[var(--nav-fg)] hover:bg-slate-100 dark:hover:bg-[var(--nav-hover)] hover:text-slate-900 dark:hover:text-[var(--fg-primary)]',
              dev && 'border border-orange-500/30'
            )}
            aria-label={label}
          >
            <Icon
              style={{ width: 'var(--sidebar-icon-size, 1.25rem)', height: 'var(--sidebar-icon-size, 1.25rem)' }}
              className={cn('transition-transform duration-200 group-hover:scale-110', dev && 'text-orange-500')}
            />
          </Link>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          className="px-2 py-1 text-xs rounded-sm border-slate-200 dark:border-slate-600 shadow-sm backdrop-blur-sm"
        >
          {label}
          {dev && ' (开发)'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
} 