import { openPath } from '@tauri-apps/plugin-opener';
import { exists } from '@tauri-apps/plugin-fs';
import { toast } from 'sonner';
import { useState } from 'react';

/**
 * 文件打开工具类
 * 使用系统默认程序打开文档，提供最佳用户体验
 * 
 * 优势：
 * - 零维护成本，无需在应用内渲染文档
 * - 用户体验优秀，使用熟悉的系统程序
 * - 功能完整，支持所有系统支持的文档格式
 * - 代码量极少，仅需几行核心代码
 */
export class FileOpener {
  
  /**
   * 使用系统默认程序打开文件
   * @param filePath 文件路径
   * @param fileName 文件名（用于提示信息）
   * @returns Promise<boolean> 是否成功打开
   */
  static async openFile(filePath: string, fileName?: string): Promise<boolean> {
    try {
      // 检查文件是否存在
      const fileExists = await exists(filePath);
      if (!fileExists) {
        toast.error('文件不存在', {
          description: `无法找到文件: ${fileName || filePath}`
        });
        return false;
      }

      // 使用系统默认程序打开文件
      await openPath(filePath);
      
      toast.success('文档已打开', {
        description: `已使用系统默认程序打开: ${fileName || '文档'}`
      });
      
      return true;
    } catch (error) {
      console.error('打开文件失败:', error);
      
      toast.error('打开文件失败', {
        description: error instanceof Error 
          ? error.message 
          : '未知错误，请检查文件路径是否正确'
      });
      
      return false;
    }
  }
  
  /**
   * 检查文件是否存在
   * @param filePath 文件路径
   * @returns Promise<boolean> 文件是否存在
   */
  static async checkFileExists(filePath: string): Promise<boolean> {
    try {
      return await exists(filePath);
    } catch (error) {
      console.error('检查文件存在性失败:', error);
      return false;
    }
  }
  
  /**
   * 获取支持的文档类型说明
   * @returns 支持的文档类型列表
   */
  static getSupportedTypes(): string[] {
    return [
      'PDF (.pdf)',
      'Word文档 (.docx, .doc)',
      'Markdown文件 (.md, .markdown)', 
      '文本文件 (.txt)',
      '以及系统支持的其他格式'
    ];
  }

  /**
   * 打开文件所在的文件夹
   * @param filePath 文件路径
   * @returns Promise<boolean> 是否成功打开
   */
  static async openFileLocation(filePath: string): Promise<boolean> {
    try {
      // 获取文件所在目录
      const directory = filePath.substring(0, filePath.lastIndexOf('/') || filePath.lastIndexOf('\\'));
      
      await openPath(directory);
      
      toast.success('已打开文件位置');
      
      return true;
    } catch (error) {
      console.error('打开文件位置失败:', error);
      toast.error('无法打开文件位置');
      return false;
    }
  }

  /**
   * 获取支持的文件类型提示信息
   * @param fileType 文件类型
   * @returns 提示信息
   */
  static getFileTypeHint(fileType: string): string {
    const hints: Record<string, string> = {
      'pdf': '将使用系统默认的PDF阅读器打开',
      'docx': '将使用Word或兼容程序打开',
      'doc': '将使用Word或兼容程序打开', 
      'md': '将使用Markdown编辑器或文本编辑器打开',
      'markdown': '将使用Markdown编辑器或文本编辑器打开',
      'txt': '将使用文本编辑器打开',
      'xlsx': '将使用Excel或兼容程序打开',
      'pptx': '将使用PowerPoint或兼容程序打开'
    };
    
    return hints[fileType.toLowerCase()] || '将使用系统默认程序打开';
  }

  /**
   * 批量操作：打开多个文件
   * @param filePaths 文件路径数组
   * @param maxConcurrent 最大并发数，默认5
   */
  static async openMultipleFiles(
    filePaths: string[], 
    maxConcurrent: number = 5
  ): Promise<void> {
    if (filePaths.length === 0) return;
    
    if (filePaths.length > 10) {
      toast.warning('文件数量过多', {
        description: `您选择了${filePaths.length}个文件，建议分批打开`
      });
      return;
    }
    
    // 分批处理文件
    for (let i = 0; i < filePaths.length; i += maxConcurrent) {
      const batch = filePaths.slice(i, i + maxConcurrent);
      const promises = batch.map(path => this.openFile(path));
      
      await Promise.allSettled(promises);
      
      // 添加小延时避免系统过载
      if (i + maxConcurrent < filePaths.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  /**
   * 获取文件类型对应的系统程序信息
   * 用于在UI中显示提示信息
   */
  static getFileTypeInfo(filePath: string): { 
    extension: string; 
    description: string; 
    icon: string; 
  } {
    const extension = filePath.split('.').pop()?.toLowerCase() || '';
    
    const typeMap: Record<string, { description: string; icon: string }> = {
      'pdf': { description: 'PDF文档', icon: '📄' },
      'docx': { description: 'Word文档', icon: '📝' },
      'doc': { description: 'Word文档', icon: '📝' },
      'md': { description: 'Markdown文档', icon: '📑' },
      'markdown': { description: 'Markdown文档', icon: '📑' },
      'txt': { description: '文本文档', icon: '📄' },
      'rtf': { description: 'RTF文档', icon: '📄' },
      'odt': { description: 'OpenDocument文档', icon: '📄' },
    };

    return {
      extension,
      description: typeMap[extension]?.description || '文档',
      icon: typeMap[extension]?.icon || '📄'
    };
  }
}

/**
 * React Hook：文件打开功能
 * 提供加载状态和错误处理
 */
export function useFileOpener() {
  const [isOpening, setIsOpening] = useState(false);

  const openFile = async (filePath: string, fileName?: string) => {
    setIsOpening(true);
    try {
      const success = await FileOpener.openFile(filePath, fileName);
      return success;
    } finally {
      setIsOpening(false);
    }
  };

  return {
    openFile,
    isOpening
  };
} 