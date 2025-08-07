import { cn } from "@/lib/utils";

interface SectionCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  selected?: boolean;
  hoverable?: boolean;
}

export function SectionCard({ children, className, onClick, selected=false, hoverable=true }: SectionCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-md border bg-white dark:bg-slate-900 text-left shadow-sm transition group",
        "border-slate-200 dark:border-slate-700",
        hoverable && "hover:shadow-md cursor-pointer",
        selected && "ring-2 ring-blue-500/40 bg-blue-50 dark:bg-blue-900/20",
        className
      )}
    >
      {children}
    </div>
  );
} 