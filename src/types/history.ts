export interface HistoryItem {
  id: string;
  conversationId: string;
  title: string;
  summary: string;
  model: string;
  tags: string[];
  timestamp: number;
  fullTimestamp: string;
  isImportant: boolean;
  isFavorite: boolean;
  messageCount: number;
  lastMessage: string;
  createdAt: number;
  updatedAt: number;
}

export interface HistoryFilter {
  dateRange: 'today' | 'yesterday' | 'week' | 'month' | 'all';
  model?: string;
  tags?: string[];
  isImportant?: boolean;
  isFavorite?: boolean;
  searchQuery?: string;
}

export interface HistoryGroup {
  date: string;
  displayName: string;
  items: HistoryItem[];
}

export interface HistoryStats {
  totalConversations: number;
  totalMessages: number;
  favoriteCount: number;
  importantCount: number;
  modelUsage: Record<string, number>;
  tagsUsage: Record<string, number>;
} 