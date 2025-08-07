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
    <div className="pt-24 max-w-md mx-auto text-center space-y-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className=""
      >
        <Bot className="w-12 h-12 text-primary mx-auto" strokeWidth={1.5} />
      </motion.div>
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="text-lg font-medium tracking-tight text-gray-800 dark:text-gray-200"
      >
        今天有什么可以帮您？
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="text-xs text-gray-500 dark:text-gray-400"
      >
        这是一个AI助手，您可以提出任何问题，我会尽力回答。
      </motion.p>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {examplePrompts.map((prompt, index) => (
          <motion.button
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 + index * 0.1 }}
            onClick={() => onPromptClick(prompt.text)}
            className="h-10 flex cursor-pointer items-center gap-3 justify-center rounded-md border border-gray-200/70 dark:border-gray-700/60 bg-white/60 dark:bg-gray-800/30 hover:bg-primary/5 dark:hover:bg-primary/10 hover:border-primary/50 transition-colors group"
          >
            <div className="flex items-center gap-4 text-left">
              <div className="flex-shrink-0 w-6 h-6 rounded-md bg-gray-100 dark:bg-gray-700/40 flex items-center justify-center">
                {prompt.icon}
              </div>
              <span className="text-xs text-gray-700 dark:text-gray-300 whitespace-normal leading-none">{prompt.text}</span>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
} 