<div align="center">
  <img src="public/logo.svg" alt="chatless logo" width="120" />
</div>

<h1 align="center">chatless</h1>

<p align="center">
  A local-first AI chat client built with Tauri 2.0 and Next.js
</p>

<p align="center">
  <a href="https://github.com/kamjin3086/chatless/blob/main/LICENSE">
    <img alt="License" src="https://img.shields.io/badge/license-MIT-blue.svg" />
  </a>
  <img alt="Version" src="https://img.shields.io/badge/version-v0.1.0-blue.svg" />
  <img alt="Platform" src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg" />
</p>

<p align="center">
  English | <a href="README.md">中文</a>
</p>

---

## About

chatless is a desktop AI chat client that supports multiple cloud-based AI services (OpenAI, Anthropic, DeepSeek, etc.) and local models (Ollama, LM Studio). All data is stored locally with support for document parsing and vector retrieval (RAG).

**Key Features:**

- Multi-AI Provider Support - Cloud services and local models
- Document Parsing - PDF, Word, Markdown formats
- Image Analysis - Vision model support for image understanding
- Local RAG Knowledge Base - Vector retrieval for improved accuracy
- MCP Protocol Integration - Extend with third-party tools
- Prompt Management - Quick access to commonly used prompts
- Local Data Storage - Privacy protection

## Preview

<div align="center">
  <img src="docs/assets/screenshot-main1.png" alt="chatless main interface" width="960" />
</div>

For more feature demonstrations, visit the [complete documentation](https://kamjin3086.github.io/chatless/docs)

## Quick Start

### Download & Install

Download the installation package for your system from [GitHub Releases](https://github.com/kamjin3086/chatless/releases/latest):

- **Windows** - `.exe` or `.msi` installer
- **macOS** - Choose `aarch64` (Apple Silicon) or `x64` (Intel) version
- **Linux** - `.deb`, `.rpm`, or `.AppImage` format

> For detailed installation steps, refer to the [Installation Guide](INSTALLATION_INSTRUCTIONS_EN.md)

### Configuration

1. Open the app and go to Settings
2. Add API keys for AI providers
3. (Optional) Configure Ollama for local models
4. Start chatting

> For complete usage instructions, visit the [User Documentation](https://kamjin3086.github.io/chatless/docs)

## Development

```bash
# Clone repository
git clone https://github.com/kamjin3086/chatless.git
cd chatless

# Install dependencies
pnpm install

# Start development server
pnpm tauri dev

# Build application
pnpm tauri build
```

**Tech Stack:** Tauri 2.0, Next.js 15, TypeScript, Rust, SQLite

For more development information, see [Contributing Guide](CONTRIBUTING.md)

## Documentation

| Documentation | Link |
| --- | --- |
| User Guide | [View Docs](https://kamjin3086.github.io/chatless/docs) |
| Quick Start | [Quick Start](https://kamjin3086.github.io/chatless/docs/quick-start) |
| Features | [Feature Details](https://kamjin3086.github.io/chatless/docs/features) |
| FAQ | [FAQ](https://kamjin3086.github.io/chatless/docs/faq) |
| Roadmap | [Roadmap](https://github.com/users/kamjin3086/projects/1) |

## FAQ

**Q: App crashes immediately on Windows startup?**

Some Windows environments require Microsoft Visual C++ runtime. Download and install:
- [VC++ 2015-2022 Redistributable (x64)](https://aka.ms/vs/17/release/vc_redist.x64.exe)

For more solutions, see [FAQ Documentation](https://kamjin3086.github.io/chatless/docs/faq)

## Feedback & Support

- **Bug Reports** - [GitHub Issues](https://github.com/kamjin3086/chatless/issues)
- **Feature Discussions** - [GitHub Discussions](https://github.com/kamjin3086/chatless/discussions)
- **In-app Feedback** - Settings → Feedback

## Contributing

Issues and Pull Requests are welcome. Please read the [Contributing Guide](CONTRIBUTING.md) before contributing.

## License

[MIT License](LICENSE) © 2025 chatless

## Acknowledgments

Thanks to the following open source projects:

- [Tauri](https://tauri.app/) - Cross-platform desktop application framework
- [Next.js](https://nextjs.org/) - React full-stack framework
- [Ollama](https://ollama.ai/) - Local large language model runtime
- [ort](https://ort.pyke.io/) - ONNX Runtime Rust binding

Thanks to community contributors @ukhack, @duokebei for testing and feedback.

---

<div align="center">

If this project helps you, please give it a Star ⭐

</div> 