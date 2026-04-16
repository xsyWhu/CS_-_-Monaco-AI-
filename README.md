# Agent IDE -- 智能代码编辑器

一个支持 AI Agent 功能的桌面代码编辑器，基于 Electron + React + Monaco Editor 构建。

## 功能特性

- **代码编辑**: Monaco Editor 内核，支持语法高亮、多标签页、自动语言检测
- **文件管理**: 文件资源管理器，支持文件/文件夹的创建、删除、重命名
- **集成终端**: 内置终端模拟器，支持多终端标签
- **AI Agent**: 支持 OpenAI 兼容的多种 LLM 提供商，具备工具调用能力
  - 读写文件、编辑代码
  - 搜索代码库
  - 执行终端命令
  - 流式响应输出
- **全局搜索**: 文件内容搜索和文件名搜索
- **Git 集成**: 查看状态、暂存/提交、分支管理、Diff 查看
- **多 LLM 支持**: OpenAI、DeepSeek、通义千问、Ollama 等 OpenAI 兼容 API

## 技术栈

| 类别 | 技术 |
|------|------|
| 桌面框架 | Electron 35 |
| 构建工具 | electron-vite + Vite 6 |
| 前端框架 | React 19 + TypeScript 5 |
| 代码编辑器 | Monaco Editor |
| 终端模拟 | xterm.js |
| UI 样式 | Tailwind CSS 4 |
| 状态管理 | Zustand 5 |
| LLM SDK | OpenAI Node SDK |
| Git 操作 | simple-git |

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

### 打包应用

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

## 项目结构

```
├── electron/                   # Electron 主进程
│   ├── main.ts                 # 主进程入口
│   ├── preload.ts              # Preload 脚本
│   ├── ipc/                    # IPC 通信处理器
│   └── services/               # 后端服务
│       ├── file-system.service.ts
│       ├── terminal.service.ts
│       ├── git.service.ts
│       ├── search.service.ts
│       └── agent/              # AI Agent 系统
│           ├── agent.service.ts
│           ├── agent-loop.ts
│           ├── providers/      # LLM 提供商
│           └── tools/          # Agent 工具集
├── src/                        # 渲染进程 (React)
│   ├── components/             # UI 组件
│   │   ├── layout/             # 布局组件
│   │   ├── editor/             # 编辑器组件
│   │   ├── file-explorer/      # 文件管理器
│   │   ├── terminal/           # 终端组件
│   │   ├── chat/               # AI 聊天面板
│   │   ├── search/             # 搜索面板
│   │   ├── git/                # Git 面板
│   │   └── settings/           # 设置面板
│   ├── stores/                 # Zustand 状态管理
│   ├── hooks/                  # React Hooks
│   ├── types/                  # TypeScript 类型定义
│   └── lib/                    # 工具函数
└── resources/                  # 应用资源
```

## AI Agent 配置

1. 启动应用后，点击右侧 AI 面板的设置按钮
2. 配置 LLM 提供商信息：
   - **Provider Name**: 提供商名称（如 OpenAI、DeepSeek）
   - **API Base URL**: API 地址（如 `https://api.openai.com/v1`）
   - **API Key**: 你的 API 密钥
   - **Model**: 模型名称（如 `gpt-4o`、`deepseek-chat`）

### 支持的提供商示例

| 提供商 | Base URL | 模型示例 |
|--------|----------|----------|
| OpenAI | `https://api.openai.com/v1` | `gpt-4o` |
| DeepSeek | `https://api.deepseek.com` | `deepseek-chat` |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |
| Ollama (本地) | `http://localhost:11434/v1` | `llama3` |

## Agent 工具能力

AI Agent 具备以下工具调用能力：

- `read_file` - 读取文件内容
- `write_file` - 写入/创建文件
- `edit_file` - 精确编辑文件内容
- `list_files` - 列出目录结构
- `search_files` - 搜索代码内容
- `run_command` - 执行终端命令

## 开发说明

项目使用 electron-vite 构建，支持主进程和渲染进程的 HMR 热更新。

开发时修改代码后会自动刷新，无需手动重启应用。
