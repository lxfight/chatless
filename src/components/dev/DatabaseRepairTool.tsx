"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
// Simple separator component
const Separator = () => <hr className="border-t border-border my-4" />;
import { 
  AlertTriangle, 
  CheckCircle2, 
  Database, 
  RefreshCw, 
  Settings, 
  Trash2,
  Wrench,
  Shield,
  Zap
} from 'lucide-react';
import { getDatabaseService } from '@/lib/db';
import { 
  diagnoseDatabaseIssues, 
  autoRepairDatabase, 
  quickFix, 
  safeRepair,
  resetDatabaseToVersion,
  rebuildDatabase,
  clearDatabaseData,
  type RepairResult 
} from '@/lib/__admin__/databaseRepair';

interface DiagnosisResult {
  hasIssues: boolean;
  issues: string[];
  suggestions: string[];
}

export function DatabaseRepairTool() {
  const [isLoading, setIsLoading] = useState(false);
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);
  const [lastRepairResult, setLastRepairResult] = useState<RepairResult | null>(null);
  const [dbInfo, setDbInfo] = useState<{
    tables: string[];
    totalRecords: number;
  } | null>(null);

  // 诊断数据库状态
  const runDiagnosis = async () => {
    setIsLoading(true);
    try {
      const dbService = getDatabaseService();
      const db = dbService.getDbManager().getDatabase();
      
      // 获取基本信息
      type TableRow = { name: string };
      const tables = await db.select<TableRow>(
        `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
      );
      
      // 统计记录数
      let totalRecords = 0;
      for (const table of tables) {
        if (!table.name.startsWith('sqlite_')) {
          try {
            const countRows = await db.select<{ count: number }>(
              `SELECT COUNT(*) as count FROM ${table.name}`
            );
            totalRecords += countRows[0]?.count || 0;
          } catch (e) {
            // 忽略计数错误
          }
        }
      }
      
      setDbInfo({
        tables: tables.map(t => t.name),
        totalRecords
      });

      // 运行诊断
      const result = await diagnoseDatabaseIssues(db);
      setDiagnosis(result);
      
    } catch (error) {
      console.error('诊断失败:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isConnectionError = errorMessage.includes('connection on a closed pool') || 
                               errorMessage.includes('database connection') ||
                               errorMessage.includes('数据库未初始化');
      
      setDiagnosis({
        hasIssues: true,
        issues: [
          isConnectionError 
            ? '数据库连接异常: ' + errorMessage
            : '诊断过程中出现错误: ' + errorMessage
        ],
        suggestions: isConnectionError 
          ? ['刷新页面重新初始化数据库连接', '检查数据库文件是否损坏']
          : ['检查数据库连接和权限', '查看浏览器控制台了解详细错误信息']
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 执行修复
  const executeRepair = async (repairType: 'auto' | 'quick' | 'safe' | 'reset' | 'rebuild' | 'clear') => {
    setIsLoading(true);
    setLastRepairResult(null);
    
    try {
      const dbService = getDatabaseService();
      const db = dbService.getDbManager().getDatabase();
      let result: RepairResult;
      
      switch (repairType) {
        case 'auto':
          result = await autoRepairDatabase(db);
          break;
        case 'quick':
          result = await quickFix(db);
          break;
        case 'safe':
          result = await safeRepair(db);
          break;
        case 'reset':
          result = await resetDatabaseToVersion(db, 2);
          
          // 重置操作也可能影响连接，建议刷新
          if (result.success) {
            setLastRepairResult(result);
            setTimeout(() => {
              const shouldRefresh = window.confirm('数据库已重置到v2！\n\n建议刷新页面以确保应用状态正常。\n\n是否现在刷新？');
              if (shouldRefresh) {
                window.location.reload();
              }
            }, 1000);
            return;
          }
          break;
        case 'clear':
          const clearConfirmed = window.confirm('⚠️ 清空数据库数据\n\n- 所有对话记录将被删除\n- 所有知识库数据将被清空\n- 表结构将保留\n- 此操作无法撤销\n\n确定要继续吗？');
          if (!clearConfirmed) {
            setIsLoading(false);
            return;
          }
          result = await clearDatabaseData(db);
          break;
        case 'rebuild':
          const rebuildConfirmed = window.confirm('⚠️ 危险操作：这将删除所有数据并重建数据库！\n\n- 所有对话记录将被永久删除\n- 所有知识库数据将被清空\n- 此操作无法撤销\n- 数据库将从头重建\n\n确定要继续吗？');
          if (!rebuildConfirmed) {
            setIsLoading(false);
            return;
          }
          result = await rebuildDatabase(db);
          break;
        default:
          throw new Error('未知的修复类型');
      }
      
      setLastRepairResult(result);
      
      // 修复后重新诊断
      if (result.success) {
        setTimeout(runDiagnosis, 1000);
      }
      
    } catch (error) {
      console.error('修复失败:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // 检查是否是连接池关闭错误
      const isConnectionPoolError = errorMessage.includes('connection on a closed pool') || 
                                   errorMessage.includes('database connection');
      
      setLastRepairResult({
        success: false,
        message: isConnectionPoolError ? '数据库连接已断开，建议刷新页面重试' : '修复过程中出现错误',
        error: errorMessage,
        details: isConnectionPoolError ? [
          '检测到数据库连接池错误',
          '这通常发生在数据库重建操作后',
          '建议刷新页面重新初始化连接'
        ] : undefined
      });
      
      // 如果是连接池错误，自动提示刷新
      if (isConnectionPoolError) {
        setTimeout(() => {
          const shouldRefresh = window.confirm('检测到数据库连接异常！\n\n建议刷新页面重新初始化数据库连接。\n\n是否现在刷新？');
          if (shouldRefresh) {
            window.location.reload();
          }
        }, 1500);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 重新初始化数据库连接
  const reinitializeDatabase = async () => {
    setIsLoading(true);
    try {
      console.log('🔄 重新初始化数据库连接...');
      const dbService = getDatabaseService();
      
      // 关闭现有连接
      await dbService.close();
      
      // 重新初始化
      await dbService.initialize();
      
      setLastRepairResult({
        success: true,
        message: '数据库连接已重新初始化，建议刷新页面以确保完全重置',
        details: ['关闭旧连接', '创建新连接', '初始化完成', '建议刷新页面获得最佳效果']
      });
      
      // 提示用户刷新页面
      setTimeout(() => {
        const shouldRefresh = window.confirm('连接重新初始化成功！\n\n建议刷新页面以确保所有组件使用新连接。\n\n是否现在刷新？');
        if (shouldRefresh) {
          window.location.reload();
        } else {
          // 如果用户选择不刷新，至少重新诊断
          runDiagnosis();
        }
      }, 1000);
      
    } catch (error) {
      console.error('重新初始化失败:', error);
      setLastRepairResult({
        success: false,
        message: '重新初始化失败',
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 组件加载时自动诊断
  useEffect(() => {
    runDiagnosis();
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            数据库修复工具
          </CardTitle>
          <CardDescription>
            诊断和修复数据库状态不一致问题
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          
          {/* 数据库信息 */}
          {dbInfo && (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">表数量:</span>
                <Badge variant="outline">{dbInfo.tables.length}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">总记录数:</span>
                <Badge variant="outline">{dbInfo.totalRecords.toLocaleString()}</Badge>
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="grid grid-cols-2 gap-2">
            <Button 
              onClick={runDiagnosis} 
              disabled={isLoading}
              variant="outline"
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Settings className="h-4 w-4 mr-2" />
              )}
              {isLoading ? '诊断中...' : '重新诊断'}
            </Button>
            
            <Button 
              onClick={reinitializeDatabase} 
              disabled={isLoading}
              variant="secondary"
            >
              <Database className="h-4 w-4 mr-2" />
              重置连接
            </Button>
          </div>

          <Separator />

          {/* 诊断结果 */}
          {diagnosis && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {diagnosis.hasIssues ? (
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                )}
                <span className="font-medium">
                  {diagnosis.hasIssues ? '发现问题' : '状态正常'}
                </span>
              </div>

              {diagnosis.hasIssues && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-destructive">问题列表:</h4>
                  <ul className="space-y-1">
                    {diagnosis.issues.map((issue, index) => (
                      <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-destructive">•</span>
                        {issue}
                      </li>
                    ))}
                  </ul>
                  
                  <h4 className="text-sm font-medium text-blue-600 mt-3">建议解决方案:</h4>
                  <ul className="space-y-1">
                    {diagnosis.suggestions.map((suggestion, index) => (
                      <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-blue-600">→</span>
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <Separator />

          {/* 修复操作 */}
          {diagnosis?.hasIssues && (
            <div className="space-y-4">
              <h4 className="font-medium">修复操作</h4>
              
              <div className="grid grid-cols-1 gap-3">
                {/* 安全修复 */}
                <Button 
                  onClick={() => executeRepair('safe')} 
                  disabled={isLoading}
                  className="justify-start"
                  variant="default"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  安全修复 (推荐)
                </Button>
                
                {/* 快速修复 */}
                <Button 
                  onClick={() => executeRepair('quick')} 
                  disabled={isLoading}
                  className="justify-start"
                  variant="secondary"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  快速修复
                </Button>
                
                {/* 自动修复 */}
                <Button 
                  onClick={() => executeRepair('auto')} 
                  disabled={isLoading}
                  className="justify-start"
                  variant="outline"
                >
                  <Wrench className="h-4 w-4 mr-2" />
                  自动修复
                </Button>
              </div>

              <Separator />

              <div className="space-y-2">
                <h5 className="text-sm font-medium text-destructive">危险操作</h5>
                <div className="grid grid-cols-1 gap-2">
                  <Button 
                    onClick={() => executeRepair('clear')} 
                    disabled={isLoading}
                    className="justify-start"
                    variant="destructive"
                    size="sm"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    清空数据
                  </Button>
                  
                  <Button 
                    onClick={() => executeRepair('reset')} 
                    disabled={isLoading}
                    className="justify-start"
                    variant="destructive"
                    size="sm"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    重置到v2
                  </Button>
                  
                  <Button 
                    onClick={() => executeRepair('rebuild')} 
                    disabled={isLoading}
                    className="justify-start"
                    variant="destructive"
                    size="sm"
                  >
                    <Database className="h-4 w-4 mr-2" />
                    完全重建
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* 修复结果 */}
          {lastRepairResult && (
            <Alert className={lastRepairResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <AlertDescription>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {lastRepairResult.success ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="font-medium">{lastRepairResult.message}</span>
                  </div>
                  
                  {lastRepairResult.details && (
                    <div className="text-sm text-muted-foreground">
                      <p>执行步骤:</p>
                      <ul className="list-disc list-inside ml-2">
                        {lastRepairResult.details.map((detail, index) => (
                          <li key={index}>{detail}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {lastRepairResult.error && (
                    <div className="space-y-2">
                      <div className="text-sm text-red-600">
                        错误: {lastRepairResult.error}
                      </div>
                      {(lastRepairResult.error.includes('connection on a closed pool') || 
                        lastRepairResult.error.includes('database connection')) && (
                        <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
                          <p className="font-medium">💡 解决建议:</p>
                          <ul className="list-disc list-inside ml-2 mt-1">
                            <li>点击"重置连接"按钮重新初始化数据库连接</li>
                            <li>或者刷新页面重新加载应用</li>
                            <li>这通常发生在数据库重建操作后</li>
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* 表信息 */}
          {dbInfo && (
            <div className="space-y-2">
              <h5 className="text-sm font-medium">数据库表列表</h5>
              <div className="flex flex-wrap gap-1">
                {dbInfo.tables.map((table) => (
                  <Badge key={table} variant="outline" className="text-xs">
                    {table}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 