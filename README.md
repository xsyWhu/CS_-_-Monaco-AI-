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

- Git >= 2.30
- Node.js 20.x
- npm 10.x

说明：

- 项目当前推荐使用 `Node 20`。
- 虽然部分依赖在较低版本 Node 下可能可以安装，但实际开发中容易出现构建失败或依赖异常。
- 不建议直接使用系统自带的旧版本 Node。

### 1. 克隆项目

```bash
git clone <your-repo-url>
cd CS_-_-Monaco-AI-
```

### 2. 安装 Node.js 20

推荐使用 `nvm` 管理 Node 版本。

#### Linux / macOS

如果本机还没有 `nvm`，先安装：

```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
```

安装并切换到 Node 20：

```bash
nvm install 20
nvm use 20
nvm alias default 20
```

检查版本：

```bash
node -v
npm -v
```

期望结果类似：

```bash
v20.x.x
10.x.x
```

#### Windows

Windows 建议使用以下任一方式：

- 安装 `nvm-windows` 后切换到 Node 20
- 或直接安装 Node.js 20 LTS

安装完成后执行：

```bash
node -v
npm -v
```

### 3. 安装项目依赖

确保当前终端已经切换到 Node 20 后，再执行：

```bash
npm install
```

### 4. 启动开发模式

```bash
npm run dev
```

启动成功后会打开 Electron 开发窗口。

### 5. 构建项目

```bash
npm run build
```

如果 `build` 成功，说明当前环境已经可以正常开发和联调。

### 6. 打包应用

按操作系统选择对应命令：

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

---

## 推荐初始化流程

组员首次拉取项目后，建议严格按下面顺序执行：

```bash
git clone <your-repo-url>
cd CS_-_-Monaco-AI-
nvm use 20
npm install
npm run build
npm run dev
```

如果本机还没有安装 Node 20，请先执行 `nvm install 20`。

---

## 环境检查清单

在开始开发前，请先确认以下项目全部通过：

- `node -v` 显示为 `v20.x.x`
- `npm -v` 显示为 `10.x.x`
- `npm install` 能成功完成
- `npm run build` 能成功完成
- `npm run dev` 能正常启动 Electron 窗口

只要以上 5 项通过，说明本地开发环境基本正常。

---

## 常见问题

### 1. `electron-vite: not found`

原因：

- 没有执行 `npm install`
- 依赖安装不完整
- 安装依赖时使用了不兼容的 Node 版本

解决方法：

```bash
nvm use 20
rm -rf node_modules package-lock.json
npm install
```

如果你们组内不想删除 `package-lock.json`，也可以先只删除 `node_modules` 后重新安装：

```bash
rm -rf node_modules
npm install
```

### 2. Node 版本过低导致依赖报错

现象：

- `npm install` 出现 `Unsupported engine`
- `npm run build` 失败
- Tailwind、Vite、Electron 相关依赖异常

解决方法：

```bash
nvm install 20
nvm use 20
node -v
npm -v
```

确认版本正确后重新安装依赖。

### 3. 新开终端后又回到旧版本 Node

原因：

- 当前 shell 没有加载 `nvm`
- 没有切换到 Node 20

解决方法：

```bash
source ~/.bashrc
nvm use 20
```

### 4. 项目能安装依赖但无法启动

建议按以下顺序排查：

1. 先执行 `node -v` 和 `npm -v`，确认版本是否正确。
2. 执行 `npm run build`，确认能否构建成功。
3. 如果构建失败，先不要继续开发，先解决环境问题。
4. 如果构建成功但 `npm run dev` 失败，再检查终端报错信息。

---

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

多人协作开发前建议先执行：

```bash
npm run build
```

确认本地环境没问题后，再开始修改代码并提交到 GitHub。
