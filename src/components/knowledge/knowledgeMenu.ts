import type { KnowledgeBase } from '@/lib/knowledgeService';

export interface MenuItem {
  id: string;
  text: string;
  action?: () => void;
  separator?: boolean;
  enabled?: boolean;
}

export function createKnowledgeMenuItems(
  kb: KnowledgeBase,
  options: {
    onRename?: (kb: KnowledgeBase) => void;
    onEditDesc?: (kb: KnowledgeBase) => void;
    onDelete?: (kb: KnowledgeBase) => void;
  }
): MenuItem[] {
  const { onRename, onEditDesc, onDelete } = options;
  return [
    { id: 'rename', text: '重命名', action: () => onRename?.(kb) },
    { id: 'editDesc', text: '修改描述', action: () => onEditDesc?.(kb) ?? onRename?.(kb) },
    { id: 'separator', text: '', separator: true },
    { id: 'delete', text: '删除', action: () => onDelete?.(kb) }
  ];
} 