/**
 * 启动性能监测工具
 * 用于跟踪应用启动过程中各个阶段的耗时
 */

export interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  children?: PerformanceMetric[];
  metadata?: Record<string, any>;
}

export interface StartupPerformanceReport {
  totalDuration: number;
  phases: PerformanceMetric[];
  bottlenecks: PerformanceMetric[];
  recommendations: string[];
  timestamp: number;
}

class StartupPerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private currentPhase: string | null = null;
  private phaseStack: string[] = [];
  // 在生产环境也启用监控；仅在开发环境输出控制台日志
  private isEnabled = true;

  private shouldLog(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  /**
   * 开始监测一个阶段
   */
  startPhase(name: string, metadata?: Record<string, any>): void {
    if (!this.isEnabled) return;

    const startTime = performance.now();
    const metric: PerformanceMetric = {
      name,
      startTime,
      children: [],
      metadata
    };

    this.metrics.set(name, metric);
    this.currentPhase = name;
    this.phaseStack.push(name);

    if (this.shouldLog()) {
      console.log(`🚀 [PERF] 开始阶段: ${name}`);
    }
  }

  /**
   * 结束当前阶段
   */
  endPhase(name?: string): void {
    if (!this.isEnabled) return;

    const phaseName = name || this.currentPhase;
    if (!phaseName) return;

    const metric = this.metrics.get(phaseName);
    if (!metric) return;

    metric.endTime = performance.now();
    metric.duration = metric.endTime - metric.startTime;

    // 从栈中移除
    const index = this.phaseStack.indexOf(phaseName);
    if (index > -1) {
      this.phaseStack.splice(index, 1);
    }

    // 更新当前阶段
    this.currentPhase = this.phaseStack[this.phaseStack.length - 1] || null;

    if (this.shouldLog()) {
      console.log(`✅ [PERF] 完成阶段: ${phaseName} (${metric.duration.toFixed(2)}ms)`);
    }
  }

  /**
   * 添加子阶段
   */
  addSubPhase(parentName: string, subPhaseName: string, duration: number, metadata?: Record<string, any>): void {
    if (!this.isEnabled) return;

    const parent = this.metrics.get(parentName);
    if (!parent) return;

    const subPhase: PerformanceMetric = {
      name: subPhaseName,
      startTime: parent.startTime,
      endTime: parent.startTime + duration,
      duration,
      metadata
    };

    parent.children = parent.children || [];
    parent.children.push(subPhase);

    if (this.shouldLog()) {
      console.log(`📊 [PERF] 子阶段: ${parentName} > ${subPhaseName} (${duration.toFixed(2)}ms)`);
    }
  }

  /**
   * 标记关键时间点
   */
  mark(name: string, metadata?: Record<string, any>): void {
    if (!this.isEnabled) return;

    const time = performance.now();
    if (this.shouldLog()) {
      console.log(`📍 [PERF] 标记: ${name} (${time.toFixed(2)}ms)`, metadata);
    }
  }

  /**
   * 生成性能报告
   */
  generateReport(): StartupPerformanceReport {
    const phases = Array.from(this.metrics.values())
      .filter(metric => metric.duration !== undefined)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0));

    const totalDuration = phases.reduce((sum, phase) => sum + (phase.duration || 0), 0);
    
    // 识别瓶颈（耗时超过100ms的阶段）
    const bottlenecks = phases.filter(phase => (phase.duration || 0) > 100);

    // 生成建议
    const recommendations = this.generateRecommendations(phases, bottlenecks, totalDuration);

    const report: StartupPerformanceReport = {
      totalDuration,
      phases,
      bottlenecks,
      recommendations,
      timestamp: Date.now()
    };

    return report;
  }

  /**
   * 生成优化建议
   */
  private generateRecommendations(phases: PerformanceMetric[], bottlenecks: PerformanceMetric[], totalDuration: number): string[] {
    const recommendations: string[] = [];

    if (bottlenecks.length > 0) {
      recommendations.push(`发现 ${bottlenecks.length} 个性能瓶颈，建议优先优化`);
      
      bottlenecks.forEach(bottleneck => {
        if (bottleneck.name.includes('数据库')) {
          recommendations.push(`- ${bottleneck.name}: 考虑异步化或缓存优化`);
        } else if (bottleneck.name.includes('加载')) {
          recommendations.push(`- ${bottleneck.name}: 考虑并行加载或懒加载`);
        } else if (bottleneck.name.includes('初始化')) {
          recommendations.push(`- ${bottleneck.name}: 考虑延迟初始化`);
        }
      });
    }

    if (totalDuration > 500) {
      recommendations.push('总启动时间超过500ms，建议进一步优化');
    }

    return recommendations;
  }

  /**
   * 打印性能报告
   */
  printReport(): void {
    if (!this.isEnabled) return;

    const report = this.generateReport();
    
    if (!this.shouldLog()) return;

    console.group('📊 启动性能报告');
    console.log(`总耗时: ${report.totalDuration.toFixed(2)}ms`);
    console.log(`阶段数: ${report.phases.length}`);
    console.log(`瓶颈数: ${report.bottlenecks.length}`);
    
    if (report.phases.length > 0) {
      console.group('各阶段耗时:');
      report.phases.forEach(phase => {
        const percentage = ((phase.duration || 0) / report.totalDuration * 100).toFixed(1);
        console.log(`${phase.name}: ${phase.duration?.toFixed(2)}ms (${percentage}%)`);
      });
      console.groupEnd();
    }

    if (report.recommendations.length > 0) {
      console.group('优化建议:');
      report.recommendations.forEach(rec => console.log(`- ${rec}`));
      console.groupEnd();
    }

    console.groupEnd();
  }

  /**
   * 导出性能报告为文本格式
   */
  exportReport(): string {
    const report = this.generateReport();
    
    let output = '';
    output += '='.repeat(60) + '\n';
    output += '🚀 应用启动性能报告\n';
    output += '='.repeat(60) + '\n';
    output += `生成时间: ${new Date(report.timestamp).toLocaleString()}\n`;
    output += `总耗时: ${report.totalDuration.toFixed(2)}ms\n`;
    output += `阶段数: ${report.phases.length}\n`;
    output += `瓶颈数: ${report.bottlenecks.length}\n\n`;
    
    if (report.bottlenecks.length > 0) {
      output += '⚠️ 性能瓶颈:\n';
      output += '-'.repeat(30) + '\n';
      report.bottlenecks.forEach((bottleneck, index) => {
        const percentage = ((bottleneck.duration || 0) / report.totalDuration * 100).toFixed(1);
        output += `${index + 1}. ${bottleneck.name}: ${bottleneck.duration?.toFixed(2)}ms (${percentage}%)\n`;
      });
      output += '\n';
    }
    
    output += '📊 各阶段耗时详情:\n';
    output += '-'.repeat(30) + '\n';
    report.phases.forEach((phase, index) => {
      const percentage = ((phase.duration || 0) / report.totalDuration * 100).toFixed(1);
      output += `${index + 1}. ${phase.name}: ${phase.duration?.toFixed(2)}ms (${percentage}%)\n`;
      
      // 如果有子阶段，也显示出来
      if (phase.children && phase.children.length > 0) {
        phase.children.forEach((child, childIndex) => {
          const childPercentage = ((child.duration || 0) / report.totalDuration * 100).toFixed(1);
          output += `   ${index + 1}.${childIndex + 1}. ${child.name}: ${child.duration?.toFixed(2)}ms (${childPercentage}%)\n`;
        });
      }
    });
    output += '\n';
    
    if (report.recommendations.length > 0) {
      output += '💡 优化建议:\n';
      output += '-'.repeat(30) + '\n';
      report.recommendations.forEach((rec, index) => {
        output += `${index + 1}. ${rec}\n`;
      });
      output += '\n';
    }
    
    output += '📋 系统信息:\n';
    output += '-'.repeat(30) + '\n';
    output += `用户代理: ${navigator.userAgent}\n`;
    output += `平台: ${navigator.platform}\n`;
    output += `语言: ${navigator.language}\n`;
    output += `在线状态: ${navigator.onLine ? '在线' : '离线'}\n`;
    output += `内存信息: ${(performance as any).memory ? 
      `已用: ${Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024)}MB, 总计: ${Math.round((performance as any).memory.totalJSHeapSize / 1024 / 1024)}MB` : 
      '不可用'}\n`;
    
    // 添加更多系统信息
    output += '\n🖥️ 硬件信息:\n';
    output += '-'.repeat(30) + '\n';
    output += `CPU核心数: ${navigator.hardwareConcurrency || '未知'}\n`;
    
    // 改进内存检测
    let memoryInfo = '未知';
    if ((navigator as any).deviceMemory) {
      memoryInfo = `${(navigator as any).deviceMemory}GB`;
    } else if ((performance as any).memory) {
      const mem = (performance as any).memory;
      const totalGB = Math.round(mem.jsHeapSizeLimit / 1024 / 1024 / 1024);
      memoryInfo = `${totalGB}GB (JS堆限制)`;
    }
    output += `设备内存: ${memoryInfo}\n`;
    output += `注意: 内存信息可能不准确，受浏览器API限制\n`;
    
    // 尝试获取CPU型号（通过User Agent解析）
    let cpuInfo = '未知';
    const userAgent = navigator.userAgent;
    
    // 简化的CPU检测 - 只基于平台信息
    if (navigator.platform) {
      if (navigator.platform.includes('Win32')) {
        cpuInfo = 'Windows x86_64';
      } else if (navigator.platform.includes('MacIntel')) {
        cpuInfo = 'Mac Intel';
      } else if (navigator.platform.includes('MacARM')) {
        cpuInfo = 'Mac ARM';
      } else if (navigator.platform.includes('Linux')) {
        cpuInfo = 'Linux x86_64';
      } else {
        cpuInfo = navigator.platform;
      }
    }
    
    // 如果平台信息也无法获取，则显示为未知
    if (cpuInfo === '未知') {
      cpuInfo = '无法检测';
    }
    
    output += `CPU类型: ${cpuInfo}\n`;
    output += `注意: CPU信息可能不准确，受浏览器API限制\n`;
    
    output += `连接类型: ${(navigator as any).connection ? (navigator as any).connection.effectiveType || '未知' : '未知'}\n`;
    
    output += '\n📱 屏幕信息:\n';
    output += '-'.repeat(30) + '\n';
    output += `屏幕分辨率: ${screen.width}x${screen.height}\n`;
    output += `可用屏幕: ${screen.availWidth}x${screen.availHeight}\n`;
    output += `颜色深度: ${screen.colorDepth}位\n`;
    output += `像素密度: ${window.devicePixelRatio || 1}\n`;
    output += `视口大小: ${window.innerWidth}x${window.innerHeight}\n`;
    
    // 添加更多屏幕信息
    output += `窗口大小: ${window.outerWidth}x${window.outerHeight}\n`;
    output += `缩放比例: ${window.devicePixelRatio || 1}\n`;
    
    // 尝试获取真实分辨率（考虑缩放）
    const realWidth = Math.round(screen.width * (window.devicePixelRatio || 1));
    const realHeight = Math.round(screen.height * (window.devicePixelRatio || 1));
    output += `实际分辨率: ${realWidth}x${realHeight}\n`;
    
    output += '\n🌐 浏览器信息:\n';
    output += '-'.repeat(30) + '\n';
    output += `Cookie启用: ${navigator.cookieEnabled ? '是' : '否'}\n`;
    output += `Do Not Track: ${navigator.doNotTrack || '未设置'}\n`;
    output += `地理位置: ${navigator.geolocation ? '支持' : '不支持'}\n`;
    output += `WebGL支持: ${(() => {
      try {
        const canvas = document.createElement('canvas');
        return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
      } catch (e) {
        return '检测失败';
      }
    })()}\n`;
    
    output += '\n⏰ 时间信息:\n';
    output += '-'.repeat(30) + '\n';
    output += `时区: ${Intl.DateTimeFormat().resolvedOptions().timeZone}\n`;
    output += `时区偏移: ${new Date().getTimezoneOffset()}分钟\n`;
    output += `本地时间: ${new Date().toLocaleString()}\n`;
    output += `UTC时间: ${new Date().toISOString()}\n`;
    
    output += '\n🔧 应用信息:\n';
    output += '-'.repeat(30) + '\n';
    output += `应用版本: ${process.env.NODE_ENV || '未知'}\n`;
    output += `构建模式: ${process.env.NODE_ENV === 'development' ? '开发模式' : '生产模式'}\n`;
    output += `页面URL: ${window.location.href}\n`;
    output += `页面标题: ${document.title}\n`;
    output += `页面加载时间: ${performance.timing ? 
      `${performance.timing.loadEventEnd - performance.timing.navigationStart}ms` : 
      '不可用'}\n`;
    
    // 添加性能指标
    output += '\n📊 性能指标:\n';
    output += '-'.repeat(30) + '\n';
    if (performance.timing) {
      const timing = performance.timing;
      output += `DNS查询: ${timing.domainLookupEnd - timing.domainLookupStart}ms\n`;
      output += `TCP连接: ${timing.connectEnd - timing.connectStart}ms\n`;
      output += `请求响应: ${timing.responseEnd - timing.requestStart}ms\n`;
      output += `DOM解析: ${timing.domContentLoadedEventEnd - timing.domContentLoadedEventStart}ms\n`;
      output += `页面加载: ${timing.loadEventEnd - timing.loadEventStart}ms\n`;
    } else {
      output += '性能指标: 不可用\n';
    }
    
    // 添加存储信息
    output += '\n💾 存储信息:\n';
    output += '-'.repeat(30) + '\n';
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      output += '存储API: 支持\n';
      // 注意：由于异步限制，存储配额信息无法在同步报告中显示
      // 如需完整存储信息，请查看浏览器开发者工具
    } else {
      output += '存储API: 不支持\n';
    }
    
    // 添加本地存储信息
    try {
      const localStorageSize = JSON.stringify(localStorage).length;
      const sessionStorageSize = JSON.stringify(sessionStorage).length;
      output += `本地存储大小: ${Math.round(localStorageSize / 1024)}KB\n`;
      output += `会话存储大小: ${Math.round(sessionStorageSize / 1024)}KB\n`;
    } catch (e) {
      output += '本地存储信息: 无法获取\n';
    }
    
    output += '='.repeat(60) + '\n';
    output += '报告结束\n';
    output += '='.repeat(60) + '\n';
    
    return output;
  }

  /**
   * 重置监测器
   */
  reset(): void {
    this.metrics.clear();
    this.currentPhase = null;
    this.phaseStack = [];
  }

  /**
   * 启用/禁用监测
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }
}

// 创建全局实例
export const startupMonitor = new StartupPerformanceMonitor();

// 在开发环境中暴露到全局
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).startupMonitor = startupMonitor;
  console.log('🔍 启动性能监测器已加载');
  console.log('使用方法:');
  console.log('  startupMonitor.printReport() - 打印性能报告');
  console.log('  startupMonitor.reset() - 重置监测器');
} 