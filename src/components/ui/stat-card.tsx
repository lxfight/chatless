import { cn } from '@/lib/utils';

interface StatCardProps{
  title:string;
  value:string|number;
  icon:React.ElementType;
  className?:string;
}

export function StatCard({title,value,icon:Icon,className}:StatCardProps){
  return (
    <div className={cn('flex items-center gap-3',className)}>
      <div className="h-10 w-10 flex items-center justify-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-500/20">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
        <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">{value}</p>
      </div>
    </div>
  );
} 