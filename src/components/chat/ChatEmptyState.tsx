"use client";

import { Bot  , Mail, BrainCircuit, HeartPulse, FileCode } from "lucide-react";
import { motion } from "framer-motion";

interface ChatEmptyStateProps {
  onPromptClick: (prompt: string) => void;
}

const examplePrompts = [
  {
    icon: <Mail className="w-5 h-5 text-indigo-500" />,
    text: "帮我写一封关于产品发布的邮件",
  },
  {
    icon: <BrainCircuit className="w-5 h-5 text-green-500" />,
    text: "用简单的语言解释什么是黑洞",
  },
  {
    icon: <HeartPulse className="w-5 h-5 text-rose-500" />,
    text: "给我一些关于健康饮食的建议",
  },
  {
    icon: <FileCode className="w-5 h-5 text-amber-500" />,
    text: "写一个Python脚本来重命名文件",
  },
];

export function ChatEmptyState({ onPromptClick }: ChatEmptyStateProps) {
  return (
    <div className="pt-16 sm:pt-24 max-w-xl mx-auto text-center space-y-6 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        className="flex justify-center"
      >
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/20 flex items-center justify-center border border-blue-200/50 dark:border-blue-700/40 shadow-lg">
          <Bot className="w-8 h-8 sm:w-10 sm:h-10 text-blue-600 dark:text-blue-400" strokeWidth={1.5} />
        </div>
      </motion.div>
      <motion.h2
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, delay: 0.08 }}
        className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-800 dark:text-slate-200"
      >
        今天有什么可以帮您？
      </motion.h2>
      
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, delay: 0.12 }}
        className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto"
      >
        这是一个AI助手，您可以提出任何问题，我会尽力回答。
      </motion.p>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8">
        {examplePrompts.map((prompt, index) => (
          <motion.button
            key={index}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: 0.16 + index * 0.05 }}
            onClick={() => onPromptClick(prompt.text)}
            className="flex cursor-pointer items-start gap-3 p-4 rounded-xl border border-slate-200/70 dark:border-slate-700/60 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800/40 dark:to-slate-800/20 hover:from-blue-50 hover:to-indigo-50/50 dark:hover:from-blue-900/20 dark:hover:to-indigo-900/10 hover:border-blue-300/60 dark:hover:border-blue-600/50 hover:shadow-md transition-all duration-200 group text-left"
          >
            <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-700/60 dark:to-slate-800/40 flex items-center justify-center border border-slate-200/50 dark:border-slate-600/30 group-hover:scale-105 transition-transform shadow-sm">
              {prompt.icon}
            </div>
            <span className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed flex-1 pt-0.5">{prompt.text}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
} 