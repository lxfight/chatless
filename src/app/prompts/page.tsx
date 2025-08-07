'use client';

import { PromptsHeader } from "@/components/prompts/PromptsHeader";
import { PromptsToolbar } from "@/components/prompts/PromptsToolbar";
import { CategorySidebar } from "@/components/prompts/CategorySidebar";
import { PromptList } from "@/components/prompts/PromptList";
import { Prompt } from "@/components/prompts/PromptCard"; // Import type

// Sample Data based on prompts.html
const samplePrompts: Prompt[] = [
  {
    id: 'p1',
    title: '专业文案撰写',
    description: '帮助创建专业的营销文案，适用于各种场景如产品介绍、活动推广等。',
    content: '你是一位资深的文案策划，请以[产品/服务名称]为主题，创建一份引人注目的文案。考虑目标受众是[目标受众]，突出以下卖点：[关键卖点]。文案应当简洁有力，突出产品价值，并包含明确的行动召唤。',
    tags: ['写作', '营销'],
    usageCount: 24,
    lastUpdated: '2小时前更新',
    isFavorite: true,
  },
  {
    id: 'p2',
    title: '代码审查',
    description: '帮助检查代码质量，提供优化建议和最佳实践。',
    content: '作为一名经验丰富的软件工程师，请审查以下[编程语言]代码。指出任何潜在的错误、性能问题、安全漏洞和可读性问题。提供具体的改进建议和代码示例，遵循行业最佳实践和设计模式。',
    tags: ['编程', '开发'],
    usageCount: 16,
    lastUpdated: '昨天更新',
    isFavorite: false,
  },
    {
    id: 'p3',
    title: '学习计划制定',
    description: '创建个性化学习计划和学习路径，提高学习效率。',
    content: '作为一名教育专家，请根据我的学习目标[学习目标]和当前水平[当前水平]，制定一个为期[时长]的学习计划。请包括具体的学习资源、每周学习进度安排、实践项目和阶段性评估方法。计划应当注重效率和可行性。',
    tags: ['学习', '教育'],
    usageCount: 8,
    lastUpdated: '3天前更新',
    isFavorite: false,
  },
  // Add more prompts if needed
];

export default function PromptsPage() {
  // TODO: Add state for selected category and filtering logic

  return (
    <div className="max-w-full mx-auto p-4">
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-lg bg-white dark:bg-gray-900 h-[calc(100vh-2rem)] flex flex-col">
        <PromptsHeader />
        <PromptsToolbar />
        <div className="flex-1 flex overflow-hidden">
          <CategorySidebar />
          {/* Prompt List Area */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-900/50">
            <PromptList prompts={samplePrompts} />
          </div>
        </div>
      </div>
    </div>
  );
} 