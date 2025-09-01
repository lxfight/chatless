<div align="center">
  <img  src="public/logo.svg"/>
</div>


<h1 align="center">
  chatless – 现代AI聊天桌面应用
</h1>

<p align="center">
  <img alt="状态" src="https://img.shields.io/badge/status-active-success?style=flat-square" />
  <a href="https://github.com/kamjin3086/chatless/blob/main/LICENSE">
    <img alt="许可证" src="https://img.shields.io/badge/license-MIT-green?style=flat-square" />
  </a>
  <img alt="版本" src="https://img.shields.io/badge/version-v0.1.0-blue?style=flat-square" />
  <img alt="平台" src="https://img.shields.io/badge/platform-cross--platform-orange?style=flat-square" />
  <img alt="技术栈" src="https://img.shields.io/badge/stack-Tauri%20%7C%20Next.js%20%7C%20Rust-purple?style=flat-square" />
</p>

> **chatless** 是一个基于Tauri和Next.js构建的AI聊天桌面应用。支持多种AI提供商，可连接Ollama本地模型，支持文档解析和知识库功能。所有数据本地存储，保护用户隐私。应用轻量简洁、启动快速、资源占用少。

---

**中文 | [English](README_EN.md)**

---

## ✨ 主要功能

| 功能 | 描述 |
| --- | --- |
| **多AI提供商支持** | 支持OpenAI、Anthropic、DeepSeek、Gemini、Claude等 |
| **本地AI模型** | 通过Ollama集成运行本地模型 |
| **文档解析** | 支持PDF、Word、Markdown等格式文档解析 |
| **图片解析** | 支持Vision模型进行图片分析 |
| **知识库集成** | 上传文档构建本地知识库 |
| **跨平台支持** | 支持Windows、macOS和Linux |
| **简洁界面** | 基于React和TailwindCSS构建，界面简洁易用 |
| **轻量性能** | 安装包小、启动快、内存占用低 |

---

## 📸 界面预览

![chatless截图](/docs/assets/screenshot-main1.png)

---

## 🚀 快速开始

### 🎯 安装使用

#### 📥 下载安装
点击对应链接进入下载页面，选择适合您系统的安装包：

- **Windows**: [Chatless 安装包](https://github.com/kamjin3086/chatless/releases/latest) - 选择 .exe 或 .msi 文件
- **macOS**: [Chatless for macOS](https://github.com/kamjin3086/chatless/releases/latest) - 根据处理器选择 aarch64 或 x64 版本
- **Linux**: [Chatless for Linux](https://github.com/kamjin3086/chatless/releases/latest) - 选择适合您发行版的 .rpm、.deb 或 .AppImage 文件

> 📖 **详细安装说明**: 查看 [完整安装指南](INSTALLATION_INSTRUCTIONS.md) 获取详细的安装步骤和常见问题解决方案

#### ⚙️ 配置设置
1. **配置AI提供商** - 在设置中添加API密钥
2. **设置本地模型** - 安装Ollama并下载模型（可选）
3. **开始使用** - 选择模型开始对话或上传文档

### 🛠️ 开发者构建
```bash
git clone https://github.com/kamjin3086/chatless.git
cd chatless
pnpm install
pnpm tauri dev
```

---

## 📝 使用说明

### 🚀 首次使用
1. **配置AI提供商** – 在设置中添加API密钥，支持OpenAI、Anthropic、DeepSeek等
2. **设置本地模型** – 安装Ollama并下载模型（可选，适合离线使用）
3. **创建知识库** – 上传PDF、Word、Markdown等文档构建本地知识库

### 💬 日常使用
4. **开始对话** – 选择AI模型开始智能对话
5. **文档分析** – 上传图片或文档进行分析和问答
6. **管理历史** – 查看和管理对话记录，支持搜索和导出

---

## ⚠️ Windows 闪退问题（需要 VC++ 运行库）

部分 Windows 环境可能因缺少 Microsoft Visual C++ 运行库而出现启动即退出/闪退。可按以下步骤修复：

1. 下载并安装最新的 Microsoft Visual C++ 2015–2022 Redistributable (x64)：
   - 直接下载链接：<https://aka.ms/vs/17/release/vc_redist.x64.exe>
2. 安装完成后重启应用（必要时重启系统）。
3. 若仍有问题：
   - 在「设置 → 应用 → 已安装的应用」中搜索“Visual C++ 2015-2022 Redistributable (x64)”确认已安装。
   - 通过应用内「设置 → 反馈」提交日志与问题描述。

说明：应用依赖的原生库（如 Tauri/ONNX 等）在 Windows 上需要 MSVC 运行库支持，缺失时可能导致闪退。

 感谢`@ukhack`，在 https://github.com/kamjin3086/chatless/issues/23#issuecomment-3203662395 提供该方法

---

## 🎯 开发计划

详细查看 [Project](https://github.com/users/kamjin3086/projects/1)

---

## 🛠️ 技术栈

- **前端**: Next.js 15 + TypeScript + TailwindCSS
- **后端**: Tauri 2.0 + Rust
- **数据库**: SQLite
- **AI集成**: 多提供商支持 + Ollama本地模型

---

## 🔧 配置说明

### 🤖 AI提供商设置
1. 打开应用设置（快捷键：`Ctrl/Cmd + ,`）
2. 进入"AI模型设置"选项卡
3. 点击"添加提供商"，输入API密钥
4. 选择默认模型并测试连接

> 💡 **提示**: 支持多种AI提供商，可以同时配置多个，根据需要切换使用

### 🏠 本地模型设置（可选）
如果您希望离线使用或保护隐私，可以配置本地模型：

```bash
# 1. 安装Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# 2. 下载常用模型
ollama pull llama2:7b      # 7B参数模型，适合一般对话
ollama pull mistral:7b     # Mistral模型，性能优秀
ollama pull qwen:7b        # 通义千问模型，中文支持好

# 3. 在应用设置中配置Ollama地址（默认：http://localhost:11434）
```

> 🔒 **隐私优势**: 本地模型确保所有对话数据不会离开您的设备

---

## 🔒 隐私与安全

* **本地数据存储** – 所有对话和文档保存在本地设备
* **无数据上传** – 不向云端上传任何数据
* **开源透明** – 代码开源，可验证安全性
* **隐私保护** – 不收集用户个人信息

---

## 💬 反馈与支持

我们非常重视您的反馈和建议！如果您在使用过程中遇到问题或有改进建议，欢迎通过以下渠道联系我们：

| 渠道 | 说明 | 链接 |
| --- | --- | --- |
| 🐛 **GitHub Issues** | 报告Bug、功能请求、问题反馈 | [提交Issue](https://github.com/kamjin3086/chatless/issues) |
| 💭 **讨论区** | 功能讨论、使用交流、社区互动 | [参与讨论](https://github.com/kamjin3086/chatless/discussions) |
| 📱 **应用内反馈** | 快速反馈、日志提交、问题描述 | 应用内**设置 → 反馈** |

> 💡 **反馈建议**: 提交问题时请尽可能详细描述问题现象、操作步骤和系统环境，这样我们能更快地帮助您解决问题

---

## 🤝 贡献指南

欢迎所有形式的贡献！

### 如何贡献
1. Fork这个项目
2. 创建你的功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个Pull Request

---

## 📜 许可证

本项目采用MIT许可证 - 查看[LICENSE](LICENSE)文件了解详情。

---

## 🙏 致谢

- [Tauri](https://tauri.app/) – 跨平台桌面应用框架
- [Next.js](https://nextjs.org/) – React全栈框架
- [TailwindCSS](https://tailwindcss.com/) – 实用优先的CSS框架
- [Ollama](https://ollama.ai/) – 本地大语言模型运行时
- [ort](https://ort.pyke.io/) - ONNX Runtime的Rust绑定

---

<p align="center">

**chatless** – 简洁易用的AI聊天应用 ✨

⭐ 如果这个项目对你有帮助，请给我们一个星标！

</p> 
