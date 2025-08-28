"use client";

import { Button } from "@/components/ui/button";
import { SettingsDivider } from './SettingsDivider';
import { NetworkSettings } from "./NetworkSettings";
import { DatabaseService } from "@/lib/database/services/DatabaseService";
import { useState, useEffect } from "react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { startupMonitor } from "@/lib/utils/startupPerformanceMonitor";
import { downloadService } from "@/lib/utils/downloadService";
import { detectTauriEnvironment } from "@/lib/utils/environment";
// 在需要时动态导入 Tauri FS/Path API
import { toast } from "@/components/ui/sonner";

export function AdvancedSettings() {
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [logLevel, setLogLevelState] = useState<'none'|'error'|'warn'|'info'|'debug'>('info');
  const [logInfo, setLogInfo] = useState<string>('Tauri日志系统已启用，日志自动保存到系统日志目录');

  useEffect(() => {
    // 加载当前日志级别和日志信息
    setLogInfo('Tauri日志系统已启用，日志自动保存到系统日志目录');
  }, []);

  const checkMessages = async () => {
    setIsLoading(true);
    try {
      const dbService = DatabaseService.getInstance();
      await dbService.initialize();
      
      // 使用 DatabaseService 的 dbManager 执行查询
      const dbManager = dbService.getDbManager();
      const results = await dbManager.select(`
        SELECT 
          id,
          conversation_id,
          role,
          content,
          status,
          document_reference,
          context_data,
          created_at,
          updated_at
        FROM messages
        WHERE document_reference IS NOT NULL
        ORDER BY created_at DESC
      `);
      
      setMessages(results);
      console.log('Messages with document references:', results);
      
      // 检查每条消息的document_reference字段
      results.forEach((msg: any) => {
        console.log(`\nMessage ID: ${msg.id}`);
        console.log('Raw document_reference:', msg.document_reference);
        try {
          const parsed = JSON.parse(msg.document_reference);
          console.log('Parsed document_reference:', parsed);
        } catch (e) {
          console.log('Failed to parse document_reference:', e);
        }
      });
      
    } catch (error) {
      console.error('Error checking messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLevelChange = async (val:string) => {
    const lvl = val as 'none'|'error'|'warn'|'info'|'debug';
    setLogLevelState(lvl);
    console.log(`日志级别已设置为: ${lvl}`);
    setLogInfo('Tauri日志系统已启用，日志自动保存到系统日志目录');

    try {
      const isTauri = await detectTauriEnvironment();
      if (isTauri) {
        // 运行时调整后端日志等级，立即影响写入到文件的内容
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('set_log_level', { level: lvl });
        toast.success(`已应用日志级别: ${lvl}`);
      } else {
        // 浏览器环境仅更新前端显示
        toast.info(`已设置日志级别(浏览器环境): ${lvl}`);
      }
    } catch (e) {
      console.warn('设置日志级别失败:', e);
      toast.error('设置日志级别失败');
    }
  };

  const exportLogs = async () => {
    try {
      const isTauri = await detectTauriEnvironment();

      if (isTauri) {
        // 动态导入 Tauri FS API
        const { readDir, readTextFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');

        // 递归收集日志文件（兼容日志保存在子目录的情况）
        const collectLogFiles = async (dir: string): Promise<string[]> => {
          const files: string[] = [];
          const list = await readDir(dir, { baseDir: BaseDirectory.AppLog });
          for (const entry of list) {
            const name = entry.name as string | undefined;
            if (!name) continue;
            if ((entry as any).isDirectory) {
              const subDir = dir ? `${dir}/${name}` : name;
              const subFiles = await collectLogFiles(subDir);
              files.push(...subFiles);
            } else {
              // 仅收集常见日志扩展名；未知扩展也尝试收集以防插件文件名无扩展
              if (name.endsWith('.log') || name.endsWith('.txt') || !name.includes('.')) {
                const fullPath = dir ? `${dir}/${name}` : name;
                files.push(fullPath);
              }
            }
          }
          return files;
        };

        const logFilePaths = await collectLogFiles('');
        if (!logFilePaths || logFilePaths.length === 0) {
          toast.error('未找到日志文件');
          return;
        }

        // 排序：文件名降序（通常包含时间戳/序号）
        logFilePaths.sort((a, b) => b.localeCompare(a));

        // 合并内容
        let combined = '';
        for (const relPath of logFilePaths) {
          try {
            const content = await readTextFile(relPath, { baseDir: BaseDirectory.AppLog });
            combined += `\n===== ${relPath} =====\n`;
            combined += content;
            combined += '\n';
          } catch (e) {
            console.warn('读取日志文件失败:', relPath, e);
          }
        }

        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const fileName = `chatless-logs-${timestamp}.txt`;

        const success = await downloadService.downloadText(fileName, combined);
        if (success) {
          toast.success('日志已导出');
        } else {
          toast.error('导出日志失败');
        }
      } else {
        // 非 Tauri 环境：导出说明
        const logInfo = `日志系统信息：\nTauri日志系统已启用\n\n日志已自动保存到系统日志目录。\n当前日志级别: ${logLevel}\n导出时间: ${new Date().toLocaleString()}\n`;
        const fileName = `chatless-log-description-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
        const success = await downloadService.downloadText(fileName, logInfo);
        if (success) {
          toast.success('日志信息已导出');
        } else {
          toast.error('导出日志信息失败');
        }
      }
    } catch (error) {
      console.error('导出日志信息失败:', error);
      toast.error('导出日志信息失败');
    }
  };

  const exportPerformanceReport = async () => {
    try {
      const report = startupMonitor.exportReport();
      const fileName = `performance-report-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
      const success = await downloadService.downloadText(fileName, report);
      
      if (success) {
        toast.success('性能报告已导出');
      } else {
        toast.error('导出性能报告失败');
      }
    } catch (error) {
      console.error('导出性能报告失败:', error);
      toast.error('导出性能报告失败');
    }
  };

  return (
    <div className="space-y-4">
       <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">高级设置</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">在此设置高级选项，部分设置请谨慎修改，包括日志系统、性能报告等。</p>
      </div>  

      {/* 网络设置 */}
      <NetworkSettings />

      <SettingsDivider />

      <div>
        <h3 className="text-base font-medium text-gray-800 dark:text-gray-200 mb-4">日志系统</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">日志级别:</span>
            <Select value={logLevel} onValueChange={handleLevelChange}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="级别" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">无</SelectItem>
                <SelectItem value="error">错误</SelectItem>
                <SelectItem value="warn">警告</SelectItem>
                <SelectItem value="info">信息 +</SelectItem>
                <SelectItem value="debug">调试 (最详细)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={exportLogs}
              size="sm"
              className="text-sm"
            >
              导出日志信息
            </Button>
            <Button 
              variant="outline" 
              onClick={exportPerformanceReport}
              size="sm"
              className="text-sm"
            >
              导出性能报告
            </Button>
          </div>
        </div>
      </div>

    </div>
  );
} 