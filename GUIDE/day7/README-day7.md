# Day 7：高级工具（edit_file / run_command）+ Git 集成 + 设置面板

## 前言

Day 1~6 我们构建了从"静态骨架"到"自动化 Agent 循环"的完整链路。Day 6 结束时，Agent 拥有 4 个工具（read_file、list_files、search_files、write_file），但缺少两个关键能力：

1. **精准代码修改**：write_file 是整文件覆盖写，修改一行也要重写整个文件。
2. **命令执行**：Agent 无法帮用户运行测试、安装依赖或查看 git 状态。

同时，IDE 本身也缺少两个重要功能：

3. **Git 可视化**：开发者需要在 IDE 内查看修改状态、暂存文件、提交代码。
4. **配置管理 UI**：Day 4~6 的 API Key 只能通过 DevTools Console 设置，缺少正式的设置面板。

Day 7 一次性解决这四个问题。完成后，Agent 拥有 **6 个工具**，IDE 拥有完整的 Git 面板和设置对话框。

---

## 1. 本日增量目标

### 1.1 功能目标
1. Agent 能通过 `edit_file` 精准替换文件中的指定代码片段（Patch 模式）。
2. Agent 能通过 `run_command` 在工作区执行 Shell 命令。
3. 侧边栏新增 Git 面板：查看分支、文件状态、暂存、提交、查看 Diff。
4. 设置按钮弹出模态框，管理 API Key / Base URL / 模型配置。
5. 保持 Day 1~6 的文件树、编辑器、终端、Agent 对话功能完好。

### 1.2 工程目标
1. 新增 `simple-git` 依赖封装 Git 操作，主进程无状态设计。
2. Git IPC 注册 7 个频道，预加载层暴露对应方法。
3. 侧边栏引入 Activity Bar 模式（文件 / Git 面板切换）。
4. 工具安全性：edit_file 路径穿越校验，run_command 超时保护 + 输出截断。

---

## 2. 运行步骤

### 2.1 安装依赖
```powershell
Set-Location .\GUIDE\day7
npm install
```

### 2.2 启动项目
```powershell
npm run dev
```

### 2.3 配置 API（首次运行）
点击左侧 Activity Bar 底部的 ⚙ 图标，在弹出的设置对话框中填写：
- **API Key**：你的 OpenAI API Key
- **Base URL**：留空使用默认端点，或填入兼容端点
- **模型**：如 `gpt-4o`

### 2.4 预期现象
1. Electron 窗口正常启动。
2. 左侧 Activity Bar 有三个图标：📁 文件、⎇ Git、⚙ 设置。
3. 点击 ⎇ 图标切换到 Git 面板，显示当前分支和文件状态。
4. Chat 中提问"帮我在 package.json 中添加一个 test 脚本"，Agent 应调用 `edit_file` 工具。
5. Chat 中提问"运行 node -v 看一下版本"，Agent 应调用 `run_command` 工具。
6. 状态栏显示当前 Git 分支和 `Day 7` 标识。

---

## 3. Day 7 变更结构（相对 Day 6）

```text
day7/
├─ electron/
│  ├─ preload.ts                                  (修改：新增 7 个 git* 方法)
│  ├─ ipc/
│  │  ├─ index.ts                                 (修改：注册 registerGitIpcHandlers)
│  │  └─ git.ipc.ts                               (新增：Git IPC 处理器)
│  └─ services/
│     ├─ git.service.ts                           (新增：simple-git 封装)
│     └─ agent/
│        ├─ chat.service.ts                       (修改：注册 edit_file + run_command)
│        └─ tools/
│           ├─ edit-file.tool.ts                  (新增：精准字符串替换工具)
│           └─ run-command.tool.ts                (新增：Shell 执行工具)
├─ src/
│  ├─ stores/
│  │  ├─ editor.store.ts                          (修改：新增 activeSidebarPanel)
│  │  └─ git.store.ts                             (新增：Git 全局状态)
│  ├─ components/
│  │  ├─ git/
│  │  │  ├─ GitPanel.tsx                          (新增：Git 操作面板)
│  │  │  └─ DiffViewer.tsx                        (新增：unified diff 渲染)
│  │  ├─ settings/
│  │  │  └─ SettingsDialog.tsx                    (新增：设置模态框)
│  │  └─ layout/
│  │     ├─ Sidebar.tsx                           (修改：Activity Bar + 多面板)
│  │     └─ StatusBar.tsx                         (修改：显示 Git 分支)
│  └─ vite-env.d.ts                               (修改：Git 相关类型)
├─ package.json                                    (修改：新增 simple-git)
└─ README-day7.md                                  (新增)
```

---

## 4. 核心增量一：edit_file 工具——精准代码 Patch

### 4.1 为什么不用行号定位？

在 Day 6 的 `write_file` 中，修改文件的方式是"整文件覆盖写"。这存在两个问题：

1. **浪费 token**：即使只改一行，也需要生成整个文件内容。
2. **易出错**：文件越大，LLM 越容易遗漏或修改无关行。

那能不能用行号定位？比如"替换第 42 行"？

**行号方案的致命缺陷——行号漂移（Line Drift）**：

```
场景：Agent 需要连续修改同一个文件的两处
原始文件第 10 行：const x = 1
原始文件第 50 行：const y = 2

第一次修改：在第 10 行前插入 3 行注释
→ 原来的第 50 行变成了第 53 行
→ Agent 如果仍用"第 50 行"定位，将修改错误的位置
```

**字符串匹配方案**：要求 LLM 提供 `old_string`（要被替换的精确文本），只有在文件中唯一出现时才执行替换。这避免了行号漂移问题。

### 4.2 文件 `electron/services/agent/tools/edit-file.tool.ts`

文件导读：
- 技术栈：Node.js `fs/promises` + 字符串操作。
- 作用：在文件中精确查找 `old_string` 并替换为 `new_string`。
- 关系：注册到 ToolRegistry，由 AgentLoop 调用。

关键代码（唯一性校验）：

```typescript
// 统计 old_string 在文件中出现的次数
const occurrences = content.split(oldString).length - 1

if (occurrences === 0) {
  return JSON.stringify({
    error: "在文件中未找到 old_string。请用 read_file 重新读取，确保文本完全一致。"
  })
}

if (occurrences > 1) {
  return JSON.stringify({
    error: `old_string 出现了 ${occurrences} 次，无法唯一定位。请包含更多上下文行。`
  })
}

// 唯一匹配 → 安全替换
const newContent = content.replace(oldString, newString)
await fs.writeFile(absTarget, newContent, "utf-8")
```

逐段解释：
1. `content.split(oldString).length - 1`：巧妙的计数技巧。用 old_string 切分整个文件内容，切出的段数减一就是出现次数。
2. 出现 0 次：文件内容可能已变化，提示模型重新读取。
3. 出现 > 1 次：old_string 不够具体，提示模型包含更多上下文行（前后各 3~5 行）。
4. 恰好 1 次：安全替换。`String.prototype.replace()` 默认只替换第一次出现，但因为已验证唯一性，所以行为确定。

关键代码（路径安全校验）：

```typescript
const absTarget = path.resolve(context.workspacePath, relativePath)
const rel = path.relative(path.resolve(context.workspacePath), absTarget)
if (rel.startsWith("..") || path.isAbsolute(rel)) {
  return JSON.stringify({ error: "安全错误：不允许编辑工作区目录之外的文件。" })
}
```

解释：
1. `path.resolve()` 将相对路径转为绝对路径。
2. `path.relative()` 计算目标相对于工作区的路径。
3. 如果结果以 `..` 开头或是绝对路径，说明目标在工作区外。
4. 这是标准的**路径穿越（Path Traversal）防御**——不能只检查输入是否含 `../`，因为 URL 编码等方式可以绕过。

关键代码（变更统计）：

```typescript
const oldLines = oldString.split("\n").length
const newLines = newString.split("\n").length
const delta = newLines - oldLines
const sign = delta >= 0 ? "+" : ""
return `文件 ${rel} 修改成功。替换了 ${oldLines} 行 → ${newLines} 行（${sign}${delta} 行）。`
```

解释：工具返回的文本会作为 `tool` 消息回传给模型。模型据此确认修改是否符合预期，决定是否需要进一步调整。

### 4.3 JSON Schema 参数定义

```json
{
  "type": "object",
  "properties": {
    "path":       { "type": "string", "description": "相对于工作区根目录的文件路径" },
    "old_string": { "type": "string", "description": "要被替换的精确文本（含缩进/空格）" },
    "new_string": { "type": "string", "description": "替换后的新文本" }
  },
  "required": ["path", "old_string", "new_string"]
}
```

模型根据这个 Schema 生成参数 JSON，例如：
```json
{
  "path": "src/main.ts",
  "old_string": "const PORT = 3000",
  "new_string": "const PORT = process.env.PORT || 3000"
}
```

---

## 5. 核心增量二：run_command 工具——Shell 命令执行

### 5.1 文件 `electron/services/agent/tools/run-command.tool.ts`

文件导读：
- 技术栈：Node.js `child_process.execSync`。
- 作用：在工作区目录下执行任意 Shell 命令。
- 安全等级：⚠️ 高危——可执行任意系统命令。

关键代码（执行 + 安全措施）：

```typescript
const output = execSync(command, {
  cwd,                          // ① 工作目录严格限定在 workspace 内
  timeout: 30_000,              // ② 超时保护：30 秒后自动终止
  encoding: "utf-8",
  shell: process.platform === "win32" ? "powershell.exe" : "/bin/sh",
  stdio: ["pipe", "pipe", "pipe"],
  maxBuffer: 10 * 1024 * 1024,  // ③ 最大缓冲区：10MB
})
```

逐行解释：
1. `cwd`：命令执行目录。经过路径安全校验，确保在工作区内。
2. `timeout: 30_000`：如果命令 30 秒未完成，自动杀掉。防止 `npm install` 之类的长命令阻塞 Agent 循环。
3. `shell`：Windows 用 PowerShell，macOS/Linux 用 sh。跨平台兼容。
4. `maxBuffer`：标准输出/错误的最大缓冲区。超过则抛异常。

关键代码（输出截断）：

```typescript
const MAX_OUTPUT = 10_000  // 返回给模型的最大字符数

function truncate(output: string): string {
  if (output.length <= MAX_OUTPUT) return output
  const half = Math.floor(MAX_OUTPUT / 2)
  return (
    output.slice(0, half) +
    `\n\n--- 输出已截断（原始长度 ${output.length} 字符）---\n\n` +
    output.slice(-half)
  )
}
```

解释：
- 模型的上下文窗口有限。如果 `npm test` 输出 50000 字符，直接塞入会浪费 token 或超出限制。
- 截取头部和尾部各一半，通常能保留"开头的摘要"和"结尾的错误信息"。

### 5.2 安全风险清单

| 风险 | 本阶段处理方式 |
|------|---------------|
| 路径穿越 | `cwd` 参数通过 `path.relative()` 校验，拒绝 `..` 前缀 |
| 命令挂起 | `timeout: 30_000`，超时后自动终止 |
| 输出过长 | 截取头尾各 5000 字符 |
| 任意命令执行 | ⚠️ **未加白名单**——Agent IDE 的设计意图是授权用户全权操作 |

> **生产环境建议**：添加命令白名单、沙箱隔离（Docker / Deno）、或在 UI 中展示命令要求用户二次确认（Cursor 的做法）。

---

## 6. 核心增量三：Git 服务——simple-git 无状态封装

### 6.1 文件 `electron/services/git.service.ts`

文件导读：
- 技术栈：`simple-git` npm 包——Node.js 下最成熟的 Git 封装库。
- 作用：提供 status / diff / add / commit / branches / checkout / log 七个方法。
- 设计模式：**无状态设计**——每次调用传入 `repoPath`，不持有全局实例。

关键代码：

```typescript
export default class GitService {
  async status(repoPath: string): Promise<GitStatus> {
    const git = simpleGit(repoPath)  // ← 每次调用创建独立实例
    const result = await git.status()
    return {
      current: result.current,
      ahead: result.ahead,
      behind: result.behind,
      files: result.files.map((f) => ({
        path: f.path,
        index: f.index,
        working_dir: f.working_dir,
      })),
      isClean: result.isClean(),
    }
  }
}
```

逐段解释：
1. `simpleGit(repoPath)`：每次创建新实例，传入仓库路径。不用 `this.git = simpleGit()` 的原因是：如果用户切换工作区目录，持久化实例会锁定在旧目录上。
2. `result.files`：返回所有有变更的文件。每个文件有两个状态字符：
   - `index`：暂存区状态（`M` 修改 / `A` 新增 / `D` 删除 / `?` 未跟踪 / ` ` 未改变）
   - `working_dir`：工作区状态
3. `isClean()`：方便前端判断"是否有未提交变更"。

关键代码（diff 方法）：

```typescript
async diff(repoPath: string, filePath?: string): Promise<string> {
  const git = simpleGit(repoPath)
  return filePath ? git.diff([filePath]) : git.diff()
}
```

解释：
- 不传 `filePath` 时返回所有文件的 diff。
- 传入时只 diff 指定文件。
- 返回的是标准的 **unified diff** 格式文本（后面 DiffViewer 解析）。

### 6.2 Git 状态字符速查表

| index / working_dir | 含义 |
|---------------------|------|
| `M` | 已修改（Modified） |
| `A` | 新增（Added） |
| `D` | 已删除（Deleted） |
| `?` | 未跟踪（Untracked） |
| `!` | 被忽略（Ignored） |
| ` `（空格） | 未改变 |

---

## 7. 核心增量四：Git IPC 注册

### 7.1 文件 `electron/ipc/git.ipc.ts`

文件导读：
- 技术栈：Electron `ipcMain.handle`。
- 作用：将 GitService 的 7 个方法注册为 IPC 通道。
- 模式：与 Day 3 文件系统 IPC 相同的"请求-响应"模式。

关键代码：

```typescript
const gitService = new GitService()

export function registerGitIpcHandlers(): void {
  // 先解绑旧 handler（防止热更新时重复注册）
  ipcMain.removeHandler("git:status")
  ipcMain.removeHandler("git:diff")
  // ...

  ipcMain.handle("git:status", (_event, repoPath: string) =>
    gitService.status(repoPath),
  )

  ipcMain.handle("git:diff", (_event, repoPath: string, filePath?: string) =>
    gitService.diff(repoPath, filePath),
  )

  ipcMain.handle("git:add", (_event, repoPath: string, files: string[]) =>
    gitService.add(repoPath, files),
  )

  ipcMain.handle("git:commit", (_event, repoPath: string, message: string) =>
    gitService.commit(repoPath, message),
  )
  // branches / checkout / log 同理
}
```

### 7.2 文件 `electron/ipc/index.ts` 统一入口

```typescript
import { registerGitIpcHandlers } from './git.ipc'

export function registerIpcHandlers(): void {
  registerTerminalIpcHandlers()
  registerFileSystemIpcHandlers()
  registerChatIpcHandlers()
  registerGitIpcHandlers()   // ← Day 7 新增
}
```

### 7.3 文件 `electron/preload.ts` 新增方法

Day 7 在 preload 的 `api` 对象中新增 7 个 Git 方法：

```typescript
// Git (Day 7 新增)
gitStatus:   (repoPath: string)                   => ipcRenderer.invoke("git:status", repoPath),
gitDiff:     (repoPath: string, filePath?: string) => ipcRenderer.invoke("git:diff", repoPath, filePath),
gitAdd:      (repoPath: string, files: string[])   => ipcRenderer.invoke("git:add", repoPath, files),
gitCommit:   (repoPath: string, message: string)   => ipcRenderer.invoke("git:commit", repoPath, message),
gitBranches: (repoPath: string)                    => ipcRenderer.invoke("git:branches", repoPath),
gitCheckout: (repoPath: string, branch: string)    => ipcRenderer.invoke("git:checkout", repoPath, branch),
gitLog:      (repoPath: string, maxCount?: number) => ipcRenderer.invoke("git:log", repoPath, maxCount),
```

### 7.4 文件 `src/vite-env.d.ts` 类型扩展

新增 Git 相关类型声明，使渲染层获得完整的类型提示：

```typescript
interface GitFileStatus {
  path: string
  index: string
  working_dir: string
}

interface GitStatus {
  current: string | null
  ahead: number
  behind: number
  files: GitFileStatus[]
  isClean: boolean
}

interface GitBranch {
  name: string
  current: boolean
  commit: string
}

interface GitLogEntry {
  hash: string
  date: string
  message: string
  author: string
}
```

---

## 8. 渲染层增量一：Git 状态管理

### 8.1 文件 `src/stores/git.store.ts`

文件导读：
- 技术栈：Zustand。
- 作用：缓存 Git 状态数据，提供操作方法。
- 关系：GitPanel 读取状态，调用方法。

关键代码：

```typescript
interface GitState {
  status: GitStatus | null
  branches: GitBranch[]
  diff: string
  loading: boolean

  refreshStatus:  (repoPath: string) => Promise<void>
  refreshBranches:(repoPath: string) => Promise<void>
  stageFiles:     (repoPath: string, files: string[]) => Promise<void>
  commit:         (repoPath: string, message: string) => Promise<void>
  checkout:       (repoPath: string, branch: string) => Promise<void>
  getDiff:        (repoPath: string, filePath?: string) => Promise<void>
}

export const useGitStore = create<GitState>((set) => ({
  status: null,
  branches: [],
  diff: "",
  loading: false,

  refreshStatus: async (repoPath) => {
    try {
      set({ loading: true })
      const status = await window.api.gitStatus(repoPath)
      set({ status, loading: false })
    } catch {
      set({ status: null, loading: false })
    }
  },
  // ...
}))
```

解释：
1. 每个操作方法接收 `repoPath` 参数——从 `useFileTreeStore` 获取，保证一致性。
2. `loading` 状态驱动 UI 的加载指示器。
3. 所有 `catch` 块静默处理错误（如目录不是 Git 仓库），避免 UI 崩溃。

### 8.2 文件 `src/stores/editor.store.ts` 新增状态

```typescript
// Day 7 新增
activeSidebarPanel: 'files' | 'git'
setActiveSidebarPanel: (panel: 'files' | 'git') => void
```

解释：`activeSidebarPanel` 控制侧边栏显示文件树还是 Git 面板。存储在全局 store 中，使 Activity Bar 按钮和面板内容区保持同步。

---

## 9. 渲染层增量二：GitPanel 操作面板

### 9.1 文件 `src/components/git/GitPanel.tsx`

文件导读：
- 技术栈：React Hooks + Zustand + IPC 间接调用。
- 作用：提供完整的 Git 操作界面——分支切换、暂存、提交、查看 Diff。
- 关系：读取 `useGitStore` 和 `useFileTreeStore`。

关键布局结构：

```
┌──────────────────────────────┐
│ 源代码管理            [刷新]  │  ← 顶部工具栏
├──────────────────────────────┤
│ 分支: [main ▾]               │  ← 分支选择器（<select>）
│ ↑ 0 ↓ 0                     │  ← ahead/behind 状态
├──────────────────────────────┤
│ 未暂存的更改 (3)  [全部暂存]  │  ← 未暂存文件列表
│   M src/app.ts               │     M=修改 A=新增 ?=未跟踪
│   ? newfile.txt              │
├──────────────────────────────┤
│ 已暂存的更改 (1)             │  ← 已暂存文件列表
│   A readme.md                │
├──────────────────────────────┤
│ [▶ 查看 Diff]                │  ← 可展开的 Diff 查看器
├──────────────────────────────┤
│ [提交消息输入框]              │  ← Commit 区域
│ [   提交   ]                 │
└──────────────────────────────┘
```

关键代码（文件分类逻辑）：

```typescript
// 暂存区有变化的文件（index 不为空格、?、!）
const stagedFiles = (status?.files ?? []).filter(
  (f) => f.index !== " " && f.index !== "?" && f.index !== "!",
)

// 工作区有变化的文件（working_dir 不为空格、!）
const unstagedFiles = (status?.files ?? []).filter(
  (f) => f.working_dir !== " " && f.working_dir !== "!",
)
```

解释：Git 的状态是一个 **二维矩阵**——同一个文件可以同时出现在"已暂存"和"未暂存"列表中。例如：修改了文件 → `git add` 暂存 → 又修改了一次，此时该文件 `index='M'`（暂存区有变更）且 `working_dir='M'`（工作区也有新变更）。

关键代码（暂存全部）：

```typescript
const handleStageAll = async () => {
  const files = unstagedFiles.map((f) => f.path)
  if (files.length === 0) return
  await stageFiles(repoPath, files)    // → gitAdd IPC → git add
  await refreshStatus(repoPath)         // 刷新状态
}
```

### 9.2 文件 `src/components/git/DiffViewer.tsx`

文件导读：
- 技术栈：纯 React 组件 + 字符串逐行解析。
- 作用：将 unified diff 格式渲染为带颜色高亮的代码视图。

关键代码：

```typescript
const lines = diff.split("\n")

lines.map((line, i) => {
  let textClass = "text-gray-300"
  let bgClass = ""

  if (line.startsWith("+++") || line.startsWith("---")) {
    textClass = "text-white font-bold"               // 文件路径
  } else if (line.startsWith("+")) {
    textClass = "text-green-400"; bgClass = "bg-green-400/10"  // 新增行
  } else if (line.startsWith("-")) {
    textClass = "text-red-400"; bgClass = "bg-red-400/10"      // 删除行
  } else if (line.startsWith("@@")) {
    textClass = "text-blue-400"; bgClass = "bg-blue-400/5"     // 行号区段
  } else if (line.startsWith("diff ") || line.startsWith("index ")) {
    textClass = "text-gray-500"                       // 元信息
  }
})
```

解释：
- Unified diff 格式的解析非常简单——只需检查每行的**第一个字符**。
- `+` 开头是新增行，`-` 开头是删除行，`@@` 开头是变更区段标记。
- 不需要解析行号范围（`@@ -10,6 +10,7 @@`），直接按行渲染即可。

---

## 10. 渲染层增量三：设置模态框

### 10.1 文件 `src/components/settings/SettingsDialog.tsx`

文件导读：
- 技术栈：React 受控表单 + Electron IPC。
- 作用：提供 API Key / Base URL / Model 的可视化配置界面。
- 模式：经典的**模态对话框（Modal Dialog）**设计模式。

三种关闭方式：
1. **Escape 键**：
   ```typescript
   useEffect(() => {
     if (!isOpen) return
     const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
     window.addEventListener('keydown', handler)
     return () => window.removeEventListener('keydown', handler)
   }, [isOpen, onClose])
   ```
2. **遮罩层点击**：
   ```tsx
   <div onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
   ```
   `e.target === e.currentTarget` 确保只在点击遮罩层本身时触发，点击对话框内部不会误关。
3. **右上角 X 按钮**。

打开时加载当前配置：
```typescript
useEffect(() => {
  if (isOpen) { loadSettings(); setShowApiKey(false) }
}, [isOpen, loadSettings])
```

解释：每次打开对话框时重新加载最新配置，避免显示过期数据。同时隐藏 API Key，防止旁人窥视。

API Key 显示/隐藏切换：
```tsx
<input type={showApiKey ? "text" : "password"} ... />
<button onClick={() => setShowApiKey((v) => !v)}>
  {showApiKey ? <EyeOff /> : <Eye />}
</button>
```

---

## 11. 渲染层增量四：侧边栏 Activity Bar 架构

### 11.1 文件 `src/components/layout/Sidebar.tsx`

文件导读：
- 作用：引入 VS Code 风格的 Activity Bar（图标列）+ 面板内容区。
- 关系：读取 `useEditorStore` 的 `activeSidebarPanel`，渲染对应组件。

关键布局代码：

```tsx
<div className="h-full flex flex-row">
  {/* Activity Bar */}
  <div className="w-10 flex flex-col items-center py-2 gap-1">
    {navItems.map((item) => (
      <button onClick={() => setActiveSidebarPanel(item.id)}>
        {item.icon}
      </button>
    ))}
    <div className="flex-1" />  {/* 弹簧：将 Settings 推到底部 */}
    <button onClick={() => setSettingsOpen(true)}>
      <Settings />
    </button>
  </div>

  {/* Panel Content */}
  <div className="flex-1">
    {activeSidebarPanel === "files" ? <FileExplorer /> : <GitPanel />}
  </div>
</div>
```

解释：
1. Activity Bar 宽度固定 `w-10`（40px），图标垂直排列。
2. `<div className="flex-1" />` 是 flexbox 弹簧技巧——占据剩余空间，将 Settings 按钮推到底部。
3. 面板内容区根据 `activeSidebarPanel` 条件渲染不同组件。
4. 当前活动面板的按钮高亮显示（左侧带颜色指示条）。

---

## 12. Agent 工具注册——ChatService 更新

### 12.1 文件 `electron/services/agent/chat.service.ts`

Day 7 只需在构造函数中增加两行注册：

```typescript
constructor() {
  // ...
  this.toolRegistry = new ToolRegistry()
  // Day 5~6 基础工具
  this.toolRegistry.register(readFileTool)
  this.toolRegistry.register(listFilesTool)
  this.toolRegistry.register(searchFilesTool)
  this.toolRegistry.register(writeFileTool)
  // Day 7 高级工具
  this.toolRegistry.register(editFileTool)      // ← 新增
  this.toolRegistry.register(runCommandTool)     // ← 新增
}
```

这就是 ToolRegistry 解耦设计的价值：新增工具只需 `register()` 一行代码，不需修改 AgentLoop 或 Provider。

---

## 13. Agent 工具能力总览

| 工具 | 类型 | 副作用 | 安全校验 | 新增于 |
|------|------|--------|---------|-------|
| `read_file` | 只读 | 无 | 路径穿越检查 | Day 5 |
| `list_files` | 只读 | 无 | 路径穿越检查 | Day 5 |
| `search_files` | 只读 | 无 | 目录限制 | Day 5 |
| `write_file` | 写入 | 创建/覆盖文件 | 路径穿越检查 | Day 6 |
| `edit_file` | 写入 | 精准修改文件 | 路径穿越 + 唯一性检查 | **Day 7** |
| `run_command` | 执行 | 任意系统副作用 | 路径穿越 + 超时保护 | **Day 7** |

---

## 14. 完整运行流程追踪

### 示例：用户说"帮我把 package.json 的 name 改成 my-app"

#### 14.1 用户消息入队
```
ChatInput → chat.store.sendMessage("帮我把...")
  → window.api.sendChatMessage(message, workspacePath)
    → IPC → ChatService.sendMessage()
      → AgentLoop.run()
```

#### 14.2 Agent 第一轮——模型决定先读文件
```
模型推理：需要先了解 package.json 当前内容
→ tool_call: read_file({ path: "package.json" })
→ 工具执行：读取文件，返回带行号的内容
→ tool 消息回传给模型
```

#### 14.3 Agent 第二轮——模型执行精准修改
```
模型推理：已看到内容，使用 edit_file 修改
→ tool_call: edit_file({
    path: "package.json",
    old_string: '"name": "my-project"',
    new_string: '"name": "my-app"'
  })
→ 唯一性校验通过（出现 1 次）
→ 文件写入成功
→ 返回"修改成功，替换了 1 行 → 1 行"
```

#### 14.4 Agent 最终轮——模型生成回复
```
模型推理：修改已完成，告知用户
→ 输出文本："已将 package.json 的 name 字段从 'my-project' 修改为 'my-app'。"
→ onComplete → Chat 面板显示最终回复
```

---

## 15. Day 7 必学知识点

### 15.1 字符串匹配 vs 行号定位
- 行号方案在多次修改同一文件时会"漂移"。
- 字符串匹配要求 old_string 唯一出现，天然抗漂移。
- Cursor、GitHub Copilot Agent 均使用类似方案。

### 15.2 execSync vs execAsync
- Day 7 用 `execSync`（同步阻塞执行）：简单直接，超时后自动终止。
- 缺点：执行期间阻塞 Node.js 主线程。对于教程规模足够。
- 生产环境应使用 `execAsync` + 流式输出。

### 15.3 simple-git 无状态设计
- 每次调用 `simpleGit(repoPath)` 创建新实例。
- 不持有全局 git 实例，避免多工作区切换时的状态污染。
- 性能代价极低（simple-git 内部只是封装 git CLI 调用）。

### 15.4 模态框设计的三要素
1. **遮罩层**：防止与背景交互，提供视觉聚焦。
2. **多种关闭方式**：Escape / 遮罩点击 / 关闭按钮，满足不同用户习惯。
3. **打开时加载数据**：避免显示旧数据。

---

## 16. Day 7 检查项
1. `npm run dev` 可正常启动。
2. Activity Bar 有 📁 文件、⎇ Git、⚙ 设置三个图标。
3. 切换到 Git 面板可见当前分支和文件状态。
4. 设置对话框可保存 API Key，重启后仍生效。
5. 在 Chat 中让 Agent 修改文件，`edit_file` 工具被调用且修改成功。
6. 在 Chat 中让 Agent 执行命令，`run_command` 工具返回输出。
7. VS Code 中无新增 TypeScript 报错。
