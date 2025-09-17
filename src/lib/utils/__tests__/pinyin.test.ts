import { containsChinese, toPinyin, generateSafeId, validateProviderName } from '../pinyin';

// 简单的测试函数
function testPinyinUtils() {
  console.log('=== 拼音转换工具测试 ===');
  
  // 测试中文检测
  console.log('containsChinese("Hello"):', containsChinese("Hello"));
  console.log('containsChinese("你好"):', containsChinese("你好"));
  console.log('containsChinese("Hello 世界"):', containsChinese("Hello 世界"));
  
  // 测试拼音转换
  console.log('\n=== 拼音转换测试 ===');
  console.log('toPinyin("你好世界"):', toPinyin("你好世界"));
  console.log('toPinyin("Hello 世界"):', toPinyin("Hello 世界"));
  console.log('toPinyin("我的提供商"):', toPinyin("我的提供商"));
  
  // 测试安全ID生成
  console.log('\n=== 安全ID生成测试 ===');
  console.log('generateSafeId("我的提供商"):', generateSafeId("我的提供商"));
  console.log('generateSafeId("My Provider"):', generateSafeId("My Provider"));
  console.log('generateSafeId("测试-API"):', generateSafeId("测试-API"));
  
  // 测试名称验证
  console.log('\n=== 名称验证测试 ===');
  console.log('validateProviderName("我的提供商"):', validateProviderName("我的提供商"));
  console.log('validateProviderName("My Provider"):', validateProviderName("My Provider"));
  console.log('validateProviderName("测试@API"):', validateProviderName("测试@API"));
  console.log('validateProviderName(""):', validateProviderName(""));
  console.log('validateProviderName("a"):', validateProviderName("a"));
}

// 如果直接运行此文件，执行测试
if (typeof window === 'undefined') {
  testPinyinUtils();
}

export { testPinyinUtils };

