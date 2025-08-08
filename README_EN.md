<div align="center">
  <img  src="public/logo.svg"/>
</div>



English | [中文](README.md)

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

## ✨ Key Features
| Feature | Description |
| --- | --- |
| **Multi-AI Provider Support** | Supports OpenAI, Anthropic, DeepSeek, Gemini, Claude, and more |
| **Local AI Models** | Run local models through Ollama integration |
| **Document Parsing** | Supports PDF, Word, Markdown, and other document formats |
| **Image Analysis** | Supports Vision models for image analysis |
| **Knowledge Base Integration** | Upload documents to build local knowledge base |
| **Cross-Platform** | Works on Windows, macOS, and Linux |
| **Clean Interface** | Built with React and TailwindCSS, clean and easy-to-use interface |
| **Lightweight Performance** | Small package size, fast startup, low memory usage |

---

## 📸 Screenshot Preview  

![chatless screenshot](/docs/assets/screenshot-main1.png)

---

## 🚀 Quick Start

### 🎯 Installation & Usage
1. **Download & Install** - Get the latest version from [Releases](https://github.com/kamjin3086/chatless/releases) (lightweight package, fast download)
2. **Configure API** - Add AI provider API keys in settings
3. **Start Using** - Choose a model to start chatting or upload documents

**💡 Advantages: Simple installation, fast startup, clean and easy-to-use interface**

### 🛠️ Developer Build
```bash
git clone https://github.com/kamjin3086/chatless.git
cd chatless
pnpm install
pnpm tauri dev
```

---

## 📝 How to Use
1. **Configure AI Providers** – Add API keys in settings
2. **Set Up Local Models** – Install Ollama and download models
3. **Create Knowledge Base** – Upload documents to build knowledge base
4. **Start Chatting** – Choose a model to begin conversations
5. **Manage History** – View and manage conversation records

---

## Development Plan

- [ ] Support more AI providers and models
- [ ] Complete HTTP/SOCKS5 proxy functionality
- [ ] Auto-update feature
- [ ] System prompt settings
- [ ] Session title generation
- [ ] Multi-language support

---

## 🛠️ Technology Stack

### Frontend
- **Framework**: [Next.js 15](https://nextjs.org/) + TypeScript
- **Styling**: [TailwindCSS 4](https://tailwindcss.com/)
- **UI**: React component library

### Backend
- **Desktop Framework**: [Tauri 2.0](https://v2.tauri.app/) + Rust
- **Database**: SQLite local storage
- **Document Processing**: Supports multiple file format parsing

### AI Integration
- **Multi-Provider**: OpenAI, Anthropic, DeepSeek, Gemini, Claude, and more
- **Local Models**: Ollama integration
- **Vector Retrieval**: Local vector storage system

### Performance Optimization
- **Lightweight Architecture**: Tauri-based lightweight desktop application
- **Fast Startup**: Optimized startup process with short cold start time
- **Low Memory Usage**: Streamlined UI components and efficient resource management
- **Local Storage**: SQLite database, works without internet connection

---

## 🔧 Configuration

### AI Provider Setup
1. Open application settings
2. Go to "AI Model Settings"
3. Add API keys
4. Select default models

### Local Model Setup
```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Download models
ollama pull llama2
ollama pull mistral
```

---

## 🔒 Privacy & Security
* **Local data storage** – All conversations and documents stored locally
* **No data upload** – No data uploaded to cloud services
* **Open source** – Transparent codebase for security verification
* **Privacy protection** – No collection of user personal information

---

## 💬 Feedback & Support
| Channel | Link |
| --- | --- |
| GitHub Issues | <https://github.com/kamjin3086/chatless/issues> |
| Discussions | <https://github.com/kamjin3086/chatless/discussions> |
| In-app Feedback | **Settings → Feedback** inside the application |

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