<div align="center">
  <img  src="public/logo.svg"/>
</div>

<h1 align="center">
  chatless – Modern AI Chat Desktop Application
</h1>

<p align="center">
  <img alt="Status" src="https://img.shields.io/badge/status-active-success?style=flat-square" />
  <a href="https://github.com/kamjin3086/chatless/blob/main/LICENSE">
    <img alt="License" src="https://img.shields.io/badge/license-MIT-green?style=flat-square" />
  </a>
  <img alt="Version" src="https://img.shields.io/badge/version-v0.1.0-blue?style=flat-square" />
  <img alt="Platform" src="https://img.shields.io/badge/platform-cross--platform-orange?style=flat-square" />
  <img alt="Stack" src="https://img.shields.io/badge/stack-Tauri%20%7C%20Next.js%20%7C%20Rust-purple?style=flat-square" />
</p>

> **chatless** is an AI chat desktop application built with Tauri and Next.js. Supports multiple AI providers, connects to Ollama local models, and features document parsing and knowledge base functionality. All data is stored locally, protecting user privacy. The application is lightweight, fast to start, and uses minimal resources.

---

**English | [中文](README.md)**

---

## ✨ Key Features

| Feature | Description |
| --- | --- |
| Multi-AI Providers | Built-in adapters for OpenAI, Anthropic, DeepSeek, Gemini and other cloud models; switch with one click |
| Local Models | Run Llama2, Mistral, Qwen and other offline models via Ollama / LM Studio; works offline |
| Document & Image Parsing | Parse PDF / Word / Markdown and analyze images with Vision models |
| RAG Knowledge Base | Local vector index; retrieve document chunks during chat for higher accuracy |
| Prompt Management | Insert common prompts fast with `/`, manage prompts centrally |
| MCP Services | Call Model Context Protocol servers with `@` to orchestrate external tools |
| Portable Data | Export / import chats, vectors and settings as files for easy backup |
| Cross-Platform | Native Windows / macOS / Linux app, small size, high performance, fast startup |

---

## 📸 Screenshot Preview

![chatless screenshot](/docs/assets/screenshot-main1.png)

---

## 🚀 Quick Start

### Installation & Usage

#### Download & Install
Click the corresponding link to enter the download page, then select the installation package suitable for your system:

- **Windows**: [Chatless Installer](https://github.com/kamjin3086/chatless/releases/latest) - Choose .exe or .msi file
- **macOS**: [Chatless for macOS](https://github.com/kamjin3086/chatless/releases/latest) - Choose aarch64 or x64 version based on your processor
- **Linux**: [Chatless for Linux](https://github.com/kamjin3086/chatless/releases/latest) - Choose .rpm, .deb, or .AppImage file suitable for your distribution

> **Detailed Installation Guide**: View the [Complete Installation Guide](INSTALLATION_INSTRUCTIONS_EN.md) for detailed installation steps and common problem solutions

#### Configuration Setup
1. **Configure AI Providers** - Add API keys in settings
2. **Set Up Local Models** - Install Ollama and download models (optional)
3. **Start Using** - Choose a model to start chatting or upload documents

### Developer Build
```bash
git clone https://github.com/kamjin3086/chatless.git
cd chatless
pnpm install
pnpm tauri dev
```

---

## 📝 How to Use

### First Time Setup
1. **Configure AI Providers** – Add API keys in settings, supports OpenAI, Anthropic, DeepSeek, etc.
2. **Set Up Local Models** – Install Ollama and download models (optional, suitable for offline use)
3. **Create Knowledge Base** – Upload PDF, Word, Markdown and other documents to build local knowledge base

### Daily Usage
4. **Start Chatting** – Choose AI models to begin intelligent conversations
5. **Document Analysis** – Upload images or documents for analysis and Q&A
6. **Manage History** – View and manage conversation records, supports search and export

---

## ⚠️ Windows Crash on Startup (VC++ runtime required)

On some Windows systems, the app may immediately exit/crash if the Microsoft Visual C++ runtime is missing. Fix it with these steps:

1. Download and install the latest Microsoft Visual C++ 2015–2022 Redistributable (x64):
   - Direct link: <https://aka.ms/vs/17/release/vc_redist.x64.exe>
2. After installation, relaunch the app (restart Windows if needed).
3. If the issue persists:
   - Verify "Visual C++ 2015–2022 Redistributable (x64)" is installed under Settings → Apps → Installed apps.
   - Send logs and a brief description via in-app "Settings → Feedback".

Note: Native dependencies (e.g., Tauri/ONNX) on Windows rely on the MSVC runtime; when missing, startup crashes can occur.

Thanks to @ukhack for providing this method in https://github.com/kamjin3086/chatless/issues/23#issuecomment-3203662395 .
 
---

## 🎯 Development Plan

Detail to see: [Project](https://github.com/users/kamjin3086/projects/1)

---

## 🛠️ Technology Stack

- **Frontend**: Next.js 15 + TypeScript + TailwindCSS
- **Backend**: Tauri 2.0 + Rust
- **Database**: SQLite
- **AI Integration**: Multi-provider support + Ollama local models

---

## 🔧 Configuration

### AI Provider Setup
1. Open application settings (shortcut: `Ctrl/Cmd + ,`)
2. Go to "AI Model Settings" tab
3. Click "Add Provider" and enter API keys
4. Select default models and test connection

> **Tip**: Supports multiple AI providers, you can configure several simultaneously and switch between them as needed

### Local Model Setup (Optional)
If you want to use offline or protect privacy, you can configure local models:

```bash
# 1. Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# 2. Download common models
ollama pull llama2:7b      # 7B parameter model, suitable for general conversations
ollama pull mistral:7b     # Mistral model, excellent performance
ollama pull qwen:7b        # Qwen model, good Chinese support

# 3. Configure Ollama address in app settings (default: http://localhost:11434)
```

> **Privacy Advantage**: Local models ensure all conversation data never leaves your device

---

## 🔒 Privacy & Security

* **Local data storage** – All conversations and documents stored locally
* **No data upload** – No data uploaded to cloud services
* **Open source** – Transparent codebase for security verification
* **Privacy protection** – No collection of user personal information

---

## 💬 Feedback & Support

If you encounter any issues during use or have improvement suggestions, please contact us through the following channels:

| Channel | Description | Link |
| --- | --- | --- |
| **GitHub Issues** | Report bugs, feature requests, problem feedback | [Submit Issue](https://github.com/kamjin3086/chatless/issues) |
| **Discussions** | Feature discussions, usage exchanges, community interaction | [Join Discussion](https://github.com/kamjin3086/chatless/discussions) |
| **In-app Feedback** | Quick feedback, log submission, problem description | **Settings → Feedback** inside the application |

> **Feedback Tips**: When submitting issues, please describe the problem phenomenon, operation steps, and system environment as detailed as possible, so we can help you solve the problem faster

---

## 🤝 Contributing

We welcome all forms of contributions!

### How to Contribute
1. Fork this project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Tauri](https://tauri.app/) – Cross-platform desktop app framework
- [Next.js](https://nextjs.org/) – React full-stack framework
- [TailwindCSS](https://tailwindcss.com/) – Utility-first CSS framework
- [Ollama](https://ollama.ai/) – Local large language model runtime
- [ort](https://ort.pyke.io/) - Rust binding for ONNX Runtime

---

<p align="center">

**chatless** – Simple and easy-to-use AI chat application

⭐ If this project helps you, please give us a star!

</p> 