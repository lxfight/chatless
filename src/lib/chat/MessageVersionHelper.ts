/**
 * 消息版本处理辅助函数
 * 
 * 用于处理带有版本组的消息，确保在构建LLM历史时使用正确的版本
 */

import type { Message } from '@/types/chat';

/**
 * 获取消息列表中每个版本组的最新版本
 * 
 * 对于有version_group_id的消息，只保留该组中version_index最大的那条
 * 对于没有version_group_id的消息，直接保留
 * 
 * @param messages 原始消息列表
 * @returns 过滤后的消息列表，每个版本组只保留最新版本
 */
export function getLatestVersionMessages(messages: Message[]): Message[] {
  if (!messages || messages.length === 0) return [];

  // 用于跟踪每个版本组的最新版本
  const versionGroups = new Map<string, Message>();
  // 用于跟踪处理顺序，保持原始消息的相对位置
  const processedMessages: Message[] = [];

  for (const msg of messages) {
    const groupId = (msg as any).version_group_id as string | undefined;
    
    if (!groupId) {
      // 没有版本组的消息直接保留
      processedMessages.push(msg);
    } else {
      // 有版本组的消息，检查是否需要更新
      const existing = versionGroups.get(groupId);
      const currentIndex = (msg as any).version_index ?? 0;
      const existingIndex = existing ? ((existing as any).version_index ?? 0) : -1;
      
      if (!existing) {
        // 第一次遇到这个版本组
        versionGroups.set(groupId, msg);
        processedMessages.push(msg);
      } else if (currentIndex > existingIndex) {
        // 当前消息是更新的版本，替换旧版本
        const existingIdx = processedMessages.findIndex(m => m.id === existing.id);
        if (existingIdx >= 0) {
          processedMessages[existingIdx] = msg;
        }
        versionGroups.set(groupId, msg);
      }
      // 如果当前版本更老，忽略它
    }
  }

  return processedMessages;
}

/**
 * 从消息列表中排除指定版本组的所有消息
 * 
 * @param messages 原始消息列表
 * @param excludeGroupId 要排除的版本组ID
 * @returns 过滤后的消息列表
 */
export function excludeVersionGroup(messages: Message[], excludeGroupId: string): Message[] {
  if (!messages || messages.length === 0) return [];
  if (!excludeGroupId) return messages;
  
  return messages.filter(msg => {
    const groupId = (msg as any).version_group_id as string | undefined;
    return groupId !== excludeGroupId;
  });
}

/**
 * 获取指定版本组的所有消息
 * 
 * @param messages 原始消息列表
 * @param groupId 版本组ID
 * @returns 该版本组的所有消息，按version_index排序
 */
export function getVersionGroupMessages(messages: Message[], groupId: string): Message[] {
  if (!messages || messages.length === 0 || !groupId) return [];
  
  const groupMessages = messages.filter(msg => {
    const msgGroupId = (msg as any).version_group_id as string | undefined;
    return msgGroupId === groupId;
  });
  
  // 按version_index排序
  groupMessages.sort((a, b) => {
    const indexA = (a as any).version_index ?? 0;
    const indexB = (b as any).version_index ?? 0;
    return indexA - indexB;
  });
  
  return groupMessages;
}

/**
 * 获取版本组的最新版本消息
 * 
 * @param messages 原始消息列表
 * @param groupId 版本组ID
 * @returns 该版本组的最新版本消息，如果没找到则返回undefined
 */
export function getLatestVersionInGroup(messages: Message[], groupId: string): Message | undefined {
  const groupMessages = getVersionGroupMessages(messages, groupId);
  if (groupMessages.length === 0) return undefined;
  
  // 已经排序，取最后一个即为最新版本
  return groupMessages[groupMessages.length - 1];
}

