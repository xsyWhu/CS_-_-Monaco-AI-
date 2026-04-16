# Day 2：接入 Monaco 编辑器、Xterm 终端与基础 IPC

## 前言
Day 1 完成了 Electron + React + TypeScript 的三层架构和 IDE 骨架。Day 2 的目标是将“占位区域”升级为真实可交互模块：

1. 在编辑区接入 Monaco 编辑器。
2. 在终端区接入 Xterm 前端终端。
3. 打通渲染进程到主进程的最小 IPC 通道，实现终端命令执行。

完成 Day 2 后，项目将从“静态框架”进入“可交互开发工具”阶段。

## 1. 本日增量目标

### 1.1 功能目标
1. 编辑区显示可用的 TypeScript 编辑器。
2. 终端区支持输入命令并显示输出。
3. 保持 Day 1 的布局、状态管理和安全边界不回退。

### 1.2 工程目标
1. 增加必要依赖但不引入复杂后端服务。
2. 继续保持 VS Code 类型检查无假错误。
3. 文档以“可执行步骤 + 文件讲解 + 全流程追踪”的方式组织。

## 2. 运行步骤

### 2.1 安装依赖
```powershell
Set-Location .\GUIDE\day2
npm install
```

### 2.2 启动项目
```powershell
npm run dev
```

### 2.3 预期现象
1. Electron 窗口正常启动。
2. 上半区出现 Monaco 编辑器，带 TypeScript 示例代码。
3. 下半区出现 Xterm，显示 `Day 2 Terminal Ready` 和提示符 `PS > `。
4. 在终端输入 `node -v` 后回车，能看到版本输出。

## 3. Day 2 项目结构（与 Day 1 相比）
```text
day2/
├─ electron/
│  ├─ main.ts                    (修改：增加 terminal IPC handler)
│  └─ preload.ts                 (修改：暴露 runCommand API)
├─ src/
│  ├─ components/
│  │  ├─ editor/
│  │  │  └─ MonacoWrapper.tsx    (新增)
│  │  ├─ terminal/
│  │  │  └─ TerminalInstance.tsx (新增)
│  │  └─ layout/
│  │     ├─ AppLayout.tsx        (修改：替换占位为真实组件)
│  │     └─ StatusBar.tsx        (修改：阶段信息)
│  └─ vite-env.d.ts              (修改：声明 window.api 类型)
├─ package.json                  (修改：新增 Monaco/Xterm 依赖)
└─ README-day2.md                (新增)
```

说明：其余未列出的文件保持 Day 1 版本不变，作用与解释沿用 Day 1 文档。

## 4. 增量实现一：Monaco 编辑器

### 4.1 文件 [src/components/editor/MonacoWrapper.tsx](src/components/editor/MonacoWrapper.tsx)
文件导读：
该组件封装 Monaco 编辑器，职责是“提供一个可编辑代码区域”。它是纯渲染组件，不涉及 IPC，不保存全局状态。技术点包括第三方 React 组件使用、TS 字符串模板、编辑器 options 配置。

代码：
```tsx
import Editor from '@monaco-editor/react'

const INITIAL_CODE = `function greet(name: string): string {
  return \`Hello, ${name}!\`
}

console.log(greet('Day2'))
`

export default function MonacoWrapper() {
  return (
    <Editor
      height="100%"
      defaultLanguage="typescript"
      defaultValue={INITIAL_CODE}
      theme="vs-dark"
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        automaticLayout: true,
        wordWrap: 'on',
        scrollBeyondLastLine: false
      }}
    />
  )
}
```

逐行解释：
1. 导入 Monaco 的 React 封装组件。
2. 定义初始示例代码字符串。
3. 示例函数展示 TypeScript 参数类型与返回类型。
4. 组件返回 Editor。
5. `height="100%"` 让编辑器填满容器。
6. `defaultLanguage="typescript"` 启用 TS 语法高亮。
7. `defaultValue` 注入初始代码。
8. `theme="vs-dark"` 使用深色主题。
9. `options` 关闭 minimap、开启自动布局和换行，提升教学可读性。

### 4.2 文件 [src/components/layout/AppLayout.tsx](src/components/layout/AppLayout.tsx) 中的集成变更
文件导读：
`AppLayout.tsx` 是 Day 2 的组件装配点。新增能力（Monaco、Xterm）都通过它挂载到既有布局中。

关键变更代码：
```tsx
import MonacoWrapper from '../editor/MonacoWrapper'
import TerminalInstance from '../terminal/TerminalInstance'
```

```tsx
<Panel defaultSize={70}>
  <div className="h-full bg-background border-b border-border">
    <MonacoWrapper />
  </div>
</Panel>
```

说明：
1. Day 1 的编辑区占位文本已删除。
2. 通过 `MonacoWrapper` 实现真实编辑能力。
3. 外层容器保留原有边框与布局样式，保证视觉一致性。

## 5. 增量实现二：Xterm 终端 + IPC 命令执行

### 5.1 文件 [electron/main.ts](electron/main.ts)
文件导读：
该文件仍是主进程入口。Day 2 在不破坏既有逻辑的前提下，新增一个 IPC handler：接收渲染进程传来的命令字符串，在主进程执行并返回结果。

关键变更代码：
```ts
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
```

```ts
ipcMain.handle('terminal:run-command', async (_event, command: string) => {
  if (!command || !command.trim()) {
    return { stdout: '', stderr: '命令为空。', code: 1 }
  }

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: process.cwd(),
      windowsHide: true,
      maxBuffer: 1024 * 1024
    })

    return { stdout, stderr, code: 0 }
  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string; message?: string; code?: number }

    return {
      stdout: execError.stdout ?? '',
      stderr: execError.stderr ?? execError.message ?? '命令执行失败。',
      code: execError.code ?? 1
    }
  }
})
```

逐段解释：
1. `ipcMain.handle` 定义“请求-响应”式 IPC 接口。
2. 渲染进程使用 `invoke` 调用后，会拿到 Promise 返回结果。
3. 空命令先行返回，避免无意义执行。
4. 使用 `execAsync` 执行命令并捕获标准输出/错误输出。
5. 无论成功或失败，返回统一结构 `{ stdout, stderr, code }`，便于前端统一渲染。

### 5.2 文件 [electron/preload.ts](electron/preload.ts)
文件导读：
preload 负责把主进程能力安全地暴露给渲染进程。Day 2 新增 `runCommand`，这是终端最小可用 API。

关键变更代码：
```ts
import { contextBridge, ipcRenderer } from 'electron'
```

```ts
const api = {
  runCommand: (command: string) => ipcRenderer.invoke('terminal:run-command', command)
}
```

说明：
1. 渲染层不直接访问 `ipcMain`，只能通过 `window.api` 调用白名单函数。
2. 这是 Electron 安全模型中的推荐模式。

### 5.3 文件 [src/components/terminal/TerminalInstance.tsx](src/components/terminal/TerminalInstance.tsx)
文件导读：
该组件是 Day 2 的核心交互组件。它封装了 Xterm 生命周期、输入缓冲、回车提交、后端调用与输出回显。技术点覆盖：React `useEffect` / `useRef`、异步函数、键盘输入流处理。

代码：
```tsx
import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

const PROMPT = 'PS > '

export default function TerminalInstance() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const commandBufferRef = useRef('')

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      convertEol: true,
      theme: {
        background: '#252526',
        foreground: '#cccccc'
      }
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)

    terminal.open(containerRef.current)
    fitAddon.fit()

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    terminal.writeln('Day 2 Terminal Ready')
    terminal.write(PROMPT)

    const runCommand = async (command: string) => {
      const result = await window.api.runCommand(command)

      if (result.stdout) {
        terminal.writeln(result.stdout.replace(/\r?\n/g, '\r\n'))
      }

      if (result.stderr) {
        terminal.writeln(result.stderr.replace(/\r?\n/g, '\r\n'))
      }

      terminal.write(PROMPT)
    }

    const onDataDisposable = terminal.onData(async (data) => {
      if (data === '\r') {
        const command = commandBufferRef.current.trim()
        terminal.write('\r\n')

        if (command.length > 0) {
          await runCommand(command)
        } else {
          terminal.write(PROMPT)
        }

        commandBufferRef.current = ''
        return
      }

      if (data === '\u0003') {
        commandBufferRef.current = ''
        terminal.write('^C\r\n')
        terminal.write(PROMPT)
        return
      }

      if (data === '\u007f') {
        if (commandBufferRef.current.length > 0) {
          commandBufferRef.current = commandBufferRef.current.slice(0, -1)
          terminal.write('\b \b')
        }
        return
      }

      if (data >= ' ') {
        commandBufferRef.current += data
        terminal.write(data)
      }
    })

    const onResize = () => {
      fitAddon.fit()
    }

    window.addEventListener('resize', onResize)

    return () => {
      onDataDisposable.dispose()
      window.removeEventListener('resize', onResize)
      terminal.dispose()
    }
  }, [])

  return <div ref={containerRef} className="h-full w-full" />
}
```

逐段解释：
1. 初始化阶段创建 `Terminal` 与 `FitAddon`，并绑定到容器 DOM。
2. `commandBufferRef` 保存用户当前输入命令。
3. 按回车时读取缓冲并调用 `window.api.runCommand`。
4. 输出统一做换行标准化：`\n` 转 `\r\n`，保证终端显示正确。
5. 处理 `Ctrl+C` 和退格键，保证最小交互体验。
6. 监听窗口尺寸变化并 `fit()`，避免终端显示截断。
7. 在组件卸载时释放事件与终端实例，避免内存泄漏。

### 5.4 文件 [src/vite-env.d.ts](src/vite-env.d.ts)
文件导读：
该声明文件补齐运行时全局对象类型，避免渲染端访问 `window.api` 时出现 TS 错误。

代码：
```ts
/// <reference types="vite/client" />

declare module '*.css'

interface TerminalCommandResult {
  stdout: string
  stderr: string
  code: number
}

interface RendererApi {
  runCommand: (command: string) => Promise<TerminalCommandResult>
}

declare global {
  interface Window {
    api: RendererApi
  }
}
```

解释：
1. 定义终端返回结构，让调用方拿到完整类型提示。
2. 扩展全局 `Window`，使 `window.api.runCommand` 在 TS 中合法且可补全。

### 5.5 文件 [src/components/layout/StatusBar.tsx](src/components/layout/StatusBar.tsx)
文件导读：
更新状态栏文案以反映当前阶段能力，帮助读者和开发者确认运行的是 Day 2 版本。

关键变更代码：
```tsx
<span className="font-semibold">Day 2 Monaco + Xterm</span>
<span>Editor & Terminal Integrated</span>
```

## 6. Day 2 必学知识点（零基础展开）

### 6.1 IPC 的请求-响应模型
1. 主进程：`ipcMain.handle(channel, handler)`。
2. 渲染进程：`ipcRenderer.invoke(channel, payload)`。
3. 返回值：`invoke` 会拿到 Promise，值来自 `handler` 的返回。

### 6.2 为什么终端命令必须在主进程执行
1. 渲染进程权限低，不应直接执行系统命令。
2. 主进程可控、可审计，便于后续做白名单和安全策略。
3. preload 可限制暴露面，避免把所有能力直接给前端页面。

### 6.3 React 中 useRef 与 useEffect 的组合意义
1. `useRef` 保存“跨渲染周期不触发重渲染”的可变对象（例如 terminal 实例、命令缓冲）。
2. `useEffect(() => {...}, [])` 只在挂载时执行一次，适合初始化第三方实例。
3. 清理函数负责释放资源，避免事件重复绑定。

### 6.4 异步与错误处理
1. `await window.api.runCommand(...)` 等待 IPC 结果。
2. 主进程统一 catch 错误并返回结构化对象。
3. 渲染层无需 try/catch 解析复杂异常，只需渲染 `stdout/stderr`。

## 7. 完整运行流程追踪（真实示例）

示例任务：在 Day 2 终端输入 `node -v` 并回车，看到版本号输出。

### 7.1 用户输入到 Xterm 事件
1. 用户在终端输入 `node -v`。
2. `terminal.onData` 逐字符接收输入并写入 `commandBufferRef`。
3. 用户回车后进入 `if (data === '\r')` 分支。

### 7.2 渲染进程发起 IPC
```ts
const result = await window.api.runCommand(command)
```
1. `window.api` 来自 preload 暴露。
2. 调用后通过 `ipcRenderer.invoke` 把命令发往主进程。

### 7.3 主进程执行命令
```ts
ipcMain.handle('terminal:run-command', async (_event, command: string) => {
  const { stdout, stderr } = await execAsync(command, { ... })
  return { stdout, stderr, code: 0 }
})
```
1. 主进程接收命令。
2. `execAsync` 执行后收集输出。
3. 返回结构化结果给渲染进程。

### 7.4 渲染进程回显结果
```ts
if (result.stdout) {
  terminal.writeln(result.stdout.replace(/\r?\n/g, '\r\n'))
}
terminal.write(PROMPT)
```
1. 将 `stdout` 写入终端。
2. 打印下一次提示符，等待下一条命令。

### 7.5 这条链路的工程价值
1. 完整覆盖了 UI 输入 -> IPC -> 系统执行 -> UI 反馈。
2. 这是未来 Agent 执行工具调用的同构链路。
3. Day 3 以后只需替换“命令来源”（用户输入 -> Agent 决策）即可复用该通道。

## 8. Day 2 检查项
1. `npm run dev` 可正常启动。
2. 编辑区 Monaco 可编辑文本。
3. 终端区输入 `node -v` 有输出。
4. 终端空命令会提示“命令为空。”
5. VS Code 中无新增 TypeScript 报错。
