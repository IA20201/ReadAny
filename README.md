<p align="center">
  <img src="packages/app/public/logo.svg" alt="ReadAny Logo" width="120" height="120">
</p>

<h1 align="center">ReadAny</h1>

<p align="center">
  <strong>不只是读，更懂你读的书</strong>
</p>

<p align="center">
  <em>"为什么读完就忘？为什么笔记零散？为什么搜索只能找关键词？"</em>
</p>

<p align="center">
  AI 驱动的电子书阅读器 —— 语义搜索、智能对话、知识管理，一站式解决
</p>

<p align="center">
  <a href="https://github.com/codedogQBY/ReadAny/releases/latest">
    <img src="https://img.shields.io/github/v/release/codedogQBY/ReadAny?color=blue&label=Download" alt="Release">
  </a>
  <a href="https://github.com/codedogQBY/ReadAny/stargazers">
    <img src="https://img.shields.io/github/stars/codedogQBY/ReadAny?color=yellow" alt="Stars">
  </a>
  <a href="https://github.com/codedogQBY/ReadAny/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/codedogQBY/ReadAny?color=green" alt="License">
  </a>
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey" alt="Platform">
  <a href="README_CN.md">
    <img src="https://img.shields.io/badge/lang-中文-red" alt="Chinese">
  </a>
</p>

---

<!-- TODO: Add your hero screenshot or GIF here -->
<!--
<p align="center">
  <img src="docs/screenshots/hero.gif" alt="ReadAny Demo" width="100%">
</p>
-->

## Why ReadAny?

| 痛点 | 传统阅读器 | ReadAny |
|------|-----------|---------|
| 搜索内容 | 只能关键词 | **语义搜索**，理解你的意图 |
| 提问书籍 | 自己翻找答案 | **AI 直接回答 + 定位** |
| 做笔记 | 手动复制粘贴 | **选中即高亮**，一键导出 |
| 知识管理 | 笔记散落各处 | **统一管理**，多格式导出 |
| 隐私安全 | 上传云端 | **本地向量库**，完全离线可用 |

### 与竞品对比

| 特性 | ReadAny | Calibre | KOReader | Apple Books |
|------|---------|---------|----------|-------------|
| AI 对话 | ✅ | ❌ | ❌ | ❌ |
| 语义搜索 (RAG) | ✅ | ❌ | ❌ | ❌ |
| 本地向量库 | ✅ | - | - | ❌ |
| 多格式支持 | 8+ | 15+ | 10+ | 2 |
| 笔记导出 | 5 种格式 | 有限 | 有限 | 有限 |
| 开源免费 | ✅ | ✅ | ✅ | ❌ |

---

## Screenshots

<div align="center">
  <img src="docs/screenshots/library.png" width="45%" alt="Library">
  <img src="docs/screenshots/reader.png" width="45%" alt="Reader">
</div>

<div align="center">
  <img src="docs/screenshots/chat.png" width="45%" alt="AI Chat">
  <img src="docs/screenshots/notes.png" width="45%" alt="Notes">
</div>

<p align="center">
  <sub>📚 书库管理 | 📖 沉浸阅读 | 🤖 AI 对话 | 📝 笔记管理</sub>
</p>

---

## Core Features

### 🤖 AI-Powered Reading

- **智能对话** - 针对书籍内容提问，AI 知道你的位置、选中文字、高亮笔记
- **语义搜索** - 超越关键词，向量检索 + BM25 混合搜索
- **即时翻译** - AI 翻译或 DeepL，支持 19 种语言
- **多模型支持** - OpenAI、Claude、Gemini、Ollama、DeepSeek

### 📝 Annotation & Knowledge Management

- **5 色高亮** - 黄/绿/蓝/粉/紫，悬停预览笔记
- **Markdown 笔记** - TipTap 编辑器，所见即所得
- **多格式导出** - Markdown、HTML、JSON、Obsidian、Notion

### 📚 Multi-Format Support

**EPUB** · **PDF** · **MOBI** · **AZW** · **AZW3** · **FB2** · **FBZ** · **CBZ**

### 🎨 Customizable Experience

- 5 种字体主题（含 CJK 优化）
- 明/暗主题切换
- 分页/连续滚动
- 快捷键支持
- 中英双语界面

---

## Quick Start

### 下载安装

| 平台 | 下载 |
|------|------|
| macOS (Apple Silicon) | [下载 .dmg](https://github.com/codedogQBY/ReadAny/releases/latest) |
| macOS (Intel) | [下载 .dmg](https://github.com/codedogQBY/ReadAny/releases/latest) |
| Windows | [下载 .msi](https://github.com/codedogQBY/ReadAny/releases/latest) |
| Linux | [下载 .AppImage](https://github.com/codedogQBY/ReadAny/releases/latest) |

### 3 步上手

1. **导入书籍** - 拖拽文件到书库
2. **开始阅读** - 双击打开，沉浸体验
3. **配置 AI**（可选）- 设置 → AI → 填入 API Key

### AI 配置

| Provider | 获取方式 |
|----------|---------|
| OpenAI | [platform.openai.com](https://platform.openai.com/) |
| Anthropic Claude | [console.anthropic.com](https://console.anthropic.com/) |
| Google Gemini | [aistudio.google.com](https://aistudio.google.com/) |
| Ollama / DeepSeek | 本地或自定义端点 |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | [Tauri 2](https://tauri.app/) (Rust) |
| Frontend | [React 19](https://react.dev/) + TypeScript |
| Build | [Vite 7](https://vite.dev/) |
| Styling | [Tailwind CSS 4](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/) |
| State | [Zustand](https://zustand.docs.pmnd.rs/) |
| Database | SQLite |
| E-Book | [foliate-js](https://github.com/johnfactotum/foliate-js) |
| AI/LLM | [LangChain.js](https://js.langchain.com/) + [LangGraph](https://langchain-ai.github.io/langgraphjs/) |
| Embeddings | [Transformers.js](https://huggingface.co/docs/transformers.js) |

---

## Development

```bash
# Clone
git clone https://github.com/codedogQBY/ReadAny.git
cd ReadAny

# Install
pnpm install

# Dev
pnpm tauri dev

# Build
pnpm tauri build
```

**Requirements:** Node.js ≥18, pnpm ≥9, Rust

---

## Roadmap

- [ ] 更多 AI 模型（Qwen、GLM、Llama）
- [ ] PDF 重排/重渲染
- [ ] 云同步
- [ ] 移动端支持
- [ ] 插件系统

---

## Contributing

欢迎贡献代码、报告 Bug、提出建议！

1. Fork → 2. Branch → 3. PR

提交前请运行 `pnpm lint` 确保代码风格一致。

---

## License

[MIT](LICENSE) © 2024 ReadAny Team

---

## Acknowledgments

- [foliate-js](https://github.com/johnfactotum/foliate-js) - 电子书渲染引擎
- [Tauri](https://tauri.app/) - 跨平台桌面框架
- [LangChain.js](https://js.langchain.com/) - AI 编排框架
- [Radix UI](https://www.radix-ui.com/) - 无障碍 UI 组件
- [Lucide](https://lucide.dev/) - 图标库

---

<p align="center">
  Made with ❤️ by the ReadAny Team
</p>

<p align="center">
  <a href="https://github.com/codedogQBY/ReadAny/discussions">💬 Discussions</a> •
  <a href="https://github.com/codedogQBY/ReadAny/issues">🐛 Issues</a>
</p>
