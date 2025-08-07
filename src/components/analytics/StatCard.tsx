'use client';

import { Button } from "@/components/ui/button";
import { LucideIcon, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  icon: LucideIcon;
  iconColorClass?: string; // e.g., "text-primary", "text-secondary"
}

export function StatCard({ title, icon: Icon, iconColorClass = "text-primary" }: StatCardProps) {
  return (
    <div className="chart-card bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden transition-shadow duration-300 hover:shadow-md">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-gray-800/30 dark:to-gray-900/30 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Icon className={cn("w-4 h-4", iconColorClass)} />
          <h3 className="font-medium text-gray-700 dark:text-gray-300 text-sm">{title}</h3>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="action-btn text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 p-1 h-6 w-6 transition-colors duration-200 focus:outline-none focus:ring-0 focus:ring-offset-0"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </div>
      <div className="p-4">
        {/* Placeholder for actual chart */}
        <div className="chart-placeholder bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center h-[220px] rounded-lg text-gray-500 dark:text-gray-400 text-sm transition-all duration-300 hover:border-gray-300 dark:hover:border-gray-600">
          {title} 图表区域
        </div>
      </div>
    </div>
  );
} 