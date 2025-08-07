"use client";

import React from 'react';
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { ArrowDownIcon, PauseIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ScrollIndicatorProps {
  shouldAutoScroll: boolean;
  isGenerating: boolean;
  onResumeAutoScroll: () => void;
  className?: string;
}

export function ScrollIndicator({
  shouldAutoScroll,
  isGenerating,
  onResumeAutoScroll,
  className
}: ScrollIndicatorProps) {
  return (
    <AnimatePresence>
      {isGenerating && !shouldAutoScroll && (
        <motion.div
          key="scroll-indicator"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.15 }}
          className={cn(
            "fixed bottom-20 right-4 z-50",
            className
          )}
        >
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={onResumeAutoScroll}
                  className="h-12 px-4 bg-blue-500/90 hover:bg-blue-600 text-white shadow-sm backdrop-blur-sm border border-blue-200"
                  size="sm"
                >
                  <div className="flex items-center gap-2">
                    <PauseIcon className="h-4 w-4" />
                    <span className="text-sm font-medium">自动滚动已暂停</span>
                    <ArrowDownIcon className="h-4 w-4" />
                  </div>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-64">
                <div className="space-y-1">
                  <p className="font-medium">自动滚动已暂停</p>
                  <p className="text-xs text-muted-foreground">
                    您正在浏览历史消息。点击此按钮或滚动到底部以恢复自动滚动到新消息。
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </motion.div>
      )}
    </AnimatePresence>
  );
} 