import { cn } from "@/lib/utils";

interface SettingsCardProps {
  children: React.ReactNode;
  className?: string;
}

export function SettingsCard({ children, className }: SettingsCardProps) {
  return (
    <div className={cn(
      "settings-card dark:bg-gray-900 p-0 mb-12",
      className
    )}>
      {children}
    </div>
  );
} 