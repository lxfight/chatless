#!/usr/bin/env node

/**
 * 开发工具：重置数据库
 * 清理所有providers配置，强制重新初始化
 */

import { StorageUtil } from '@/lib/storage';
import { defaultCacheManager } from '@/lib/cache/CacheManager';

async function resetDatabase() {
  console.log('🧹 开始重置数据库...');
  
  try {
    // 清理内存缓存
    await defaultCacheManager.clear();
    console.log('✅ 内存缓存已清理');
    
    // 删除providers配置文件
    await StorageUtil.removeItem('providers', 'providers-config.json');
    console.log('✅ providers配置文件已删除');
    
    // 删除模型配置文件
    await StorageUtil.removeItem('models', 'models-config.json');
    console.log('✅ models配置文件已删除');
    
    // 删除Ollama配置
    await StorageUtil.removeItem('ollama-config', 'ollama-config.json');
    console.log('✅ Ollama配置文件已删除');
    
    // 删除API密钥配置
    await StorageUtil.removeItem('api-keys', 'api-keys.json');
    console.log('✅ API密钥配置文件已删除');
    
    console.log('🎉 数据库重置完成！');
    console.log('💡 重启应用后，系统将重新初始化所有providers配置');
    
  } catch (error) {
    console.error('❌ 数据库重置失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  resetDatabase();
}

export { resetDatabase }; 