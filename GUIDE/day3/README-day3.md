# Day 3：文件系统服务、文件树与 Monaco 打通

## 前言
Day 1 我们完成了 Electron + React + TypeScript 的基础骨架，Day 2 完成了 Monaco 与 Xterm 的可交互闭环。

Day 3 的目标是把 IDE 从“演示界面”推进到“可管理工作区”的阶段：

1. 在主进程实现受控文件系统服务（读取目录树、读取文件内容）。
2. 通过 IPC 把文件系统能力安全暴露给渲染进程。
3. 在侧边栏渲染递归文件树，点击文件后在 Monaco 打开真实内容。

完成 Day 3 后，你将拥有一个“能浏览工作区并打开真实文件”的最小 IDE 核心。

---

## 1. 本日增量目标

### 1.1 功能目标
1. 左侧显示当前工作区的目录树（可展开/收起）。
2. 点击文件节点后，Monaco 显示该文件内容并高亮对应语言。
3. 保持 Day 2 的终端能力可用。

### 1.2 工程目标
1. 文件系统操作只在主进程执行，渲染进程不直接访问 Node 高权限 API。
2. 文件读取必须进行路径边界校验，防止越界访问（路径穿越）。
3. 继续保持 TypeScript 无假错误，API 类型在渲染层可补全、可校验。

---

## 2. 运行步骤

### 2.1 安装依赖
```powershell
Set-Location .\GUIDE\day3
npm install
```

### 2.2 启动项目
```powershell
npm run dev
```

### 2.3 预期现象
1. Electron 窗口正常启动。
2. 侧边栏顶部显示工作区根目录。
3. 文件树出现目录与文件节点，目录支持展开/收起。
4. 点击任意文本文件后：
   - 状态栏显示 `Opened: 文件名`
   - Monaco 显示该文件真实内容
5. 下方面板终端显示 `Day 3 Terminal Ready`，可继续执行命令。

---

## 3. Day 3 变更结构（相对 Day 2）

```text
day3/
├─ electron/
│  ├─ main.ts                            (修改：改为统一注册 IPC 模块)
│  ├─ preload.ts                         (修改：暴露 getFileTree/readFile)
│  ├─ ipc/
│  │  ├─ index.ts                        (新增：统一注册入口)
│  │  ├─ terminal.ipc.ts                 (新增：终端 IPC 独立模块)
│  │  └─ file-system.ipc.ts              (新增：文件系统 IPC 模块)
│  └─ services/
│     └─ file-system.service.ts          (新增：文件树与读文件服务)
├─ src/
│  ├─ components/
│  │  ├─ file-explorer/
│  │  │  ├─ FileExplorer.tsx             (新增：文件树容器)
│  │  │  └─ FileTreeItem.tsx             (新增：递归节点)
│  │  ├─ editor/
│  │  │  └─ MonacoWrapper.tsx            (修改：展示真实文件)
│  │  ├─ layout/
│  │  │  ├─ Sidebar.tsx                  (修改：接入 FileExplorer)
│  │  │  ├─ StatusBar.tsx                (修改：显示当前打开文件)
│  │  │  └─ AppLayout.tsx                (修改：注释与阶段语义更新)
│  │  └─ terminal/
│  │     └─ TerminalInstance.tsx         (修改：终端欢迎文案 Day 3)
│  ├─ stores/
│  │  └─ editor.store.ts                 (修改：增加 openFilePath/openFileContent)
│  └─ vite-env.d.ts                      (修改：补充文件树相关类型)
├─ package.json                          (修改：Day 3 项目标识)
└─ README-day3.md                        (新增)
```

---

## 4. 主进程增量一：文件系统服务（核心）

### 4.1 文件 `electron/services/file-system.service.ts`
文件导读：
- 技术栈：Node.js `fs/promises` + `path` + TypeScript 接口建模。
- 语法重点：联合类型、可选属性、`async/await`、递归函数。
- 文件作用：提供“读取目录树”和“读取文本文件”能力。
- 关系：仅被 `electron/ipc/file-system.ipc.ts` 调用，不直接暴露给渲染进程。

关键代码（接口定义）：
```ts
export interface FileTreeNode {
  name: string
  path: string
  relativePath: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
}
```

解释：
1. `type: 'file' | 'directory'` 是联合字面量类型，前端可以据此分支渲染图标与行为。
2. `children?` 用可选属性表示“仅目录节点有子节点”。

关键代码（越界保护）：
```ts
private ensureInsideWorkspace(targetPath: string): string {
  const absolutePath = isAbsolute(targetPath)
    ? resolve(targetPath)
    : resolve(this.workspaceRoot, targetPath)

  const rel = relative(this.workspaceRoot, absolutePath)

  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error('访问路径超出工作区范围。')
  }

  return absolutePath
}
```

解释：
1. 允许传入绝对或相对路径，但最终都归一化到绝对路径。
2. 使用 `relative(workspaceRoot, absolutePath)` 判断是否逃逸到工作区外。
3. 命中越界条件直接抛错，阻断潜在敏感目录访问。

关键代码（递归目录读取）：
```ts
private async readDirectory(directoryPath: string): Promise<FileTreeNode[]> {
  const entries = await readdir(directoryPath, { withFileTypes: true })

  const visibleEntries = entries
    .filter((entry) => {
      if (entry.name === '.DS_Store') return false
      if (entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)) return false
      return true
    })
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1
      if (!a.isDirectory() && b.isDirectory()) return 1
      return a.name.localeCompare(b.name)
    })

  const tree: FileTreeNode[] = []

  for (const entry of visibleEntries) {
    const fullPath = resolve(directoryPath, entry.name)
    const relativePath = relative(this.workspaceRoot, fullPath).split(sep).join('/')

    if (entry.isDirectory()) {
      let children: FileTreeNode[] = []
      try {
        children = await this.readDirectory(fullPath)
      } catch {
        children = []
      }

      tree.push({ name: entry.name, path: fullPath, relativePath, type: 'directory', children })
      continue
    }

    tree.push({ name: entry.name, path: fullPath, relativePath, type: 'file' })
  }

  return tree
}
```

解释：
1. `withFileTypes: true` 让返回值直接携带“文件/目录”元信息，避免额外 `stat` 开销。
2. 过滤 `node_modules`、`.git`、`out`、`dist`，提升加载速度和可读性。
3. 排序策略：目录在前，文件在后，名称字典序。
4. 递归处理目录节点；个别目录无权限时吞掉错误并继续，保证整体可用性。
5. `split(sep).join('/')` 统一路径分隔符，避免跨平台展示不一致。

---

## 5. 主进程增量二：IPC 分层注册

### 5.1 文件 `electron/ipc/file-system.ipc.ts`
文件导读：
- 技术栈：Electron `ipcMain.handle`。
- 作用：把文件系统服务封装成两个通道：
  - `file-system:get-tree`
  - `file-system:read-file`
- 关系：由 `electron/ipc/index.ts` 统一注册。

关键点：
1. `ipcMain.removeHandler(...)` 先解绑旧 handler，避免开发期热更新导致重复注册报错。
2. `get-tree` 返回 `{ workspaceRoot, tree }`，前端可同时显示根目录与树结构。

### 5.2 文件 `electron/ipc/terminal.ipc.ts`
文件导读：
- 作用：将 Day 2 的终端 IPC 独立成模块，保持职责单一。
- 价值：主进程入口不再堆积大量 `ipcMain.handle` 逻辑，后续扩展更容易。

### 5.3 文件 `electron/ipc/index.ts`
文件导读：
- 作用：聚合注册函数，作为 IPC 的唯一入口。
- 关系：`main.ts` 只调用 `registerIpcHandlers()`。

### 5.4 文件 `electron/main.ts`
关键变更：
```ts
import { registerIpcHandlers } from './ipc'

app.whenReady().then(() => {
  // ...省略初始化
  registerIpcHandlers()
  createWindow()
})
```

解释：
1. `main.ts` 只做生命周期控制与窗口管理。
2. 业务能力（终端、文件系统）下沉到 `ipc/` 模块。

---

## 6. 预加载层与类型契约

### 6.1 文件 `electron/preload.ts`
文件导读：
- 技术栈：`contextBridge` + `ipcRenderer.invoke`。
- 作用：向渲染进程暴露白名单 API。
- 关系：与 `src/vite-env.d.ts` 的类型声明成对维护。

关键代码：
```ts
const api = {
  runCommand: (command: string) => ipcRenderer.invoke('terminal:run-command', command),
  getFileTree: () => ipcRenderer.invoke('file-system:get-tree'),
  readFile: (filePath: string) => ipcRenderer.invoke('file-system:read-file', filePath)
}
```

解释：
1. 渲染层只看到“函数接口”，看不到 Node 细节。
2. 所有高权限能力都必须经过 preload 白名单审核。

### 6.2 文件 `src/vite-env.d.ts`
文件导读：
- 作用：声明渲染层全局 API 类型，消除 TS 假错误。
- 重点：新增 `FileTreeNode`、`WorkspaceTreeResult`、`RendererApi`。

类型价值：
1. 前端开发时，`window.api.getFileTree()` 有明确返回结构提示。
2. 组件间传递 `FileTreeNode` 时具备静态校验，减少运行时错误。

---

## 7. 渲染层增量：文件树 -> 打开文件 -> Monaco

### 7.1 文件 `src/stores/editor.store.ts`
文件导读：
- 技术栈：Zustand。
- 作用：把“当前打开文件路径 + 内容”提升为全局状态。
- 关系：FileExplorer 写入，Monaco/StatusBar 读取。

关键状态：
```ts
openFilePath: string | null
openFileContent: string
setOpenFile: (filePath: string, content: string) => void
setOpenFileContent: (content: string) => void
```

解释：
1. `setOpenFile` 用于“从文件树打开文件”场景，一次性更新路径与内容。
2. `setOpenFileContent` 用于 Monaco 编辑时同步内容。

### 7.2 文件 `src/components/file-explorer/FileExplorer.tsx`
文件导读：
- 技术栈：React Hooks（`useState` / `useEffect`）+ IPC 调用。
- 作用：加载文件树、展示状态、处理文件点击读取。
- 关系：组合 `FileTreeItem`，并调用 `useEditorStore` 写入当前文件。

关键流程：
1. 首次挂载执行 `loadTree()`。
2. `window.api.getFileTree()` 拉取数据后写入 `workspaceRoot` 和 `treeNodes`。
3. 点击文件节点时调用 `window.api.readFile(node.path)`。
4. 成功后执行 `setOpenFile(node.path, content)`，驱动 Monaco 与状态栏更新。

### 7.3 文件 `src/components/file-explorer/FileTreeItem.tsx`
文件导读：
- 技术栈：递归 React 组件。
- 作用：渲染单个节点并递归渲染子节点。
- 关系：被 `FileExplorer` 递归调用。

关键语法点：
1. `node.type === 'directory'` 分支切换“展开/收起”行为。
2. `isExpanded && node.children?.length` 决定是否递归渲染。
3. `style={{ paddingLeft: `${depth * 14 + 8}px` }}` 根据深度产生缩进。

### 7.4 文件 `src/components/editor/MonacoWrapper.tsx`
文件导读：
- 作用：根据当前打开文件显示对应内容与语言。
- 关系：读取 `openFilePath/openFileContent`，编辑时回写 store。

关键逻辑：
1. `getLanguageByFilePath` 根据扩展名映射 Monaco language。
2. 未打开文件时显示 Day 3 引导文本。
3. `onChange` 仅在已有打开文件时回写内容。

### 7.5 文件 `src/components/layout/Sidebar.tsx`
文件导读：
- 作用：把 Day 2 占位侧边栏替换为真实 `FileExplorer`。
- 关系：保持原有关闭按钮逻辑，兼容全局布局。

### 7.6 文件 `src/components/layout/StatusBar.tsx`
文件导读：
- 作用：显示 Day 3 阶段标识与当前文件名。
- 技术点：`useMemo` 对文件名计算结果做轻量缓存。

### 7.7 文件 `src/components/terminal/TerminalInstance.tsx`
变更说明：
- 仅更新欢迎文案为 `Day 3 Terminal Ready`，其余终端能力沿用 Day 2。

---

## 8. Day 3 必学知识点（零基础展开）

### 8.1 为什么文件系统必须在主进程
1. 渲染进程是 UI 层，权限应尽可能低。
2. 文件系统读写属于高权限操作，必须受控。
3. preload 作为“能力网关”，只暴露最小 API 面。

### 8.2 路径穿越防护（Path Traversal）
典型风险：用户构造 `../../` 访问工作区外文件。

Day 3 做法：
1. 所有输入路径先归一化成绝对路径。
2. 计算相对路径并判断是否逃逸。
3. 逃逸则抛错，拒绝访问。

### 8.3 递归树结构与复杂度
1. 每个目录节点都可能包含子节点，因此数据天然是递归结构。
2. 组件递归渲染与数据递归构建一一对应，思维模型统一。
3. 复杂度近似与“目录总节点数”线性相关，过滤大目录可显著提速。

### 8.4 为什么 Day 3 对 Agent 很关键
后续 Agent 工具（如 `list_files`、`read_file`）本质上都依赖安全文件系统层。

Day 3 搭好的这层能力，将在 Day 5 直接复用：
1. 文件树服务可映射为 `list_files` 工具输入源。
2. 读文件服务可映射为 `read_file` 工具执行器。
3. IPC 与类型契约为模型工具调用提供稳定接口基础。

---

## 9. 完整运行流程追踪（从点击文件到 Monaco 渲染）

场景：用户在左侧点击 `package.json`。

### 9.1 前端点击事件
1. `FileTreeItem` 判断节点类型为 `file`。
2. 调用 `onOpenFile(node)`，实际进入 `FileExplorer.handleOpenFile`。

### 9.2 渲染进程请求主进程
1. `handleOpenFile` 调用 `window.api.readFile(node.path)`。
2. preload 将其转发为 `ipcRenderer.invoke('file-system:read-file', path)`。

### 9.3 主进程处理
1. `file-system.ipc.ts` 接收请求。
2. 调用 `FileSystemService.readTextFile(filePath)`。
3. `ensureInsideWorkspace` 做路径边界检查。
4. 通过后读取文件文本并返回字符串。

### 9.4 回到渲染层更新状态
1. `setOpenFile(node.path, content)` 更新 Zustand。
2. `MonacoWrapper` 订阅到新状态，`value` 切换到真实文件内容。
3. `StatusBar` 订阅到新路径，显示 `Opened: package.json`。

到此，完成一次端到端链路：
“文件树点击 -> IPC -> 文件系统服务 -> 状态更新 -> 编辑器渲染”。

---

## 10. 验证清单

启动后请按顺序检查：

1. 文件树能加载，且看不到 `node_modules`、`.git`、`out`、`dist`。
2. 目录可展开/收起，文件节点可高亮当前选中项。
3. 点击 `.ts/.tsx/.json/.md` 文件，Monaco 语言高亮匹配扩展名。
4. 状态栏正确显示当前打开文件名。
5. 终端可执行 `node -v` 并输出结果。

---

## 11. 常见问题

### 11.1 文件树为空
1. 确认是从 `GUIDE/day3` 目录启动。
2. 确认当前目录确实存在可显示文件。

### 11.2 点击文件报“访问路径超出工作区范围”
1. 说明路径校验生效，通常是传入了不正确路径。
2. 检查前端是否使用了节点自带的 `node.path`。

### 11.3 某些目录没有展开内容
1. 可能是权限受限目录。
2. Day 3 设计为“忽略单个目录错误，保证整体可用”。

---

## 12. 下一步（Day 4 预告）

Day 4 将进入 AI 能力接入阶段：
1. 增加 Chat 面板与消息流。
2. 接入首个 LLM Provider（OpenAI 兼容接口）。
3. 打通流式响应，让 UI 实时显示模型输出。

此时你已经具备：
- 可浏览工作区
- 可打开真实文件
- 可执行终端命令

这三者将成为后续 Agent 自动化能力的基础输入与执行环境。
