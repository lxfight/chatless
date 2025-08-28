"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { devResetDatabase, devClearData, devCheckDatabase } from '@/lib/__admin__/devTools';

import { EnvironmentStatus } from './EnvironmentStatus';
import { EnvironmentDebug } from './EnvironmentDebug';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DatabaseRepairTool } from './DatabaseRepairTool';
import { PerformanceMonitor } from './PerformanceMonitor';

interface DevToolsPanelProps {
  onClose?: () => void;
}

export function DevToolsPanel({ onClose }: DevToolsPanelProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string>('');
  const [showEnvironmentInfo, setShowEnvironmentInfo] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  // 数据目录入口已移至 dev-tools 页面，这里不再显示

  const handleReset = async (withTestData: boolean = false) => {
    const action = withTestData ? 'reset-test' : 'reset';
    setLoading(action);
    setLastAction('');
    
    try {
      const success = await devResetDatabase({ 
        withTestData, 
        verbose: true 
      });
      
      if (success) {
        setLastAction(`数据库重置成功${withTestData ? '（含测试数据）' : ''}`);
      } else {
        setLastAction('❌ 数据库重置失败');
      }
    } catch (error) {
      console.error('重置失败:', error);
      setLastAction(`❌ 数据库重置失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(null);
    }
  };

  const handleClear = async () => {
    setLoading('clear');
    setLastAction('');
    
    try {
      const success = await devClearData(true);
      
      if (success) {
        setLastAction('数据清理成功（表结构已保留）');
      } else {
        setLastAction('❌ 数据清理失败');
      }
    } catch (error) {
      console.error('清理失败:', error);
      setLastAction(`❌ 数据清理失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(null);
    }
  };

  const handleCheck = async () => {
    setLoading('check');
    setLastAction('');

    try {
      await devCheckDatabase();
      setLastAction('数据库状态检查完成（详情请查看控制台）');
    } catch (error) {
      console.error('检查失败:', error);
      setLastAction(`❌ 数据库状态检查失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(null);
    }
  };

  const handleOpenAppDataDir = async () => {
    try {
      // 动态导入以避免非 Tauri 环境报错
      const { appDataDir } = await import('@tauri-apps/api/path');
      // @ts-ignore - opener 插件仅在 Tauri 环境存在
      const { openPath, open } = await import('@tauri-apps/plugin-opener');
      const dir = await appDataDir();
      if (openPath) {
        await openPath(dir);
      } else if (open) {
        // 兼容老版本 shell.open
        await open(dir);
      } else {
        throw new Error('未找到 openPath/open 方法，请确认插件已正确安装');
      }
      setLastAction(`已尝试打开应用数据目录：${dir}`);
    } catch (error) {
      console.error('打开应用数据目录失败:', error);
      setLastAction('❌ 打开应用数据目录失败');
    }
  };

  useEffect(() => {}, []);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <>
      {/* 性能监测面板 */}
      <PerformanceMonitor />
      
      {/* 开发工具面板 */}
      <div className="fixed bottom-4 left-4 z-50">
        <Button
          onClick={() => setIsVisible(!isVisible)}
          variant="outline"
          size="sm"
          className="bg-white shadow-lg"
        >
          🛠️ 开发工具
        </Button>
            </div>

      {isVisible && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">开发工具面板</h2>
              <Button
                onClick={() => setIsVisible(false)}
                variant="ghost"
                size="sm"
              >
                ✕
              </Button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
              <Tabs defaultValue="environment" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="environment">环境状态</TabsTrigger>
                  <TabsTrigger value="database">数据库工具</TabsTrigger>
                  <TabsTrigger value="data">数据管理</TabsTrigger>
                  <TabsTrigger value="performance">性能监测</TabsTrigger>
                </TabsList>

                <TabsContent value="environment" className="space-y-4">
                  <EnvironmentStatus />
                </TabsContent>

                <TabsContent value="database" className="space-y-4">
                  <DatabaseRepairTool />
                </TabsContent>

                <TabsContent value="data" className="space-y-4">
            <Card>
                    <CardHeader>
                      <CardTitle>数据管理</CardTitle>
              </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-600 mb-4">
                        管理应用中的数据，包括重置数据库、清理数据等。
                      </p>
                      <div className="space-y-2">
                <Button 
                          onClick={() => handleReset(true)}
                          variant="outline"
                  size="sm"
                          disabled={loading === 'reset-test'}
                >
                          {loading === 'reset-test' ? '重置中...' : '重置数据库（含测试数据）'}
                </Button>
                <Button 
                          onClick={() => handleReset()}
                  variant="outline"
                  size="sm"
                          disabled={loading === 'reset'}
                >
                          {loading === 'reset' ? '重置中...' : '重置数据库'}
                </Button>
                <Button 
                  onClick={handleClear} 
                  variant="outline"
                  size="sm"
                          disabled={loading === 'clear'}
                >
                          {loading === 'clear' ? '清理中...' : '清理数据（表结构已保留）'}
                </Button>
                <Button 
                  onClick={handleCheck} 
                          variant="outline"
                  size="sm"
                          disabled={loading === 'check'}
                >
                          {loading === 'check' ? '检查中...' : '检查数据库状态'}
                </Button>
                      </div>
              </CardContent>
            </Card>
                </TabsContent>

                <TabsContent value="performance" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>启动性能监测</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-600 mb-4">
                        监测应用启动过程中各个阶段的性能表现，识别性能瓶颈。
                      </p>
                      <div className="space-y-2">
                        <Button
                          onClick={() => {
                            const { startupMonitor } = require('@/lib/utils/startupPerformanceMonitor');
                            startupMonitor.printReport();
                          }}
                          variant="outline"
                          size="sm"
                        >
                          打印性能报告
                        </Button>
                        <Button
                          onClick={() => {
                            const { startupMonitor } = require('@/lib/utils/startupPerformanceMonitor');
                            startupMonitor.reset();
                          }}
                          variant="outline"
                          size="sm"
                        >
                          重置监测器
                        </Button>
          </div>
        </CardContent>
      </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
        )}
    </>
  );
} 