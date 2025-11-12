import type { McpTool } from '@/lib/mcp/McpClient';

export const WEB_SEARCH_SERVER_NAME = 'web_search';

export const WEB_SEARCH_TOOL_SCHEMA: McpTool = {
  name: 'search',
  description: '在互联网上搜索实时信息。适用于新闻、天气、时事或需要最新数据的问题。',
  input_schema: {
    schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜索关键词，例如 "东京今天的天气"',
        },
      },
      required: ['query'],
    },
  },
};


