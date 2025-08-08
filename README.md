<div align="center">
  <img  src="public/logo.svg"/>
</div>



中文 | [English](README_EN.md)

# chatless – 现代AI聊天桌面应用

<p align="center">
  <img alt="状态" src="https://img.shields.io/badge/status-active-success?style=flat-square" />
  <a href="https://github.com/kamjin3086/chatless/blob/main/LICENSE">
    <img alt="许可证" src="https://img.shields.io/badge/license-MIT-green?style=flat-square" />
  </a>
  <img alt="版本" src="https://img.shields.io/badge/version-v0.1.0-blue?style=flat-square" />
  <img alt="平台" src="https://img.shields.io/badge/platform-cross--platform-orange?style=flat-square" />
  <img alt="技术栈" src="https://img.shields.io/badge/stack-Tauri%20%7C%20Next.js%20%7C%20Rust-purple?style=flat-square" />
</p>

> **chatless** 是一个基于Tauri和Next.js构建的现代、隐私优先的AI聊天桌面应用。连接多个AI提供商，通过Ollama在本地运行模型，并通过知识库集成与你的文档进行对话。所有数据都保存在你的设备上——你的对话保持私密。

---

## ✨ 主要功能
| 功能 | 描述 |
| --- | --- |
| **多AI提供商支持** | 连接OpenAI、Anthropic、DeepSeek等多个AI提供商 |
| **本地AI模型** | 通过Ollama集成在本地运行AI模型 |
| **知识库集成** | 上传文档并与你的数据进行对话 |
| **隐私优先设计** | 所有数据都存储在本地设备上 |
| **跨平台支持** | 支持Windows、macOS和Linux |
| **现代界面** | 基于Next.js 15和TailwindCSS 4构建 |

---


## 📸 界面预览  

![chatless截图](/docs/assets/screenshot-main1.png)

---

## 🚀 快速开始

### 🎯 最简单的方式
1. **下载安装** - 从 [Releases](https://github.com/kamjin3086/chatless/releases) 下载最新版本
2. **配置API** - 在设置中添加你的AI提供商API密钥
3. **开始聊天** - 选择模型，开始对话！

### 🛠️ 开发者构建
```bash
git clone https://github.com/kamjin3086/chatless.git
cd chatless
pnpm install
pnpm tauri dev
```

---

## 📝 使用说明
1. **配置AI提供商** – 在设置 → AI模型设置中添加你的API密钥
2. **设置本地模型** – 安装Ollama并下载模型进行本地处理
3. **创建知识库** – 上传文档以与你的数据进行对话
4. **开始聊天** – 选择你偏好的AI模型并开始对话
5. **管理历史记录** – 查看和组织你的聊天历史

---

## 待实现清单

- [ ] 支持添加任意提供商和添加模型
- [ ] http/sock5代理功能的完整支持
- [ ] 自动更新功能
- [ ] 系统提示词设置
- [ ] 会话标题生成
- [ ] 多语言支持
- [ ] 其他

---

## 🛠️ 技术栈

### 前端
- **框架**: [Next.js 15](https://nextjs.org/) + TypeScript
- **样式**: [TailwindCSS 4](https://tailwindcss.com/)
- **UI组件**: 自定义组件库

### 后端
- **桌面框架**: [Tauri 2.0](https://v2.tauri.app/) + Rust
- **数据库**: SQLite本地存储
- **文档处理**: 支持PDF、Word、Markdown和文本文件

### AI集成
- **多提供商支持**: OpenAI、Anthropic、DeepSeek等
- **本地模型**: Ollama集成
- **向量检索**: 自定义向量存储系统

---

## 🔧 配置说明

### AI提供商设置
1. 打开应用设置
2. 导航到"AI模型设置"
3. 添加你的API密钥
4. 选择默认模型

### 本地模型设置
```bash
# 安装Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# 下载模型
ollama pull llama2
ollama pull mistral
```

---

## 🔒 隐私与数据安全
* **本地数据存储** – 所有对话和文档都保存在你的设备上
* **无云端上传** – AI处理在本地或通过你配置的提供商进行
* **隐私优先设计** – 不收集或跟踪个人数据
* **开源透明** – 透明的代码库便于安全验证

---

## 💬 反馈与支持
| 渠道 | 链接 |
| --- | --- |
| GitHub Issues | <https://github.com/kamjin3086/chatless/issues> |
| 讨论区 | <https://github.com/kamjin3086/chatless/discussions> |
| 应用内反馈 | 应用内**设置 → 反馈** |

---

## 🤝 贡献指南

我们欢迎所有形式的贡献！

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

- [ort](https://ort.pyke.io/) - an open-source Rust binding for ONNX Runtime.

---

<p align="center">

**chatless** – 让AI聊天更简单，让生活更专注。

⭐ 如果这个项目对你有帮助，请给我们一个星标！

</p> 