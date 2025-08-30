# 浏览器请求兜底功能

## 概述

浏览器请求兜底功能允许在Tauri HTTP请求被网络限制（如WAF、防火墙、代理）阻止时，自动切换到浏览器的原生`fetch`和`EventSource` API，以绕过这些限制。

## 功能特性

### ✅ 已实现功能

1. **统一的配置检查**
   - 基于Provider URL的智能匹配
   - 30秒缓存机制，提高性能
   - 支持精确URL匹配和前缀匹配

2. **HTTP请求兜底**
   - 自动检测Provider配置
   - 无缝切换到浏览器`fetch`
   - 保持完整的错误处理

3. **SSE连接兜底**
   - POST请求：使用Fetch ReadableStream
   - GET请求：使用原生EventSource
   - 完善的超时和错误处理

4. **用户界面**
   - 三个点菜单的高级设置
   - 直观的开关控制
   - 实时生效，无需重启

### 🎯 适用场景

- **网络限制环境**：企业防火墙、代理服务器
- **WAF拦截**：Web应用防火墙阻止特定客户端
- **CORS问题**：某些API的跨域访问限制
- **客户端指纹检测**：服务器识别并拒绝Tauri客户端

## 使用方法

### 启用浏览器请求方式

1. 打开设置页面
2. 进入"AI模型"设置
3. 展开需要配置的提供商
4. 点击服务地址右侧的"⋯"按钮
5. 勾选"浏览器请求方式"选项

### 验证配置生效

启用后，相关Provider的所有网络请求（模型拉取、流式聊天）都会使用浏览器API。

## 技术实现

### 核心文件

- `browser-fallback-utils.ts` - 核心工具库
- `request.ts` - HTTP请求兜底
- `sse-client.ts` - SSE连接兜底
- `useProviderManagement.ts` - 配置管理

### 架构设计

```typescript
// 1. 统一的配置检查
shouldUseBrowserRequest(url, context) → boolean

// 2. HTTP请求自动切换
tauriFetch(url) → browserFetch(url)  // 如果配置启用

// 3. SSE连接自动切换
SSEClient.startConnection() → startBrowserSSE()  // 如果配置启用
```

### 缓存机制

- **缓存时长**：30秒
- **缓存内容**：Provider配置精简版本
- **失效时机**：配置更新后自动失效

## 调试工具

### 开发者工具

```typescript
// 查看缓存状态
import { getCacheInfo } from '@/lib/provider/browser-fallback-utils';
console.log(getCacheInfo());

// 查看启用浏览器请求的Provider
import { getBrowserRequestProviders } from '@/lib/provider/browser-fallback-utils';
const providers = await getBrowserRequestProviders();

// 测试URL匹配逻辑
import { testUrlMatching } from '@/lib/provider/browser-fallback-utils';
const result = await testUrlMatching('https://api.example.com/v1/chat');
```

### 日志输出

启用浏览器请求方式后，控制台会显示：
```
[request] 检测到Provider "OpenAI" 启用浏览器请求方式
[OpenAIProvider] 启动浏览器SSE连接 (POST): https://api.openai.com/v1/chat/completions
```

## 注意事项

### 限制和约束

1. **CORS限制**
   - 浏览器`fetch`受同源策略限制
   - 某些API可能需要配置CORS头

2. **功能差异**
   - 浏览器请求无法使用某些Tauri特有功能
   - 代理设置可能不生效

3. **性能影响**
   - 首次请求需要检查Provider配置
   - 缓存机制减少后续性能损耗

### 最佳实践

1. **按需启用**：只在确实需要时启用
2. **测试验证**：启用后测试相关功能
3. **监控日志**：关注控制台输出，确认工作正常

## 故障排除

### 常见问题

1. **设置不生效**
   - 检查Provider URL配置是否正确
   - 确认缓存是否已刷新（30秒后自动刷新）

2. **CORS错误**
   - 某些API不支持浏览器跨域请求
   - 考虑联系API提供商配置CORS

3. **连接超时**
   - 浏览器SSE默认10秒超时
   - 检查网络连接和API可用性

### 调试步骤

1. 打开浏览器开发者工具
2. 查看Network标签页的请求
3. 检查Console的日志输出
4. 使用调试工具函数分析配置

## 更新日志

### v1.0.0 (当前版本)
- ✅ 实现基础的HTTP请求兜底
- ✅ 实现SSE连接兜底
- ✅ 添加Provider级别的配置管理
- ✅ 实现缓存机制提高性能
- ✅ 完善错误处理和日志记录

### 未来计划
- 🔄 支持更多HTTP客户端配置选项
- 🔄 添加网络请求性能监控
- 🔄 优化缓存策略和失效逻辑
