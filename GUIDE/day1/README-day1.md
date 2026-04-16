# Day 1：基础设施搭建（逐文件逐行过程指南）

## 前言
本项目的目标是构建一个类似 Cursor 的 Agent IDE。所谓 Agent IDE，不仅是“能编辑代码的界面”，而是具备“理解任务、调用工具、执行修改、反馈结果”的系统化开发环境。

为了让没有相关经验的团队能够稳定上手，整个教程采用分日递进方式。Day 1 不追求一次性实现智能能力，而是优先完成最关键的工程底座：

1. 建立 Electron 主进程、预加载桥接层、渲染进程三层结构。
2. 建立可扩展的 IDE 骨架界面（活动栏、侧栏、编辑区、终端区、状态栏）。
3. 建立最小状态管理闭环（读写同一状态并驱动 UI 更新）。
4. 建立统一的 TypeScript/VS Code 配置，保证教学环境可复现。

你可以把 Day 1 理解为“打地基”：后续 Day 2 及之后的 Monaco、终端、文件系统、模型调用、Tool Registry、Agent Loop 与 RAG，都会依赖今天的结构和边界。

## 1. 使用说明与阅读方式
本文是 Day 1 的严格过程式文档，要求读者按顺序完成以下动作：

1. 运行项目并观察效果。
2. 按文档顺序打开文件。
3. 对照每个文件的“代码引用”与“逐行解释”。

本文中所有代码引用均通过代码块给出，不使用超链接。

## 2. 运行步骤

### 2.1 进入目录并安装依赖
```powershell
Set-Location .\GUIDE\day1
npm install
```

### 2.2 启动开发环境
```powershell
npm run dev
```

### 2.3 预期结果
1. 启动日志出现 `electron-vite dev`。
2. 弹出桌面窗口。
3. 看到 IDE 骨架界面（活动栏、侧边栏、主编辑区占位、终端占位、状态栏）。

## 3. Day 1 项目结构
```text
day1/
├─ .vscode/
│  └─ settings.json
├─ electron/
│  ├─ main.ts
│  └─ preload.ts
├─ src/
│  ├─ index.html
│  ├─ main.tsx
│  ├─ App.tsx
│  ├─ main.css
│  ├─ vite-env.d.ts
│  ├─ components/
│  │  └─ layout/
│  │     ├─ AppLayout.tsx
│  │     ├─ Sidebar.tsx
│  │     └─ StatusBar.tsx
│  └─ stores/
│     └─ editor.store.ts
├─ package.json
├─ electron.vite.config.ts
├─ tsconfig.json
├─ tsconfig.node.json
└─ tsconfig.web.json
```

## 4. 执行链路总览
先建立整体理解，再进入逐文件逐行解释。

```text
npm run dev
  -> package.json scripts.dev
  -> electron-vite 读取 electron.vite.config.ts
  -> 启动主进程 electron/main.ts
  -> BrowserWindow 加载 renderer
  -> renderer 入口 src/index.html -> src/main.tsx -> src/App.tsx -> AppLayout
```

## 5. 逐文件逐行解释（覆盖 Day 1 全部源码与配置）

### 5.1 package.json

文件导读：
`package.json` 是 Node.js 项目的元数据与依赖清单文件，也是整个工程的构建入口之一。对于 TypeScript/React/Electron 项目，初学者应优先理解三类字段：`scripts`（如何运行项目）、`dependencies`（运行时必须安装的库）、`devDependencies`（仅开发与构建时需要的库）。本文件与 `electron.vite.config.ts` 直接关联：前者通过 `npm run dev` 触发命令，后者定义被触发后具体如何构建 main/preload/renderer 三端代码。

代码引用：
```json
{
  "name": "my-agent-ide-day1",
  "version": "1.0.0",
  "description": "Day 1: Basic Infrastructure",
  "main": "./out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev"
  },
  "dependencies": {
    "clsx": "^2.1.1",
    "lucide-react": "^0.468.0",
    "react-resizable-panels": "^2.1.0",
    "zustand": "^5.0.0",
    "@electron-toolkit/preload": "^3.0.1",
    "@electron-toolkit/utils": "^3.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "electron": "^35.0.0",
    "electron-vite": "^3.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  }
}
```

逐行解释：
1. 第 1 行：JSON 对象开始。
2. 第 2 行：项目名，区分 day1 产物。
3. 第 3 行：项目版本。
4. 第 4 行：项目描述。
5. 第 5 行：Electron 生产入口文件路径。
6. 第 6 行：脚本配置对象开始。
7. 第 7 行：定义开发命令，调用 `electron-vite dev`。
8. 第 8 行：脚本对象结束。
9. 第 9 行：运行时依赖对象开始。
10. 第 10-17 行：声明 Day 1 用到的运行时库（UI、状态、Electron 工具、React）。
11. 第 18 行：运行时依赖对象结束。
12. 第 19 行：开发依赖对象开始。
13. 第 20-29 行：声明构建、类型、编译、框架相关工具。
14. 第 30 行：开发依赖对象结束。
15. 第 31 行：JSON 对象结束。

### 5.2 electron.vite.config.ts

文件导读：
该文件是 Electron + Vite 组合工程的核心构建配置。技术上它体现了一个重要语法与工程观念：同一个仓库中存在多个运行时目标（Node 主进程、Preload 桥接脚本、浏览器渲染进程），需要分开配置、分别编译。初学者在这里要重点理解“配置对象的层次结构”和“路径解析函数 `resolve` 的用途”。此文件上游由 `package.json` 的脚本触发，下游决定 `electron/main.ts` 与 `src/main.tsx` 等入口文件是否被正确编译和加载。

代码引用：
```ts
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/main.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/preload.ts')
        }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src'),
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
```

逐行解释：
1. 第 1 行：导入路径解析函数。
2. 第 2 行：导入 electron-vite 配置函数与依赖外置插件。
3. 第 3 行：导入 React 的 Vite 插件。
4. 第 4 行：导入 Tailwind Vite 插件。
5. 第 5 行：空行，分隔导入区与配置区。
6. 第 6 行：导出默认配置对象。
7. 第 7 行：主进程构建配置开始。
8. 第 8 行：主进程启用依赖外置。
9. 第 9 行：主进程 build 配置开始。
10. 第 10 行：底层 Rollup 配置开始。
11. 第 11 行：入口配置开始。
12. 第 12 行：指定主进程入口文件。
13. 第 13-15 行：依次结束入口、Rollup、build 配置。
14. 第 16 行：结束 main 配置。
15. 第 17 行：preload 构建配置开始。
16. 第 18 行：preload 同样启用依赖外置。
17. 第 19-25 行：指定 preload 入口为 `electron/preload.ts`。
18. 第 26 行：结束 preload 配置。
19. 第 27 行：renderer 配置开始。
20. 第 28 行：指定渲染端根目录为 `src`。
21. 第 29-33 行：设置路径别名 `@` 指向 `src`。
22. 第 34 行：启用 React 与 Tailwind 插件。
23. 第 35 行：结束 renderer 配置。
24. 第 36 行：结束整个配置对象。

### 5.3 electron/main.ts

文件导读：
该文件运行在 Electron 主进程（Node.js 环境），负责应用生命周期管理、窗口创建和安全策略设定。它不负责渲染 UI，而是负责“启动 UI 的容器”。语法上这里包含 TypeScript 函数返回类型、回调函数、对象字面量配置、条件分支等基础能力。这个文件与 `electron/preload.ts` 强耦合：`main.ts` 在 `webPreferences.preload` 中声明桥接脚本路径；与 `src/index.html` 间接耦合：窗口最终会加载渲染端页面。

代码引用：
```ts
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

function createWindow(): void {
  // 创建主窗口：Day 1 只负责搭建可运行骨架，不注入业务逻辑。
  const mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      // preload 负责桥接安全 API（渲染进程不能直接拿到 Node 高权限能力）。
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  // 等待页面资源准备好再显示窗口，避免用户看到白屏闪烁。
  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // 阻止新窗口在应用内打开，统一交给系统浏览器处理外链。
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // 开发环境走 Vite dev server，生产环境加载打包后的 html。
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
  
  // Day 1 默认打开开发者工具，便于教学阶段观察运行状态。
  if (is.dev) {
    mainWindow.webContents.openDevTools()
  }
}

app.whenReady().then(() => {
  // Windows 平台任务栏与通知等系统行为依赖该 AppUserModelId。
  electronApp.setAppUserModelId('com.electron')

  // 注册开发期快捷键行为（例如 F12 / Ctrl+R）以贴合本地调试习惯。
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    // macOS 上关闭所有窗口后，点击 Dock 图标通常会重新创建窗口。
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // 遵循 macOS 约定：仅非 darwin 平台在关窗后直接退出进程。
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
```

逐行解释：
1. 第 1 行：导入 Electron 核心对象。
2. 第 2 行：导入路径拼接函数。
3. 第 3 行：导入工具库中的应用辅助能力。
4. 第 4 行：空行。
5. 第 5 行：声明创建窗口函数并标注返回类型 `void`。
6. 第 6 行：注释说明本函数职责。
7. 第 7 行：创建主窗口实例。
8. 第 8 行：设置窗口宽度。
9. 第 9 行：设置窗口高度。
10. 第 10 行：窗口初始不显示。
11. 第 11 行：隐藏默认菜单栏。
12. 第 12 行：Web 偏好设置开始。
13. 第 13 行：注释解释 preload 用途。
14. 第 14 行：配置 preload 脚本路径。
15. 第 15 行：关闭 sandbox。
16. 第 16 行：启用上下文隔离。
17. 第 17-18 行：结束 webPreferences 和 BrowserWindow 配置。
18. 第 19 行：空行。
19. 第 20 行：注释说明 ready-to-show 处理。
20. 第 21 行：监听窗口可显示事件。
21. 第 22 行：在事件触发后显示窗口。
22. 第 23 行：结束事件回调。
23. 第 24 行：空行。
24. 第 25 行：注释说明外链处理策略。
25. 第 26 行：拦截窗口内打开新链接行为。
26. 第 27 行：将 URL 交给系统默认浏览器。
27. 第 28 行：禁止 Electron 内部新窗口打开。
28. 第 29 行：结束拦截处理回调。
29. 第 30 行：空行。
30. 第 31 行：注释说明开发/生产加载差异。
31. 第 32 行：判断开发环境且存在渲染地址。
32. 第 33 行：开发环境加载 dev server URL。
33. 第 34 行：否则分支开始。
34. 第 35 行：生产环境加载本地 HTML。
35. 第 36 行：结束 if 分支。
36. 第 37 行：空行。
37. 第 38 行：注释说明开发工具行为。
38. 第 39 行：判断是否为开发环境。
39. 第 40 行：打开开发者工具。
40. 第 41 行：结束 if。
41. 第 42 行：结束 `createWindow` 函数。
42. 第 43 行：空行。
43. 第 44 行：应用 ready 后执行初始化逻辑。
44. 第 45 行：注释说明设置 AppUserModelId 的目的。
45. 第 46 行：设置应用模型 ID。
46. 第 47 行：空行。
47. 第 48 行：注释说明快捷键监控。
48. 第 49 行：注册窗口创建事件。
49. 第 50 行：挂载快捷键行为。
50. 第 51 行：结束事件处理。
51. 第 52 行：空行。
52. 第 53 行：创建主窗口。
53. 第 54 行：空行。
54. 第 55 行：注册激活事件。
55. 第 56 行：注释解释 macOS 行为。
56. 第 57 行：若当前无窗口则重建窗口。
57. 第 58 行：结束激活回调。
58. 第 59 行：结束 whenReady 回调。
59. 第 60 行：空行。
60. 第 61 行：注册所有窗口关闭事件。
61. 第 62 行：注释说明跨平台退出策略。
62. 第 63 行：判断非 macOS 平台。
63. 第 64 行：退出应用进程。
64. 第 65 行：结束平台判断。
65. 第 66 行：结束关闭事件回调。

### 5.4 electron/preload.ts

文件导读：
`preload.ts` 是 Electron 安全模型中的桥接层，运行在受控上下文中，用于向渲染进程暴露“白名单 API”。初学者应重点理解：为什么不能在渲染进程直接使用 Node 高权限能力；`contextBridge.exposeInMainWorld` 如何将受控对象挂到 `window`；以及 `try/catch` 在初始化阶段兜底错误的意义。本文件在架构上连接 `main.ts`（由其指定路径加载）和渲染进程代码（未来通过 `window.api` 调用）。

代码引用：
```ts
import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// 预留给渲染进程的自定义 API：Day 1 先放空对象，后续逐步扩展。
const api = {}

if (process.contextIsolated) {
  try {
    // 将 toolkit 提供的安全 API 显式挂载到 window.electron。
    contextBridge.exposeInMainWorld('electron', electronAPI)
    // 将业务 API 挂载到 window.api，后续通过 IPC 能力逐步填充。
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // 仅在关闭 contextIsolation 的兜底场景下直接赋值，正常项目不建议依赖该分支。
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
```

逐行解释：
1. 第 1 行：导入安全桥接对象 `contextBridge`。
2. 第 2 行：导入 toolkit 提供的默认 Electron API 封装。
3. 第 3 行：空行。
4. 第 4 行：注释说明 `api` 变量用途。
5. 第 5 行：声明空 API 对象，供后续扩展 IPC 接口。
6. 第 6 行：空行。
7. 第 7 行：判断是否启用了上下文隔离。
8. 第 8 行：进入 `try` 保护块。
9. 第 9 行：注释说明挂载 `window.electron`。
10. 第 10 行：向渲染进程暴露 toolkit API。
11. 第 11 行：注释说明挂载 `window.api`。
12. 第 12 行：暴露自定义 API 对象。
13. 第 13 行：捕获异常分支开始。
14. 第 14 行：打印错误。
15. 第 15 行：结束 `try-catch`。
16. 第 16 行：进入未隔离上下文的兜底分支。
17. 第 17 行：注释说明不建议依赖兜底分支。
18. 第 18 行：忽略下一行 TypeScript 检查。
19. 第 19 行：直接赋值 `window.electron`。
20. 第 20 行：忽略下一行 TypeScript 检查。
21. 第 21 行：直接赋值 `window.api`。
22. 第 22 行：结束 if-else。

### 5.5 src/index.html

文件导读：
该文件是渲染进程页面的静态宿主。它技术上非常简单，但地位关键：如果没有 `#root` 容器，React 无法挂载；如果脚本入口路径错误，界面不会启动。初学者需要建立“HTML 壳 + React 接管”的概念：HTML 提供初始 DOM，React 负责后续全部动态 UI 渲染。本文件与 `src/main.tsx` 一一对应。

代码引用：
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Day 1 IDE Frame</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

逐行解释：
1. 第 1 行：声明 HTML5 文档类型。
2. 第 2 行：HTML 根标签，语言设为英文。
3. 第 3 行：头部开始。
4. 第 4 行：设置字符编码 UTF-8。
5. 第 5 行：设置移动端视口缩放策略。
6. 第 6 行：页面标题。
7. 第 7 行：头部结束。
8. 第 8 行：正文开始。
9. 第 9 行：React 挂载容器。
10. 第 10 行：以 ES Module 方式加载 `main.tsx`。
11. 第 11 行：正文结束。
12. 第 12 行：HTML 结束。

### 5.6 src/main.tsx

文件导读：
`main.tsx` 是 React 渲染入口文件，负责将根组件挂载到页面。语法上同时体现了 TypeScript 与 JSX 的结合（TSX）：既有类型语义（如非空断言 `!`），又有 React 组件语法。该文件在项目中的地位类似“前端启动函数”，上游依赖 `index.html` 的根节点，下游调用 `App.tsx` 进入业务布局组件。

代码引用：
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './main.css'

// 将根组件挂载到 index.html 中的 #root 容器。
createRoot(document.getElementById('root')!).render(
  // StrictMode 在开发期帮助发现副作用与潜在问题。
  <StrictMode>
    <App />
  </StrictMode>
)
```

逐行解释：
1. 第 1 行：导入 React 严格模式组件。
2. 第 2 行：导入 React 18+ 根节点创建 API。
3. 第 3 行：导入根组件 `App`。
4. 第 4 行：导入全局样式。
5. 第 5 行：空行。
6. 第 6 行：注释说明挂载目标。
7. 第 7 行：获取 `#root` 并创建渲染根，`!` 表示非空断言。
8. 第 8 行：注释说明 StrictMode 的开发作用。
9. 第 9 行：StrictMode 开始。
10. 第 10 行：渲染应用组件。
11. 第 11 行：StrictMode 结束。
12. 第 12 行：render 调用结束。

### 5.7 src/App.tsx

文件导读：
`App.tsx` 是应用根组件。Day 1 中它保持极简，目的是让初学者清楚看到“组件组合关系”：入口 `main.tsx` 只负责挂载，`App.tsx` 负责选择要渲染的顶层业务组件。这里涉及最基础的函数组件语法与默认导出语法。该文件当前只连接 `AppLayout.tsx`，后续阶段会在这里逐步挂载路由、全局 Provider、主题或错误边界等能力。

代码引用：
```tsx
import AppLayout from './components/layout/AppLayout'

function App() {
  // Day 1 直接返回布局骨架，业务模块在后续天数逐步挂载。
  return <AppLayout />
}

export default App
```

逐行解释：
1. 第 1 行：导入布局组件。
2. 第 2 行：空行。
3. 第 3 行：定义函数组件 `App`。
4. 第 4 行：注释说明 Day 1 组件职责。
5. 第 5 行：返回布局骨架组件。
6. 第 6 行：函数结束。
7. 第 7 行：空行。
8. 第 8 行：默认导出组件。

### 5.8 src/main.css

文件导读：
该文件包含全局样式、颜色变量和少量工具类映射。技术栈上它结合了 Tailwind 导入与标准 CSS 变量（`--color-*`）模式，适合初学者理解“主题令牌（Design Tokens）”概念。它与 `main.tsx` 通过副作用导入关联，影响所有 React 组件的基础视觉样式。后续若接入更多组件，此文件通常继续承担全局样式基线与主题变量管理。

代码引用：
```css
@import "tailwindcss";

:root {
  --color-border: #3E3E42;
  --color-background: #1E1E1E;
  --color-surface: #252526;
  --color-foreground: #CCCCCC;
}

.bg-background { background-color: var(--color-background); }
.bg-surface { background-color: var(--color-surface); }
.text-foreground { color: var(--color-foreground); }
.border-border { border-color: var(--color-border); }

body, html {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden;
  background-color: var(--color-background);
  color: var(--color-foreground);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

#root {
  height: 100%;
}
```

逐行解释：
1. 第 1 行：导入 Tailwind CSS 基础能力。
2. 第 2 行：空行。
3. 第 3 行：声明全局 CSS 变量块开始。
4. 第 4-7 行：定义边框、背景、面板、文字颜色变量。
5. 第 8 行：变量块结束。
6. 第 9 行：空行。
7. 第 10 行：定义 `bg-background` 工具类映射。
8. 第 11 行：定义 `bg-surface` 工具类映射。
9. 第 12 行：定义 `text-foreground` 工具类映射。
10. 第 13 行：定义 `border-border` 工具类映射。
11. 第 14 行：空行。
12. 第 15 行：定义 `body` 与 `html` 全局样式。
13. 第 16-17 行：清除默认外边距与内边距。
14. 第 18 行：页面高度占满视口。
15. 第 19 行：隐藏溢出滚动。
16. 第 20-21 行：应用主题背景色和文字色。
17. 第 22 行：设置跨平台字体栈。
18. 第 23 行：结束全局样式。
19. 第 24 行：空行。
20. 第 25 行：定义根容器样式开始。
21. 第 26 行：根容器高度占满。
22. 第 27 行：结束根容器样式。

### 5.9 src/stores/editor.store.ts

文件导读：
该文件展示了 Zustand 在 TypeScript 中的最小可用模式。初学者需重点掌握三个语法点：接口（定义状态结构）、泛型（`create<EditorState>` 约束 store 类型）、函数参数类型（`(open: boolean)`）。在架构上，这是 UI 状态中心，`Sidebar.tsx` 负责写入，`AppLayout.tsx` 负责读取，从而形成跨组件同步。

代码引用：
```ts
import { create } from 'zustand'

// 定义编辑器 UI 相关的最小全局状态结构。
interface EditorState {
  isSidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

// Day 1 仅维护一个状态位，用于演示 Zustand 的读写闭环。
export const useEditorStore = create<EditorState>((set) => ({
  isSidebarOpen: true,
  setSidebarOpen: (open) => set({ isSidebarOpen: open })
}))
```

逐行解释：
1. 第 1 行：导入 Zustand 的 store 创建函数。
2. 第 2 行：空行。
3. 第 3 行：注释说明接口用途。
4. 第 4 行：定义状态接口开始。
5. 第 5 行：声明布尔状态字段。
6. 第 6 行：声明更新状态的方法签名。
7. 第 7 行：接口结束。
8. 第 8 行：空行。
9. 第 9 行：注释说明当前 store 范围。
10. 第 10 行：创建并导出 typed store。
11. 第 11 行：默认侧边栏为打开状态。
12. 第 12 行：定义状态更新函数。
13. 第 13 行：结束 store 创建。

### 5.10 src/components/layout/AppLayout.tsx

文件导读：
该文件是 Day 1 界面骨架的核心，实现 IDE 外形布局。技术栈上涉及 React 组件组合、第三方布局库 `react-resizable-panels`、图标库 `lucide-react` 与条件渲染语法（`{isSidebarOpen && (...)}`）。它在项目中的地位是“容器组件”：组织页面结构并协调子组件关系（Sidebar、StatusBar），同时消费全局状态。

代码引用：
```tsx
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import Sidebar from './Sidebar'
import StatusBar from './StatusBar'
import { FileCode, TerminalSquare, MessageSquare } from 'lucide-react'
import { useEditorStore } from '../../stores/editor.store'

export default function AppLayout() {
  // 从全局状态读取侧边栏开关。
  const { isSidebarOpen } = useEditorStore()

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* 主内容区：活动栏 + 侧边栏 + 主工作区 */}
      <div className="flex-1 flex overflow-hidden">
        <PanelGroup direction="horizontal">
          {/* 活动栏：Day 1 仅展示图标，不绑定实际功能。 */}
          <div className="w-12 shrink-0 bg-surface border-r border-border flex flex-col items-center py-2 gap-4">
            <button className="p-2 text-gray-400 hover:text-white rounded cursor-pointer">
              <FileCode size={24} />
            </button>
            <button className="p-2 text-gray-400 hover:text-white rounded cursor-pointer">
              <MessageSquare size={24} />
            </button>
          </div>

          {/* 可折叠侧边栏：通过 Zustand 状态控制是否渲染。 */}
          {isSidebarOpen && (
            <>
              <Panel defaultSize={20} minSize={15} maxSize={30}>
                <Sidebar />
              </Panel>
              <PanelResizeHandle className="w-1 bg-border hover:bg-blue-500 transition-colors" />
            </>
          )}

          {/* 主工作区：上方编辑区占位 + 下方终端占位。 */}
          <Panel defaultSize={80}>
            <PanelGroup direction="vertical">
              {/* 编辑区占位：Day 2 将替换为 Monaco。 */}
              <Panel defaultSize={70}>
                <div className="h-full flex items-center justify-center bg-background border-b border-border">
                  <p className="text-gray-500 italic">Day 1: Monaco Editor Will Be Here</p>
                </div>
              </Panel>
              
              <PanelResizeHandle className="h-1 bg-border hover:bg-blue-500 transition-colors" />
              
              {/* 终端占位：Day 2 将替换为 xterm.js。 */}
              <Panel defaultSize={30}>
                <div className="h-full flex flex-col bg-surface">
                  <div className="h-8 border-b border-border flex items-center px-4">
                    <TerminalSquare size={14} className="mr-2" />
                    <span className="text-xs uppercase font-semibold">Terminal</span>
                  </div>
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-gray-500 italic">Day 1: Xterm.js Will Be Here</p>
                  </div>
                </div>
              </Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>

      {/* 状态栏固定在底部。 */}
      <StatusBar />
    </div>
  )
}
```

逐行解释：
1. 第 1 行：导入可拖拽分栏组件。
2. 第 2 行：导入侧边栏组件。
3. 第 3 行：导入状态栏组件。
4. 第 4 行：导入活动栏和终端标题所需图标。
5. 第 5 行：导入全局状态 Hook。
6. 第 6 行：空行。
7. 第 7 行：定义并默认导出布局组件。
8. 第 8 行：注释说明状态读取目的。
9. 第 9 行：从 store 中读取 `isSidebarOpen`。
10. 第 10 行：空行。
11. 第 11 行：开始返回 JSX。
12. 第 12 行：最外层纵向布局容器，填满视口。
13. 第 13 行：注释说明主内容区结构。
14. 第 14 行：主内容容器，允许内部布局并隐藏溢出。
15. 第 15 行：横向分栏组开始。
16. 第 16 行：注释说明活动栏定位。
17. 第 17 行：活动栏样式与布局。
18. 第 18 行：第一个按钮开始。
19. 第 19 行：渲染文件图标。
20. 第 20 行：第一个按钮结束。
21. 第 21 行：第二个按钮开始。
22. 第 22 行：渲染消息图标。
23. 第 23 行：第二个按钮结束。
24. 第 24 行：活动栏结束。
25. 第 25 行：空行。
26. 第 26 行：注释说明侧边栏条件渲染。
27. 第 27 行：根据 `isSidebarOpen` 开始条件渲染。
28. 第 28 行：React Fragment 开始。
29. 第 29 行：定义侧边栏宽度比例范围。
30. 第 30 行：渲染 `Sidebar` 组件。
31. 第 31 行：侧边栏 Panel 结束。
32. 第 32 行：渲染横向拖拽分隔条。
33. 第 33 行：Fragment 结束。
34. 第 34 行：条件渲染结束。
35. 第 35 行：空行。
36. 第 36 行：注释说明主工作区结构。
37. 第 37 行：主工作区 Panel 开始。
38. 第 38 行：纵向分栏组开始。
39. 第 39 行：注释说明编辑区是占位。
40. 第 40 行：编辑区 Panel 开始。
41. 第 41 行：编辑区占位容器样式。
42. 第 42 行：占位文本内容。
43. 第 43 行：占位容器结束。
44. 第 44 行：编辑区 Panel 结束。
45. 第 45 行：空行。
46. 第 46 行：编辑区与终端区之间的拖拽条。
47. 第 47 行：空行。
48. 第 48 行：注释说明终端区是占位。
49. 第 49 行：终端区 Panel 开始。
50. 第 50 行：终端区外层容器。
51. 第 51 行：终端标题栏容器。
52. 第 52 行：终端图标。
53. 第 53 行：终端标题文字。
54. 第 54 行：标题栏结束。
55. 第 55 行：终端内容区容器。
56. 第 56 行：终端占位文本。
57. 第 57 行：终端内容区结束。
58. 第 58 行：终端外层结束。
59. 第 59 行：终端区 Panel 结束。
60. 第 60 行：纵向分栏结束。
61. 第 61 行：主工作区 Panel 结束。
62. 第 62 行：横向分栏组结束。
63. 第 63 行：主内容区结束。
64. 第 64 行：空行。
65. 第 65 行：注释说明状态栏位置。
66. 第 66 行：渲染状态栏组件。
67. 第 67 行：最外层容器结束。
68. 第 68 行：返回表达式结束。
69. 第 69 行：组件函数结束。

### 5.11 src/components/layout/Sidebar.tsx

文件导读：
该文件是侧边栏展示组件，包含一个状态写入动作（关闭侧边栏）。初学者应重点观察事件处理语法 `onClick={() => ...}`、组件内调用 Zustand Hook 的方式，以及“用户操作 -> 状态更新 -> 父组件重渲染”的完整链路。它与 `editor.store.ts` 和 `AppLayout.tsx` 构成最小交互闭环。

代码引用：
```tsx
import { useEditorStore } from '../../stores/editor.store'
import { FolderTree, X } from 'lucide-react'

export default function Sidebar() {
  // 仅取出写操作函数，避免不必要状态订阅。
  const { setSidebarOpen } = useEditorStore()

  return (
    <div className="h-full bg-surface border-r border-border flex flex-col">
      <div className="px-4 py-2 flex items-center justify-between uppercase text-xs font-semibold text-gray-400 border-b border-border">
        <span className="flex items-center"><FolderTree size={14} className="mr-2" />Explorer</span>
        {/* 关闭按钮将触发全局状态更新，从而让侧边栏整体卸载。 */}
        <button onClick={() => setSidebarOpen(false)} className="hover:text-white cursor-pointer"><X size={14} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <p className="text-gray-500 italic text-sm">Day 1: File Tree Will Be Here</p>
      </div>
    </div>
  )
}
```

逐行解释：
1. 第 1 行：导入编辑器 store。
2. 第 2 行：导入文件树图标与关闭图标。
3. 第 3 行：空行。
4. 第 4 行：定义侧边栏组件。
5. 第 5 行：注释说明只读取写函数。
6. 第 6 行：解构得到 `setSidebarOpen`。
7. 第 7 行：空行。
8. 第 8 行：返回 JSX 开始。
9. 第 9 行：侧边栏容器样式。
10. 第 10 行：侧边栏标题行样式。
11. 第 11 行：渲染标题和左侧图标。
12. 第 12 行：注释说明关闭按钮行为。
13. 第 13 行：点击时将侧边栏状态置为 `false`。
14. 第 14 行：标题行结束。
15. 第 15 行：内容区容器（滚动区）开始。
16. 第 16 行：占位文本。
17. 第 17 行：内容区结束。
18. 第 18 行：侧边栏容器结束。
19. 第 19 行：返回表达式结束。
20. 第 20 行：组件函数结束。

### 5.12 src/components/layout/StatusBar.tsx

文件导读：
该文件是纯展示组件（Presentational Component），不持有状态、不触发副作用。它的学习价值在于帮助初学者区分“容器组件”和“展示组件”。在当前项目中它由 `AppLayout.tsx` 挂载，承担阶段信息展示。后续可扩展为显示分支名、文件编码、光标位置、Agent 执行状态等。

代码引用：
```tsx
export default function StatusBar() {
  return (
    // Day 1 状态栏仅用于展示版本与阶段信息。
    <div className="h-6 bg-blue-600 text-white text-xs flex items-center px-4 shrink-0 transition-colors">
      <span className="font-semibold">Day 1 Framework</span>
      <span className="mx-4 opacity-50">|</span>
      <span>React 19 + Electron 35 Base</span>
    </div>
  )
}
```

逐行解释：
1. 第 1 行：定义并导出状态栏组件。
2. 第 2 行：返回 JSX 开始。
3. 第 3 行：注释说明状态栏职责。
4. 第 4 行：状态栏容器样式定义。
5. 第 5 行：显示阶段标识文字。
6. 第 6 行：显示分隔符。
7. 第 7 行：显示技术栈信息。
8. 第 8 行：容器结束。
9. 第 9 行：返回表达式结束。
10. 第 10 行：组件结束。

### 5.13 tsconfig.json

文件导读：
该文件是 TypeScript 根配置，决定语言服务与编译器如何理解项目。对于没有 TS 经验的读者，这个文件非常关键：它不仅影响是否报错，还影响代码补全、跳转、重构与导入行为。它与 `tsconfig.node.json`、`tsconfig.web.json` 是并列关系，前者更偏总控与通用约束。

代码引用：
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowArbitraryExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "ignoreDeprecations": "6.0",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.d.ts", "electron/**/*.ts"]
}
```

逐行解释：
1. 第 1 行：配置对象开始。
2. 第 2 行：编译器选项对象开始。
3. 第 3 行：JS 目标版本 ES2022。
4. 第 4 行：类字段使用 define 语义。
5. 第 5 行：模块系统使用 ESNext。
6. 第 6 行：声明可用标准库。
7. 第 7 行：跳过第三方 d.ts 检查以提速。
8. 第 8 行：模块解析策略为 bundler。
9. 第 9 行：允许导入任意扩展名文件。
10. 第 10 行：允许解析 JSON。
11. 第 11 行：每个文件可独立编译。
12. 第 12 行：不输出编译结果文件。
13. 第 13 行：JSX 运行时设置。
14. 第 14 行：开启严格模式。
15. 第 15 行：约束未使用局部变量。
16. 第 16 行：约束未使用参数。
17. 第 17 行：禁止 `switch` 穿透。
18. 第 18 行：忽略 TS 6 过渡期弃用提示。
19. 第 19 行：设置路径基准。
20. 第 20 行：路径别名对象开始。
21. 第 21 行：`@/*` 映射到 `src/*`。
22. 第 22 行：路径别名对象结束。
23. 第 23 行：编译器选项结束。
24. 第 24 行：包含源文件范围（含 `d.ts` 声明文件）。
25. 第 25 行：配置对象结束。

### 5.14 tsconfig.node.json

文件导读：
该配置用于 Node/Electron 主进程相关代码的类型检查边界。初学者要理解：主进程不是浏览器环境，因此它与 `tsconfig.web.json` 在 `lib` 与包含目录上不同。将 node 与 web 分开配置可以减少错误提示噪音，避免把 DOM 类型错误地带入主进程代码。

代码引用：
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "strict": true,
    "ignoreDeprecations": "6.0",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["electron"]
}
```

逐行解释：
1. 第 1 行：配置对象开始。
2. 第 2 行：编译器选项对象开始。
3. 第 3 行：Node 侧目标版本。
4. 第 4 行：Node 侧标准库版本。
5. 第 5 行：模块系统设置。
6. 第 6 行：模块解析策略。
7. 第 7 行：允许 JSON 模块。
8. 第 8 行：文件独立编译约束。
9. 第 9 行：不输出编译产物。
10. 第 10 行：严格模式。
11. 第 11 行：忽略 TS 6 过渡期弃用提示。
12. 第 12 行：设置路径基准。
13. 第 13 行：路径别名对象开始。
14. 第 14 行：别名映射。
15. 第 15 行：路径别名对象结束。
16. 第 16 行：编译器选项结束。
17. 第 17 行：仅包含 electron 目录。
18. 第 18 行：配置结束。

### 5.15 tsconfig.web.json

文件导读：
该配置用于浏览器渲染进程代码（React/TSX）。它声明了 DOM 类型、Vite 客户端类型、以及对前端导入行为的约束。与 `tsconfig.node.json` 的主要差异在于运行时环境和可用全局对象（例如 `window`、`document`）。这个文件与 VS Code 的智能提示直接相关，配置不当会出现假错误。

代码引用：
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowArbitraryExtensions": true,
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["vite/client"],
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "ignoreDeprecations": "6.0",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"]
}
```

逐行解释：
1. 第 1 行：配置对象开始。
2. 第 2 行：编译器选项开始。
3. 第 3 行：Web 侧目标版本。
4. 第 4 行：类字段语义设置。
5. 第 5 行：声明浏览器运行所需库。
6. 第 6 行：模块系统设置。
7. 第 7 行：模块解析策略。
8. 第 8 行：允许任意扩展名导入。
9. 第 9 行：允许导入 ts 扩展名。
10. 第 10 行：允许 JSON 模块。
11. 第 11 行：文件独立编译约束。
12. 第 12 行：不输出编译产物。
13. 第 13 行：引入 Vite 客户端类型定义。
14. 第 14 行：React JSX 设置。
15. 第 15 行：严格模式。
16. 第 16 行：约束未使用局部变量。
17. 第 17 行：约束未使用参数。
18. 第 18 行：禁止 switch 穿透。
19. 第 19 行：忽略 TS 6 过渡期弃用提示。
20. 第 20 行：基准路径。
21. 第 21-23 行：路径别名配置。
22. 第 24 行：编译器选项结束。
23. 第 25 行：仅包含 `src`。
24. 第 26 行：配置结束。

### 5.16 src/vite-env.d.ts

文件导读：
这是 TypeScript 声明文件（`.d.ts`），用于补充“运行时可用但编译器默认未知”的类型信息。初学者可以把它理解为“告诉 TS 编译器如何理解某些导入或全局能力”的桥接层。本文件当前解决了 Vite 客户端类型和 CSS 导入声明问题，是减少 IDE 误报的关键文件之一。

代码引用：
```ts
/// <reference types="vite/client" />

declare module '*.css'
```

逐行解释：
1. 第 1 行：引入 Vite 客户端环境类型，确保 `import.meta` 等类型可识别。
2. 第 2 行：空行，用于分隔声明。
3. 第 3 行：声明 CSS 模块导入类型，避免 `import './main.css'` 出现类型错误。

### 5.17 .vscode/settings.json

文件导读：
这是工作区级 IDE 配置，不影响运行逻辑，但直接影响开发体验与错误展示。它与 `tsconfig*` 文件协作：`tsconfig` 负责编译规则，`settings.json` 负责 VS Code 使用哪套 TypeScript SDK、如何处理保存动作和 lint 规则。对于教学项目，保持统一 IDE 行为非常重要，可减少“同一代码不同机器报错不一致”的问题。

代码引用：
```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.updateImportsOnFileMove.enabled": "always",
  "editor.codeActionsOnSave": {
    "source.fixAll": "explicit"
  },
  "css.lint.unknownAtRules": "ignore",
  "files.eol": "\n"
}
```

逐行解释：
1. 第 1 行：VS Code 配置对象开始。
2. 第 2 行：指定工作区 TypeScript SDK，避免全局版本差异导致假错误。
3. 第 3 行：允许提示使用工作区 TS 版本。
4. 第 4 行：导入路径优先使用相对路径。
5. 第 5 行：移动文件时自动更新导入。
6. 第 6 行：保存时代码操作配置开始。
7. 第 7 行：仅显式触发 `fixAll`。
8. 第 8 行：代码操作配置结束。
9. 第 9 行：忽略 Tailwind v4 `@theme` 等自定义 at-rule 的误报。
10. 第 10 行：统一换行符为 `\n`。
11. 第 11 行：配置结束。

## 6. Day 1 关键 TypeScript 语法（面向零基础）

本节不是关键词罗列，而是按“为什么需要 -> 在本项目哪里出现 -> 什么时候容易犯错”的顺序展开。

### 6.1 为什么在本项目中必须使用 TypeScript
1. 该项目是多进程架构（main/preload/renderer），边界多、接口多，纯 JavaScript 更容易出现运行时错误。
2. TypeScript 在编译期发现问题，能提前暴露“参数类型错误、字段缺失、空值风险”。
3. 对初学团队最直接的收益是 IDE 能给出更稳定的跳转、补全和重构支持。

### 6.2 类型注解（Type Annotation）
代码引用：
```ts
setSidebarOpen: (open: boolean) => void
```
解释：
1. `open: boolean` 规定调用方必须传入布尔值。
2. `=> void` 表示函数不返回值。
3. 如果误传字符串（如 `'false'`），IDE 会立即报错，而不是运行时才发现。

### 6.3 接口（interface）
代码引用：
```ts
interface EditorState {
  isSidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}
```
解释：
1. 接口用于定义“对象结构契约”。
2. 在 Zustand 场景中，它让 store 的状态字段和方法签名可验证。
3. 当你后续新增字段（例如 `activeTab: string`）时，所有使用位置都能得到一致类型提示。

### 6.4 泛型（Generics）
代码引用：
```ts
create<EditorState>((set) => ({ ... }))
```
解释：
1. 泛型本质是“参数化类型”。
2. `create<EditorState>` 告诉 Zustand：这个 store 必须符合 `EditorState`。
3. 如果你在 store 返回对象里漏掉 `setSidebarOpen`，会在编译期报错。

### 6.5 非空断言（Non-null Assertion）
代码引用：
```ts
document.getElementById('root')!
```
解释：
1. `getElementById` 的返回类型是 `HTMLElement | null`。
2. `!` 表示“开发者确认这里不为 null”。
3. 使用风险：如果 `index.html` 中缺少 `id="root"`，运行时仍会失败，因此它不是“绝对安全”，只是“显式声明假设”。

### 6.6 模块系统（import/export）
代码引用：
```ts
import AppLayout from './components/layout/AppLayout'
export default App
```
解释：
1. `import` 用于引入其他模块导出的内容。
2. `export default` 表示模块默认导出一个值。
3. Day 1 采用 ES Module 风格，便于 Vite 与现代工具链进行静态分析和按需构建。

### 6.7 TSX 与 JSX 的关系
1. `*.tsx` 文件允许在 TypeScript 中书写 JSX。
2. JSX 看起来像 HTML，但本质是函数调用语法糖。
3. 例如 `<AppLayout />` 最终会转译为 React 元素创建逻辑。

### 6.8 声明文件（`.d.ts`）的作用
代码引用：
```ts
declare module '*.css'
```
解释：
1. 该声明告诉编译器：CSS 文件可以作为模块被导入。
2. 没有这类声明时，`import './main.css'` 可能触发类型错误。
3. 这也是“IDE 不报假错”的关键措施之一。

### 6.9 编译器选项如何影响日常开发
1. `strict: true`：严格类型检查，减少隐藏问题。
2. `noUnusedLocals` / `noUnusedParameters`：及时清理无效代码。
3. `moduleResolution: bundler`：按现代打包器规则解析模块。
4. `paths`：支持别名导入，改善可读性。

### 6.10 初学者在 Day 1 常见错误
1. 忘记维护 `#root` 导致非空断言假设失效。
2. 在 store 中添加字段但未更新接口定义。
3. 误把主进程 API 当作渲染进程 API 使用。
4. 删除 `.d.ts` 声明文件后出现导入类型错误。

## 7. Day 1 与 Agent 开发的关系

Day 1 本身并不包含大模型调用或 Agent 执行循环，但它完成了 Agent 工程必需的“基础设施层”。以下内容建议完整理解。

### 7.1 什么是 Agent 应用（在本项目语境下）
一个可用的开发型 Agent 应用通常包含四层：
1. 模型层：与 LLM API 通信。
2. 工具层：文件读取、代码修改、命令执行、搜索等能力。
3. 执行层：Agent Loop（模型决策 -> 调工具 -> 回灌结果 -> 继续决策）。
4. 展示层：对话、工具调用记录、结果可视化。

### 7.2 为什么 Day 1 先做进程与安全边界
1. 工具层能力通常涉及高权限（磁盘、命令行）。
2. 如果直接暴露给渲染进程，安全风险极高。
3. 因此必须先建立：`main.ts`（高权限）-> `preload.ts`（受控桥接）-> 渲染层（低权限） 的分层模型。

### 7.3 Day 1 的三项 Agent 前置能力
1. 进程边界：确保未来工具调用有清晰权限路径。
2. UI 骨架：预留聊天区、工具日志区、编辑区、终端区的布局位置。
3. 状态模型雏形：用 Zustand 演示“跨组件共享状态”的最小模式。

### 7.4 后续阶段与 Agent 概念映射
1. Day 2（Monaco + 终端）：补齐“操作界面”和“执行反馈载体”。
2. Day 3（文件系统）：提供工具层的读写基础。
3. Day 4（LLM Provider）：建立模型通信层。
4. Day 5（Tool Registry）：定义模型可调用的工具集合。
5. Day 6（Agent Loop）：实现自主多轮决策与工具调用循环。
6. Day 7（Git/设置/高级工具）：完善可控性与工程可用性。

### 7.5 RAG 在本项目中的位置（预备认知）
1. RAG 不是“换模型”，而是“在推理前为模型补充检索到的上下文”。
2. 在 IDE Agent 里，RAG 常见来源是：代码搜索结果、文件片段、提交历史、文档片段。
3. Day 1 尚未具备检索链路，因此不实现 RAG；但当前目录结构和状态管理已为后续接入保留位置。

### 7.6 初学团队的实践建议
1. 每增加一个高权限能力，先明确它在 main/preload/renderer 哪一层。
2. 任何工具能力都先做“只读版本”，再做“可写版本”。
3. 每天都保持“代码、文档、IDE 配置”同步更新，避免学习断层。

## 8. 本日检查项（完成即通过）
1. 能正常 `npm run dev` 启动。
2. 拖拽分栏正常。
3. 点击侧边栏关闭按钮后界面正确更新。
4. VS Code 中无由配置拼写错误造成的假错误。

## 9. 完整运行流程追踪（结合真实示例）

本节用一个完整的可观察示例串起 Day 1 全部关键代码：

示例任务：启动应用后，点击侧边栏关闭按钮，使侧边栏从界面中消失。

### 9.1 启动命令如何触发整个系统
用户执行：
```powershell
Set-Location .\GUIDE\day1
npm run dev
```

脚本入口来自：
```json
"scripts": {
  "dev": "electron-vite dev"
}
```

说明：`electron-vite dev` 会并行构建 main/preload/renderer，并启动渲染端开发服务器与 Electron 进程。

### 9.2 构建器如何找到三端入口
配置位于：
```ts
export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/main.ts')
        }
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/preload.ts')
        }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src'),
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/index.html')
      }
    }
  }
})
```

说明：
1. `main` 指向主进程入口。
2. `preload` 指向桥接脚本入口。
3. `renderer` 指向前端页面入口（`src/index.html`）。

### 9.3 主进程如何创建窗口并加载页面
关键代码：
```ts
const mainWindow = new BrowserWindow({
  webPreferences: {
    preload: join(__dirname, '../preload/index.js'),
    contextIsolation: true
  }
})

if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
  mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
} else {
  mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
}
```

说明：
1. 先创建窗口容器。
2. 注入 preload 以提供受控 API。
3. 开发模式加载 Vite URL，生产模式加载打包 HTML。

### 9.4 渲染进程如何从 HTML 进入 React
HTML 壳：
```html
<div id="root"></div>
<script type="module" src="./main.tsx"></script>
```

React 挂载入口：
```tsx
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

根组件继续进入布局：
```tsx
function App() {
  return <AppLayout />
}
```

### 9.5 交互示例：点击关闭侧边栏后，代码如何联动
先看状态定义：
```ts
interface EditorState {
  isSidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

export const useEditorStore = create<EditorState>((set) => ({
  isSidebarOpen: true,
  setSidebarOpen: (open) => set({ isSidebarOpen: open })
}))
```

点击事件发生在侧边栏组件：
```tsx
<button onClick={() => setSidebarOpen(false)} className="hover:text-white cursor-pointer">
  <X size={14} />
</button>
```

布局组件根据状态做条件渲染：
```tsx
{isSidebarOpen && (
  <>
    <Panel defaultSize={20} minSize={15} maxSize={30}>
      <Sidebar />
    </Panel>
    <PanelResizeHandle className="w-1 bg-border hover:bg-blue-500 transition-colors" />
  </>
)}
```

完整链路自然语言追踪：
1. 用户点击关闭按钮。
2. `setSidebarOpen(false)` 写入 Zustand store。
3. `AppLayout` 监听到 `isSidebarOpen` 变化并重新渲染。
4. 条件表达式变为 `false`，侧边栏与分隔条从 DOM 中移除。
5. 用户看到界面收起侧栏，这就是 Day 1 最小状态管理闭环。

### 9.6 这个流程与后续 Agent 开发的关系
这个示例看似简单，但它已经具备 Agent 系统的三个关键原型：
1. 事件触发（用户输入）
2. 状态变更（内部决策结果）
3. UI 反馈（可观察输出）

后续的 Agent Loop 只是把“触发源”从按钮点击扩展为“模型决策 + 工具调用结果”，其工程组织方式与 Day 1 的闭环是一致的。

