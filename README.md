English | [中文](README_ZH.md)

# chatless – Modern AI Chat Desktop Application

<p align="center">
  <img alt="Build" src="https://img.shields.io/badge/build-manual-blue" />
  <a href="https://github.com/kamjin3086/chatless/blob/main/LICENSE">
    <img alt="License" src="https://img.shields.io/github/license/kamjin3086/chatless" />
  </a>
  <img alt="Version" src="https://img.shields.io/github/package-json/v/kamjin3086/chatless?filename=package.json&color=blueviolet" />
  <img alt="Platform" src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey" />
  <img alt="Tech Stack" src="https://img.shields.io/badge/tech%20stack-Tauri%202.0%20%7C%20Next.js%2015%20%7C%20Rust-blue" />
</p>

> **chatless** is a modern, privacy-first AI chat desktop application built with Tauri and Next.js. Connect to multiple AI providers, run models locally with Ollama, and chat with your documents through knowledge base integration. All data stays on your device—your conversations remain private.

---

## ✨ Key Features
| Feature | Description |
| --- | --- |
| **Multi-AI Provider Support** | Connect to OpenAI, Anthropic, DeepSeek, and more AI providers |
| **Local AI Models** | Run AI models locally with Ollama integration |
| **Knowledge Base Integration** | Upload documents and chat with your data |
| **Privacy-First Design** | All data stored locally on your device |
| **Cross-Platform** | Works on Windows, macOS, and Linux |
| **Modern UI** | Built with Next.js 15 and TailwindCSS 4 |

---

## 📸 Screenshot Preview  

![chatless screenshot](public/tauri-nextjs-template-2_screenshot.png)

---

## 🚀 Installation  

### Prerequisites
- Node.js 18+ 
- Rust 1.70+
- pnpm (recommended) or npm

### Quick Start
```bash
# Clone the repository
git clone https://github.com/kamjin3086/chatless.git
cd chatless

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

### Build Desktop App
```bash
# Build for your platform
pnpm tauri build
```

---

## 📝 How to Use
1. **Configure AI Providers** – Add your API keys in Settings → AI Model Settings
2. **Set Up Local Models** – Install Ollama and download models for local processing
3. **Create Knowledge Base** – Upload documents to chat with your data
4. **Start Chatting** – Choose your preferred AI model and start conversations
5. **Manage History** – View and organize your chat history

---

## 🛠️ Technology Stack

### Frontend
- **Framework**: [Next.js 15](https://nextjs.org/) + TypeScript
- **Styling**: [TailwindCSS 4](https://tailwindcss.com/)
- **UI Components**: Custom component library

### Backend
- **Desktop Framework**: [Tauri 2.0](https://v2.tauri.app/) + Rust
- **Database**: SQLite local storage
- **Document Processing**: PDF, Word, Markdown, and text file support

### AI Integration
- **Multi-Provider Support**: OpenAI, Anthropic, DeepSeek, and more
- **Local Models**: Ollama integration
- **Vector Retrieval**: Custom vector storage system

---

## 🔧 Configuration

### AI Provider Setup
1. Open application settings
2. Navigate to "AI Model Settings"
3. Add your API keys
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

## 🔒 Privacy & Data Security
* **Local data storage** – All conversations and documents stay on your device
* **No cloud uploads** – AI processing happens locally or through your configured providers
* **Privacy-first design** – No personal data collection or tracking
* **Open source** – Transparent codebase for security verification

---

## 💬 Feedback / Support
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

---

<p align="center">

**chatless** – Making AI chat simpler, making life more focused.

⭐ If this project helps you, please give us a star!

</p> 