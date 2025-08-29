# Tauri HTTP 客户端问题解决方案

## 问题背景
部分接口在通过 Tauri HTTP 插件访问时提示 `error sending request for url`，而相同参数在浏览器 fetch 和 Postman 中正常工作。根据分析报告，这是由于 WAF（Web应用防火墙）对客户端指纹识别导致的。

## 解决方案概览

我们实现了一个循序渐进的解决方案，包括：

1. **统一的 HTTP 客户端管理器**
2. **浏览器模拟的请求头配置**  
3. **增强的开发工具界面**
4. **TLS 后端切换选项**

## 具体实现

### 1. 统一 HTTP 客户端管理器 (`src-tauri/src/lib/http_client.rs`)

创建了三种预配置的客户端：
- **default**: 最小配置的客户端
- **browser_like**: 浏览器模拟客户端（推荐）
- **http1_only**: 强制 HTTP/1.1 的客户端

浏览器模拟客户端包含完整的浏览器请求头：
- User-Agent (Chrome 120)
- Accept headers
- Sec-Fetch headers
- Chrome Client Hints

### 2. 自定义 HTTP 请求命令 (`src-tauri/src/lib/http_request.rs`)

提供了绕过默认 Tauri HTTP 插件的直接请求方式：
- 支持选择不同客户端类型
- 完整的错误处理和响应解析
- 详细的性能和调试信息

### 3. 增强的开发工具界面

在 `src/components/devtools/HttpRequestDebugger.tsx` 中添加了：
- 客户端类型选择器
- 客户端信息显示
- 单个客户端测试按钮
- 对比测试所有客户端的功能

### 4. TLS 后端切换配置

在 `src-tauri/Cargo.toml` 中提供了切换到 native-tls 的配置注释，用于解决 TLS 指纹识别问题。

## 使用方法

### 日常开发
1. 启动开发服务器：`pnpm tauri dev`
2. 访问 Dev Tools -> HTTP 页面
3. 输入要测试的 URL
4. 选择 "浏览器模拟" 客户端类型
5. 发送请求或使用对比测试功能

### 解决特定问题
1. **基础问题**：使用 "浏览器模拟" 客户端
2. **协议问题**：尝试 "HTTP/1.1 专用" 客户端  
3. **TLS指纹问题**：在 Cargo.toml 中切换到 native-tls

### 切换到 native-tls
编辑 `src-tauri/Cargo.toml`，注释掉当前的 reqwest 配置，启用 native-tls 版本：

```toml
# reqwest = { version = "0.12", features = ["stream"] }
reqwest = { version = "0.12", default-features = false, features = ["json", "native-tls", "stream"] }
```

然后重新编译：
```bash
cd src-tauri
cargo clean
cargo build
```

## API 命令

新增的 Tauri 命令：
- `get_http_client_info()`: 获取客户端配置信息
- `test_http_client(url, client_type)`: 测试单个客户端
- `compare_http_clients(url)`: 对比所有客户端类型
- `send_http_request(params)`: 发送自定义 HTTP 请求

## 调试流程

1. 使用 "对比所有客户端" 功能快速识别问题
2. 查看控制台日志了解详细的请求/响应信息
3. 根据错误类型选择对应的解决方案：
   - `connection_rejected` → 尝试浏览器模拟或 HTTP/1.1
   - `timeout` → 检查网络或增加超时时间
   - 其他错误 → 考虑切换 TLS 后端

## 预期效果

- **减少 WAF 拦截**：浏览器模拟请求头显著降低被识别为机器人的概率
- **统一客户端管理**：避免重复创建客户端实例，提升性能
- **完善的调试工具**：便于快速定位和解决网络请求问题
- **多层解决方案**：从简单的请求头模拟到深层的 TLS 后端切换

## 性能优势

- 连接复用：共享客户端实例避免重复的 TLS 握手
- 请求缓存：减少不必要的 DNS 查询和连接建立
- 统一配置：集中管理超时、重试等策略

这个解决方案遵循了报告中建议的循序渐进策略，首先尝试简单的浏览器模拟，在需要时可以进一步升级到 TLS 后端切换。
