'use client';

import { AnalyticsToolbar } from "@/components/analytics/AnalyticsToolbar";
import { MessageSquare, Bot, Clock, Tags, TrendingUp, Star, Flag } from "lucide-react";
import { useEffect, useState } from "react";
import { historyService } from "@/lib/historyService";
import { HistoryStats } from "@/types/history";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AnalyticsPage() {
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showLoading, setShowLoading] = useState(false);
  const [range, setRange] = useState<string>('30');

  useEffect(() => {
    let timer: any;
    if (isLoading) {
      timer = setTimeout(() => setShowLoading(true), 150);
    } else {
      setShowLoading(false);
    }
    return () => clearTimeout(timer);
  }, [isLoading]);

  useEffect(() => {
    const loadStats = async () => {
      try {
        setIsLoading(true);
        const historyStats = await historyService.getHistoryStats();
        setStats(historyStats);
      } catch (error) {
        console.error('加载统计数据失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, []);

  if (showLoading) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-500 dark:text-gray-400">加载统计数据中...</div>
    );
  }

  const topModels = stats ? Object.entries(stats.modelUsage)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5) : [];

  const topTags = stats ? Object.entries(stats.tagsUsage)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8) : [];

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
      <AnalyticsToolbar 
        range={range}
        onRangeChange={setRange}
        onExport={()=>{}}
        onRefresh={()=>window.location.reload()}
      />
      {/* 内容区域 */}
      <div className="flex-1 p-4 overflow-y-auto custom-scrollbar bg-gray-50 dark:bg-gray-800/40">
        {/* 概览统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="bg-white/80 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">总对话数</CardTitle>
              <MessageSquare className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats?.totalConversations || 0}</div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                共 {stats?.totalMessages || 0} 条消息
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">收藏对话</CardTitle>
              <Star className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats?.favoriteCount || 0}</div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                占比 {stats && stats.totalConversations > 0 ? Math.round((stats.favoriteCount / stats.totalConversations) * 100) : 0}%
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">重要对话</CardTitle>
              <Flag className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats?.importantCount || 0}</div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                占比 {stats && stats.totalConversations > 0 ? Math.round((stats.importantCount / stats.totalConversations) * 100) : 0}%
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">平均消息数</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {stats && stats.totalConversations > 0 ? Math.round(stats.totalMessages / stats.totalConversations) : 0}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                每个对话平均
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 详细统计图表 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 模型使用统计 */}
          <Card className="bg-white/80 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300 flex items-center gap-2">
                <Bot className="h-4 w-4" />
                模型使用统计
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topModels.length > 0 ? (
                <div className="space-y-3">
                  {topModels.map(([model, count]) => (
                    <div key={model} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs border-gray-300 dark:border-slate-600/60 text-gray-700 dark:text-gray-200">
                          {model}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{count}</div>
                        <div className="w-20 bg-gray-200 dark:bg-gray-700/40 rounded-full h-2">
                          <div 
                            className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full" 
                            style={{ 
                              width: `${stats ? (count / stats.totalConversations) * 100 : 0}%` 
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">暂无数据</p>
              )}
            </CardContent>
          </Card>

          {/* 标签使用统计 */}
          <Card className="bg-white/80 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300 flex items-center gap-2">
                <Tags className="h-4 w-4" />
                热门标签
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topTags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {topTags.map(([tag, count]) => (
                    <Badge 
                      key={tag} 
                      variant="secondary" 
                      className="text-xs flex items-center gap-1"
                    >
                      {tag}
                      <span className="bg-gray-300 text-gray-700 rounded-full px-1 text-xs">
                        {count}
                      </span>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">暂无标签数据</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 