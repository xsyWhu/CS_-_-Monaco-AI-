# Day 8：统一设计系统 + Inline Diff 审核 + Agent 配置扩展

## 前言

Day 7 完成了 6 工具 Agent、Git 集成和设置面板。但 IDE 在两个方面还很粗糙：

1. **视觉一致性差**：Day 1~7 的组件各自使用 Tailwind 硬编码颜色值（`gray-800`、`amber-500`...），修改一处配色需要全局搜索替换。
2. **Agent 修改文件后"静默生效"**：用户无法在 IDE 中直观查看修改了什么，也无法拒绝不满意的修改。

Day 8 解决这两个问题，并扩展 Agent 的可配置性：

- **设计系统（Design System）**：用 CSS 自定义属性（Custom Properties）统一色彩、间距、动画，所有组件引用变量而非硬编码。
- **Inline Diff Accept/Reject**：Agent 修改文件后，IDE 自动弹出逐行对比视图，用户可以 Accept（接受）或 Reject（恢复原文件）。
- **扩展设置**：新增 System Prompt、Max Iterations、Temperature 三项 Agent 行为配置。

---

## 1. 本日增量目标

### 1.1 功能目标
1. 建立全局 CSS 设计系统：统一色彩变量 + 工具类 + 关键帧动画。
2. Agent 修改文件后，编辑器顶部出现"待审核"标签栏。
3. 点击标签弹出 Inline Diff 视图，显示新旧文件逐行对比（红色/绿色高亮）。
4. Accept 按钮保留修改，Reject 按钮恢复文件原内容。
5. 设置面板新增 System Prompt（自定义系统提示词）、Max Iterations（最大迭代轮次）、Temperature（随机性控制）。
6. 所有 UI 组件迁移到设计系统变量。

### 1.2 工程目标
1. 工具层（edit_file / write_file）增加 `onFileChange` 回调机制。
2. 从工具层到渲染层的完整事件链路：工具 → AgentLoop → ChatService → IPC → preload → Hook → Store → View。
3. 纯前端 LCS（最长公共子序列）diff 算法实现。
4. ProviderConfig 接口扩展（systemPrompt / maxIterations / temperature）。

---

## 2. 运行步骤

### 2.1 安装依赖
```powershell
Set-Location .\GUIDE\day8
npm install
```

### 2.2 启动项目
```powershell
npm run dev
```

### 2.3 预期现象
1. 窗口启动后整体配色为深蓝灰色调（`#0f1117` 背景），而非 Day 7 的纯灰色。
2. 各组件悬停时有统一的过渡动画效果。
3. 设置对话框新增"Agent 行为"分区，包含 System Prompt 文本域、Max Iterations 滑块、Temperature 滑块。
4. 让 Agent 修改一个文件（如"帮我在 README 中添加一段描述"），编辑器顶部出现黄色 ⚠ 标签栏，点击标签可见红绿色 diff。
5. 点击 Accept → diff 关闭，文件保留修改。点击 Reject → 文件恢复原内容。

---

## 3. Day 8 变更结构（相对 Day 7）

```text
day8/
├─ src/
│  ├─ main.css                                     (重写：CSS 设计系统)
│  ├─ hooks/
│  │  └─ useChat.ts                                (修改：订阅 onChatFileChange)
│  ├─ stores/
│  │  └─ editor.store.ts                           (修改：新增 pendingDiffs 等状态)
│  └─ components/
│     ├─ editor/
│     │  ├─ EditorArea.tsx                          (修改：Pending Diff 标签栏)
│     │  └─ InlineDiffView.tsx                     (新增：LCS diff 视图)
│     ├─ settings/
│     │  └─ SettingsDialog.tsx                     (修改：新增三项配置)
│     └─ (其他所有组件)                             (修改：迁移到设计系统变量)
├─ electron/
│  ├─ preload.ts                                    (修改：新增 onChatFileChange / revertFileChange)
│  ├─ ipc/
│  │  └─ chat.ipc.ts                               (修改：新增 file-change 推送 + revert-file)
│  └─ services/agent/
│     ├─ agent-loop.ts                             (修改：AgentLoopCallbacks 新增 onFileChange)
│     ├─ chat.service.ts                           (修改：ChatCallbacks 新增 onFileChange)
│     ├─ providers/
│     │  ├─ base.provider.ts                       (修改：ProviderConfig 扩展)
│     │  └─ openai.provider.ts                     (修改：透传 temperature)
│     └─ tools/
│        ├─ tool-registry.ts                       (修改：ToolContext 新增 onFileChange)
│        ├─ edit-file.tool.ts                      (修改：调用 onFileChange)
│        └─ write-file.tool.ts                     (修改：记录旧内容 + 调用 onFileChange)
└─ README-day8.md                                   (新增)
```

---

## 4. 核心增量一：CSS 设计系统

### 4.1 什么是设计系统？

设计系统（Design System）的核心思想是**"Single Source of Truth"**——所有颜色、间距、动画定义在一个地方，组件通过引用变量来使用。

Day 1~7 的做法：
```tsx
// 每个组件各自硬编码颜色
<div className="bg-gray-900 text-gray-300 border-gray-700">
```

Day 8 的做法：
```tsx
// 所有组件引用统一变量
<div className="bg-[var(--color-bg-secondary)] text-[var(--color-fg-secondary)] border-[var(--color-border)]">
```

好处：
1. 修改一处变量即可全局变更配色。
2. 为未来的"亮色主题切换"打下基础（只需覆盖 `:root` 变量）。
3. 视觉一致性有保障——不会出现 `gray-700` 和 `gray-600` 混用的问题。

### 4.2 文件 `src/main.css` 完整解析

文件导读：
- 技术栈：CSS 自定义属性（CSS Custom Properties / CSS Variables）。
- 作用：定义全局色彩系统、工具类、动画关键帧。
- 关系：所有组件的 `className` 中通过 `var(--color-*)` 引用。

#### 色彩变量

```css
:root {
  /* 基础灰度——从最深到最浅 */
  --color-bg-primary:   #0f1117;   /* 最深背景（编辑器主体、空状态） */
  --color-bg-secondary: #161922;   /* 次深背景（侧边栏、面板） */
  --color-bg-tertiary:  #1c1f2b;   /* 第三层（标签栏、信息条） */
  --color-bg-elevated:  #232736;   /* 悬浮层（下拉菜单、卡片） */
  --color-bg-hover:     #2a2e3d;   /* 悬停态 */
  --color-bg-active:    #323750;   /* 激活态 */

  /* 前景色 */
  --color-fg-primary:   #e2e4eb;   /* 主文字 */
  --color-fg-secondary: #9399ab;   /* 辅助文字 */
  --color-fg-muted:     #5d6377;   /* 弱化文字（行号、提示） */

  /* 边框 */
  --color-border:        #2a2e3d;  /* 标准边框 */
  --color-border-subtle: #1f2333;  /* 淡边框（分隔线） */

  /* 主题色（蓝紫） */
  --color-accent:       #6c8aff;   /* 主色调（按钮、链接、活动指示器） */
  --color-accent-hover: #839dff;   /* 主色悬停 */
  --color-accent-muted: rgba(108, 138, 255, 0.12);  /* 主色底色（选中标签） */

  /* 语义色 */
  --color-success: #4ade80;   /* 成功（diff 新增行、提交成功） */
  --color-error:   #f87171;   /* 错误（diff 删除行、报错） */
  --color-warning: #fbbf24;   /* 警告（待审核标记） */
  --color-info:    #60a5fa;   /* 信息 */
}
```

解释：
1. **灰度渐变**：5 级灰度从 `#0f1117`（近乎纯黑）到 `#2a2e3d`（深灰），模仿 VS Code Dark+ 的层次感。
2. **前景 3 级**：主文字用最亮色，辅助文字中灰，弱化文字暗灰。满足信息层级需求。
3. **语义色**：success / error / warning / info 与具体业务含义绑定，不会出现"这里用绿色还是蓝色"的犹豫。

#### 工具类

```css
.bg-background { background-color: var(--color-bg-primary); }
.bg-surface    { background-color: var(--color-bg-secondary); }
.bg-elevated   { background-color: var(--color-bg-elevated); }
.text-foreground { color: var(--color-fg-primary); }
.text-secondary  { color: var(--color-fg-secondary); }
.text-muted      { color: var(--color-fg-muted); }
.border-border   { border-color: var(--color-border); }
.border-subtle   { border-color: var(--color-border-subtle); }
```

解释：这些工具类是 **Tailwind 的补充**——Tailwind 不直接支持 CSS 变量作为颜色值，通过自定义类来桥接。在组件中可以混用：`className="bg-surface text-secondary px-4 py-2"`。

#### 动画关键帧

```css
@keyframes fade-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes fade-in-scale {
  from { opacity: 0; transform: scale(0.97); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes slide-in-right {
  from { opacity: 0; transform: translateX(8px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(108, 138, 255, 0); }
  50%      { box-shadow: 0 0 12px 2px rgba(108, 138, 255, 0.15); }
}
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes typing-cursor {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0; }
}

.animate-fade-in       { animation: fade-in 0.2s ease-out both; }
.animate-fade-in-scale { animation: fade-in-scale 0.2s ease-out both; }
.animate-slide-right   { animation: slide-in-right 0.2s ease-out both; }
.animate-pulse-glow    { animation: pulse-glow 2s ease-in-out infinite; }
.animate-typing-cursor { animation: typing-cursor 1s step-end infinite; }

.transition-base { transition: all 0.15s ease; }
```

逐条解释：
| 动画类 | 用途 | 使用组件 |
|--------|------|----------|
| `animate-fade-in` | 元素淡入 + 微上移 | ChatMessage、EditorArea 标签栏 |
| `animate-fade-in-scale` | 弹窗缩放入场 | SettingsDialog、InlineDiffView |
| `animate-slide-right` | 消息从右侧滑入 | 用户消息 |
| `animate-pulse-glow` | 脉冲发光 | 状态指示器 |
| `animate-typing-cursor` | 光标闪烁 | Agent 正在输入 |
| `animate-shimmer` | 骨架屏微光 | 文件树加载态 |
| `transition-base` | 通用 150ms 过渡 | 所有按钮、悬停效果 |

#### 全局样式

```css
body, html {
  background-color: var(--color-bg-primary);
  color: var(--color-fg-primary);
}

::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-thumb {
  background: var(--color-fg-muted);
  border-radius: 3px;
}
```

解释：全局设置深色背景 + 自定义滚动条。Electron 使用 Chromium 内核，因此 `::-webkit-scrollbar` 伪元素有效。

---

## 5. 核心增量二：Inline Diff 数据流——从工具到视图

### 5.1 事件链路全景

Inline Diff 的核心挑战是：**修改发生在主进程的工具执行层，但展示在渲染进程的编辑器中**。需要跨越 4 个边界：

```
工具层 (edit_file / write_file)
  │ context.onFileChange()           ← ① 工具回调
  ▼
AgentLoop (callbacks.onFileChange)
  │                                  ← ② AgentLoop 透传
  ▼
ChatService (ChatCallbacks.onFileChange)
  │                                  ← ③ ChatService 透传
  ▼
chat.ipc (safeSend "chat:file-change")
  │                                  ← ④ IPC 推送（主 → 渲染）
  ▼
preload (ipcRenderer.on → callback)
  │                                  ← ⑤ 预加载桥接
  ▼
useChat hook (addPendingDiff + reviewDiff)
  │                                  ← ⑥ React Hook 入口
  ▼
editor.store (pendingDiffs / activeDiff)
  │                                  ← ⑦ Zustand 状态更新
  ▼
EditorArea + InlineDiffView
                                     ← ⑧ UI 渲染
```

下面逐层详解。

### 5.2 第一层：工具回调（ToolContext.onFileChange）

文件 `electron/services/agent/tools/tool-registry.ts` 的变更：

```typescript
export interface ToolContext {
  workspacePath: string
  /** Day 8: 文件变更通知回调（edit_file/write_file 修改文件后调用）。 */
  onFileChange?: (info: {
    filePath: string     // 被修改文件的绝对路径
    oldContent: string   // 修改前的内容
    newContent: string   // 修改后的内容
    toolName: string     // 哪个工具触发的（"edit_file" 或 "write_file"）
  }) => void
}
```

解释：
1. `onFileChange` 是可选的（`?`），因为工具在测试环境中可能不需要通知 UI。
2. 传递完整的 `oldContent` 和 `newContent`，而非 diff 文本——让前端自行计算差异，保持灵活性。
3. `toolName` 用于 UI 显示"via edit_file"或"via write_file"，帮助用户区分修改方式。

### 5.3 第二层：edit_file 调用 onFileChange

文件 `electron/services/agent/tools/edit-file.tool.ts` 的 Day 8 变更：

```typescript
// ── 执行替换 ──
const newContent = content.replace(oldString, newString)
await fs.writeFile(absTarget, newContent, "utf-8")

// Day 8: 通知前端文件发生变更（供 Inline Diff 使用）。
context.onFileChange?.({
  filePath: absTarget,
  oldContent: content,     // 替换前的完整文件内容
  newContent,              // 替换后的完整文件内容
  toolName: "edit_file",
})
```

注意 `oldContent` 是 `content`（替换前的完整文件内容），不是 `oldString`（被替换的片段）。因为 Inline Diff 需要对比整个文件，而非只对比被修改的片段。

### 5.4 第二层：write_file 调用 onFileChange

文件 `electron/services/agent/tools/write-file.tool.ts` 的 Day 8 变更：

```typescript
// Day 8: 记录旧内容（用于 Inline Diff）。
let oldContent = ""
try {
  oldContent = await fs.readFile(absTarget, "utf-8")
} catch {
  // 文件不存在时 oldContent 保持空字符串（新建文件场景）。
}

// ── 写入文件 ──
await fs.writeFile(absTarget, content, "utf-8")

// Day 8: 通知前端文件发生变更。
context.onFileChange?.({
  filePath: absTarget,
  oldContent,
  newContent: content,
  toolName: "write_file",
})
```

解释：
1. write_file 必须**在写入前**读取旧内容。如果写入后再读，`oldContent` 就是新内容了。
2. 文件不存在时（新建场景），`oldContent` 为空字符串。Diff 视图会显示所有行为"新增"。

### 5.5 第三层：AgentLoop 透传

文件 `electron/services/agent/agent-loop.ts` 中 `AgentLoopCallbacks` 新增：

```typescript
export interface AgentLoopCallbacks {
  // ... 已有的 onToken / onThinking / onToolCallStart 等
  /** Day 8: 文件被工具修改时触发（供 Inline Diff 使用）。 */
  onFileChange?(info: { filePath: string; oldContent: string; newContent: string; toolName: string }): void
}
```

AgentLoop 在执行工具时将 `onFileChange` 传入 ToolContext：

```typescript
const result = await this.toolRegistry.execute(toolCall.function.name, args, {
  workspacePath,
  onFileChange: callbacks.onFileChange
    ? (info) => callbacks.onFileChange!(info)
    : undefined,
})
```

### 5.6 第四层：IPC 推送

文件 `electron/ipc/chat.ipc.ts` 新增两处：

```typescript
// ① 文件变更事件推送到渲染进程。
onFileChange(info) {
  safeSend("chat:file-change", info)
},

// ② 用户拒绝变更时恢复文件原始内容。
ipcMain.handle("chat:revert-file", (_event, filePath: string, content: string) => {
  writeFileSync(filePath, content, "utf-8")
})
```

解释：
1. `safeSend` 使用 `webContents.send()` 主动推送（Push），无需渲染进程请求。
2. `chat:revert-file` 是一个 invoke/handle 通道（Request-Response），当用户点击 Reject 时调用。
3. `writeFileSync` 用于同步写入——Reject 操作需要立即生效，不能用异步。

### 5.7 第五层：preload 桥接

文件 `electron/preload.ts` 新增：

```typescript
// Day 8: Inline Diff 文件变更事件。
onChatFileChange: (callback) => {
  const handler = (_event, data) => callback(data)
  ipcRenderer.on("chat:file-change", handler)
  return () => { ipcRenderer.removeListener("chat:file-change", handler) }
},

// Day 8: 用户拒绝变更时恢复文件。
revertFileChange: (filePath: string, oldContent: string) =>
  ipcRenderer.invoke("chat:revert-file", filePath, oldContent),
```

### 5.8 第六层：useChat Hook 订阅

文件 `src/hooks/useChat.ts` 新增订阅：

```typescript
// Day 8: 订阅文件变更事件，将变更加入待审核队列并自动打开审核视图。
const unsub8 = window.api.onChatFileChange((data) => {
  const store = useEditorStore.getState()
  store.addPendingDiff(data)        // 加入待审核队列
  store.reviewDiff(data.filePath)   // 自动打开该文件的 diff 视图
})
```

解释：
1. `addPendingDiff` 将变更信息存入 Zustand store。
2. `reviewDiff` 立即将该 diff 设为 `activeDiff`，触发 InlineDiffView 渲染。
3. 用户不需要手动点击任何按钮——Agent 一修改文件，diff 自动弹出。

### 5.9 第七层：editor.store 状态管理

文件 `src/stores/editor.store.ts` Day 8 新增状态：

```typescript
interface EditorState {
  // ... 已有状态
  /** Day 8: 等待用户审核的文件变更队列。 */
  pendingDiffs: FileChangeInfo[]
  /** Day 8: 当前正在审核的 diff。 */
  activeDiff: FileChangeInfo | null

  addPendingDiff: (info: FileChangeInfo) => void
  reviewDiff: (filePath: string) => void
  acceptDiff: () => void
  rejectDiff: () => void
  clearDiffs: () => void
}
```

关键代码（addPendingDiff——去重逻辑）：

```typescript
addPendingDiff: (info) =>
  set((state) => ({
    // 如果同一文件已有 pending diff，替换为最新。
    pendingDiffs: [
      ...state.pendingDiffs.filter((d) => d.filePath !== info.filePath),
      info,
    ],
  })),
```

解释：Agent 可能连续两次修改同一个文件。此时第二次修改应**替换**第一次的 diff（因为文件内容已变化），而非追加。

关键代码（acceptDiff）：

```typescript
acceptDiff: () => {
  const { activeDiff, pendingDiffs } = get()
  if (!activeDiff) return
  set({
    activeDiff: null,
    pendingDiffs: pendingDiffs.filter((d) => d.filePath !== activeDiff.filePath),
    openFileContent: activeDiff.newContent,  // 编辑器显示新内容
  })
},
```

关键代码（rejectDiff）：

```typescript
rejectDiff: () => {
  const { activeDiff, pendingDiffs } = get()
  if (!activeDiff) return
  // 通过 IPC 恢复旧内容。
  window.api.revertFileChange(activeDiff.filePath, activeDiff.oldContent)
  set({
    activeDiff: null,
    pendingDiffs: pendingDiffs.filter((d) => d.filePath !== activeDiff.filePath),
    openFileContent: activeDiff.oldContent,  // 编辑器恢复旧内容
  })
},
```

解释：
1. Accept：只需更新前端状态，文件已经在工具执行时写入了。
2. Reject：需要**调用 IPC 恢复文件**（`revertFileChange`），因为工具执行时已经覆盖了磁盘上的文件。

---

## 6. 核心增量三：InlineDiffView——LCS Diff 视图

### 6.1 文件 `src/components/editor/InlineDiffView.tsx`

文件导读：
- 技术栈：React + useMemo + 纯算法实现。
- 作用：计算新旧文件的逐行 diff，渲染带颜色高亮的对比视图。
- 关系：读取 `editor.store` 的 `activeDiff`，调用 `acceptDiff` / `rejectDiff`。

#### LCS（最长公共子序列）算法

Diff 的核心问题是：**如何判断哪些行是"相同的"，哪些是"新增的"，哪些是"删除的"？**

答案是 **LCS（Longest Common Subsequence）算法**——找到两个序列的最长公共子序列，不在子序列中的元素就是差异。

```typescript
function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n")
  const newLines = newText.split("\n")

  // ① 构建 LCS 动态规划表
  const m = oldLines.length
  const n = newLines.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        oldLines[i - 1] === newLines[j - 1]
          ? dp[i - 1][j - 1] + 1                    // 相同行：LCS 长度 +1
          : Math.max(dp[i - 1][j], dp[i][j - 1])    // 不同行：取上方或左方的较大值
    }
  }

  // ② 回溯生成 diff 行
  const stack: DiffLine[] = []
  let i = m, j = n

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      stack.push({ type: "unchanged", lineNo: { old: i, new: j }, text: oldLines[i - 1] })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({ type: "added", lineNo: { old: null, new: j }, text: newLines[j - 1] })
      j--
    } else {
      stack.push({ type: "removed", lineNo: { old: i, new: null }, text: oldLines[i - 1] })
      i--
    }
  }

  // ③ 反转（回溯是从尾部开始的）
  return stack.reverse()
}
```

逐步解释：

**步骤①——动态规划表**：
- `dp[i][j]` 表示 `oldLines[0..i-1]` 和 `newLines[0..j-1]` 的 LCS 长度。
- 如果两行相同，LCS 长度 = 左上角 + 1。
- 如果不同，LCS 长度 = max(上方, 左方)。

**步骤②——回溯**：
- 从表的右下角 `(m, n)` 开始回溯。
- 相同行 → 标记为 `unchanged`，同时向左上移动。
- 优先从新文件侧取 → 标记为 `added`。
- 否则从旧文件侧取 → 标记为 `removed`。

**步骤③——反转**：回溯顺序是从后向前，需要 reverse 得到正序。

**性能说明**：LCS 的时间和空间复杂度为 $O(m \times n)$。对于教程项目中的文件（通常 < 1000 行），完全不是问题。生产环境可改用 Myers' Diff 算法（$O((m+n)d)$，$d$ 为差异行数）。

#### 视图渲染

```tsx
{diffLines.map((line, idx) => (
  <div key={idx} className={`flex ${lineStyles[line.type]}`}>
    {/* 旧行号 */}
    <span className={gutterStyles[line.type]}>
      {line.lineNo.old ?? ""}
    </span>
    {/* 新行号 */}
    <span className={gutterStyles[line.type]}>
      {line.lineNo.new ?? ""}
    </span>
    {/* 前缀 (+/-/空格) */}
    <span className={gutterStyles[line.type]}>
      {prefixMap[line.type]}
    </span>
    {/* 行内容 */}
    <span className="flex-1 whitespace-pre">{line.text}</span>
  </div>
))}
```

每行包含 4 列：旧行号 | 新行号 | 前缀符号 | 内容文本。

样式映射：
```typescript
const lineStyles = {
  unchanged: "",
  added: "bg-[rgba(74,222,128,0.10)]",    // 绿色半透明背景
  removed: "bg-[rgba(248,113,113,0.10)]",  // 红色半透明背景
}
```

#### 工具栏（Accept / Reject 按钮）

```tsx
<button onClick={rejectDiff}
  className="border border-[var(--color-error)] text-[var(--color-error)]">
  <X size={12} /> Reject
</button>
<button onClick={acceptDiff}
  className="bg-[var(--color-success)] text-[var(--color-bg-primary)]">
  <Check size={12} /> Accept
</button>
```

设计选择：
- Reject 按钮用"描边"样式（danger 但不强调）。
- Accept 按钮用"实心"样式（鼓励用户接受）。

---

## 7. 核心增量四：EditorArea 的 Pending Diff 标签栏

### 7.1 文件 `src/components/editor/EditorArea.tsx`

文件导读：
- 作用：编辑器区域的容器，管理 Monaco 编辑器和 Inline Diff 的切换。
- Day 8 变更：新增顶部标签栏，显示所有待审核文件。

关键代码：

```tsx
{pendingDiffs.length > 0 && (
  <div className="flex items-center gap-1 px-2 py-1 border-b
                  bg-[var(--color-bg-tertiary)] animate-fade-in">
    <FileWarning size={13} className="text-[var(--color-warning)]" />
    <span className="text-[11px] text-[var(--color-fg-muted)]">待审核：</span>
    {pendingDiffs.map((diff) => {
      const fileName = diff.filePath.replace(/\\/g, "/").split("/").pop()
      const isActive = activeDiff?.filePath === diff.filePath
      return (
        <button
          key={diff.filePath}
          onClick={() => reviewDiff(diff.filePath)}
          className={isActive
            ? "bg-[var(--color-accent-muted)] text-[var(--color-accent)]"
            : "text-[var(--color-fg-secondary)] hover:bg-[var(--color-bg-hover)]"
          }
        >
          {fileName}
        </button>
      )
    })}
  </div>
)}
```

解释：
1. 只在 `pendingDiffs.length > 0` 时渲染，避免空间浪费。
2. 从绝对路径中提取文件名（`.split("/").pop()`）——注意 Windows 路径先替换 `\` 为 `/`。
3. 当前活动的 diff 标签高亮（accent 颜色）。

---

## 8. 核心增量五：设置面板扩展

### 8.1 文件 `src/components/settings/SettingsDialog.tsx`

Day 8 新增三项配置，表单接口扩展：

```typescript
interface SettingsForm {
  apiKey: string
  baseURL: string
  model: string
  systemPrompt: string    // Day 8 新增
  maxIterations: number   // Day 8 新增
  temperature: number     // Day 8 新增
}

const DEFAULTS: SettingsForm = {
  apiKey: "",
  baseURL: "",
  model: "",
  systemPrompt: "",
  maxIterations: 10,
  temperature: 0.7,
}
```

#### System Prompt 配置

```tsx
<textarea
  value={form.systemPrompt}
  onChange={(e) => update("systemPrompt", e.target.value)}
  placeholder="可以在此添加额外的系统指令，会追加到默认系统提示词后面…"
  rows={3}
/>
```

用途：用户可以自定义追加指令，例如"回答使用中文"、"代码风格使用 4 空格缩进"。这些内容会被 `buildSystemPrompt()` 追加到系统提示词末尾。

#### Max Iterations 配置（Range Slider）

```tsx
<input
  type="range"
  min={1}
  max={30}
  value={form.maxIterations}
  onChange={(e) => update("maxIterations", parseInt(e.target.value))}
/>
<span>{form.maxIterations}</span>
```

用途：控制 Agent 单次对话中调用工具的最大循环次数。默认 10 次，复杂任务可调高。

#### Temperature 配置

```tsx
<input
  type="range"
  min={0}
  max={200}
  value={Math.round(form.temperature * 100)}
  onChange={(e) => update("temperature", parseInt(e.target.value) / 100)}
/>
<span>{form.temperature.toFixed(2)}</span>
```

解释：
1. HTML `<input type="range">` 只支持整数。Temperature 范围是 0~2.0，所以用 0~200 映射。
2. `value / 100` 将整数转为小数（如 70 → 0.70）。
3. Temperature 含义：0 = 确定性最强（每次输出几乎相同），2.0 = 最大随机性。编程任务建议 0.3~0.7。

### 8.2 后端配置透传

ProviderConfig 接口扩展（`base.provider.ts`）：

```typescript
export interface ProviderConfig {
  apiKey: string
  baseURL?: string
  model: string
  systemPrompt?: string     // Day 8 新增
  maxIterations?: number    // Day 8 新增
  temperature?: number      // Day 8 新增
}
```

ChatService 在创建 AgentLoop 时传入配置：

```typescript
this.currentLoop = new AgentLoop(this.provider, this.toolRegistry, {
  maxIterations: this.providerConfig?.maxIterations,
  systemPrompt: this.providerConfig?.systemPrompt,
  temperature: this.providerConfig?.temperature,
})
```

AgentLoop 构造函数读取配置：

```typescript
constructor(provider, toolRegistry, options?) {
  this.MAX_ITERATIONS = options?.maxIterations ?? 10   // 默认 10
  this.customSystemPrompt = options?.systemPrompt
  this.temperature = options?.temperature
}
```

OpenAI Provider 透传 temperature：

```typescript
const response = await this.client.chat.completions.create({
  model: this.config.model,
  messages: ...,
  temperature: options?.temperature,  // Day 8 新增
  stream: true,
})
```

---

## 9. 系统提示词更新

Day 8 的 `buildSystemPrompt()` 扩展为 6 工具完整列表 + 自定义追加：

```typescript
function buildSystemPrompt(workspacePath: string, customPrompt?: string): string {
  let prompt = `你是一个集成在代码编辑器中的 AI 编程助手...

== 可用工具 ==
- list_files：列出目录结构
- read_file：读取文件内容（带行号）
- search_files：正则搜索
- write_file：覆盖写入文件
- edit_file：精准替换（Patch 模式）
- run_command：执行 Shell 命令

== 行为准则 ==
1. 收到复杂任务时，先 list_files 了解项目结构
2. 修改文件前必须先 read_file
3. 小范围修改优先 edit_file，大范围重写用 write_file
...`

  if (customPrompt?.trim()) {
    prompt += `\n\n== 用户自定义指令 ==\n${customPrompt.trim()}`
  }
  return prompt
}
```

---

## 10. 完整运行流程追踪

### 示例：用户说"帮我在 README.md 末尾添加一段项目描述"

#### 10.1 用户消息 → Agent 循环

```
ChatInput 输入 → chat.store.sendMessage()
  → window.api.sendChatMessage(message, workspacePath)
    → IPC → ChatService.sendMessage()
      → AgentLoop.run()
```

#### 10.2 Agent 第一轮——读取文件

```
模型推理：需要先看 README.md 当前内容
→ tool_call: read_file({ path: "README.md" })
→ 工具执行：返回文件内容
→ tool 消息回传给模型
```

#### 10.3 Agent 第二轮——修改文件

```
模型推理：在末尾追加内容，使用 edit_file
→ tool_call: edit_file({
    path: "README.md",
    old_string: "（文件最后几行）",
    new_string: "（最后几行 + 新增的描述段落）"
  })
→ edit_file 工具执行：
  ① 读取文件 → 唯一性校验通过
  ② String.replace() 替换内容
  ③ 写入文件
  ④ context.onFileChange() ← 触发 Inline Diff 链路！
```

#### 10.4 文件变更事件传播

```
context.onFileChange({ filePath, oldContent, newContent, toolName: "edit_file" })
  → AgentLoop.callbacks.onFileChange()
    → ChatService.callbacks.onFileChange()
      → chat.ipc: safeSend("chat:file-change", info)
        → preload: ipcRenderer.on → callback
          → useChat: addPendingDiff(data) + reviewDiff(data.filePath)
            → editor.store: pendingDiffs 更新，activeDiff 设置
              → React 重渲染
```

#### 10.5 用户看到 Diff 视图

```
EditorArea 渲染 Pending Diff 标签栏（显示 "README.md"）
MonacoWrapper 切换到 InlineDiffView
InlineDiffView 调用 computeDiff(oldContent, newContent)
  → LCS 算法计算逐行差异
  → 渲染：绿色背景 = 新增行，红色背景 = 删除行
```

#### 10.6 用户点击 Accept

```
用户点击 Accept 按钮
  → editor.store.acceptDiff()
    → activeDiff = null（关闭 diff 视图）
    → 从 pendingDiffs 中移除
    → openFileContent = newContent（编辑器显示新内容）
  → React 重渲染：恢复 Monaco 编辑器
```

或者用户点击 **Reject**：

```
用户点击 Reject 按钮
  → editor.store.rejectDiff()
    → window.api.revertFileChange(filePath, oldContent)  ← IPC 恢复文件！
    → activeDiff = null
    → openFileContent = oldContent（编辑器恢复旧内容）
  → React 重渲染：恢复 Monaco 编辑器，文件已恢复
```

---

## 11. Day 8 必学知识点

### 11.1 CSS 自定义属性 vs Tailwind 硬编码

| | Tailwind 硬编码 | CSS 自定义属性 |
|---|---|---|
| 修改配色 | 全局搜索替换 | 改一处变量 |
| 主题切换 | 极难实现 | 覆盖 `:root` 变量即可 |
| 一致性 | 开发者可能用错相近色号 | 变量名有明确语义 |
| 适用阶段 | 原型开发 | 正式项目 |

### 11.2 LCS 算法

LCS（Longest Common Subsequence）是经典的动态规划问题：
- 输入：两个序列（这里是两个文件的行数组）
- 输出：最长公共子序列的长度（用于回溯生成 diff）
- 时间复杂度：$O(m \times n)$
- 空间复杂度：$O(m \times n)$（可优化为 $O(\min(m, n))$）

### 11.3 事件推送 vs 请求响应

Day 8 同时使用了两种 IPC 模式：
- **推送（Push）**：`webContents.send("chat:file-change", data)` —— 主进程主动推送，渲染进程被动接收。用于实时通知。
- **请求响应（Request-Response）**：`ipcRenderer.invoke("chat:revert-file", ...)` —— 渲染进程主动请求，等待结果。用于用户操作。

### 11.4 可选链调用（Optional Chaining）

Day 8 大量使用 `context.onFileChange?.({...})` 语法：

```typescript
context.onFileChange?.({...})  // 等价于：
if (context.onFileChange) {
  context.onFileChange({...})
}
```

`?.` 是 TypeScript/JavaScript 的可选链操作符：如果左侧为 `undefined` 或 `null`，跳过调用，不抛异常。

---

## 12. Day 8 检查项

1. `npm run dev` 可正常启动，整体配色为深蓝灰色调。
2. 各按钮悬停有统一的过渡动画效果。
3. 设置对话框有"Agent 行为"分区，含 System Prompt、Max Iterations、Temperature。
4. 让 Agent 修改一个文件，编辑器顶部出现黄色 ⚠ "待审核"标签栏。
5. 点击标签可见红绿色逐行 diff（含行号、+/- 前缀）。
6. 点击 Accept → diff 关闭，文件保留修改。
7. 点击 Reject → 文件恢复原内容，编辑器显示旧内容。
8. 修改 Temperature 后让 Agent 回答问题，观察输出是否更随机/更确定。
9. 在 System Prompt 中写"回答使用英文"，验证 Agent 是否遵守。

---

## 13. 延伸思考

1. **Myers' Diff vs LCS**：Day 8 的 LCS 算法对于 5000 行文件会很慢（$O(n^2)$ 时间/空间）。如何实现 Myers' Diff？参考 `diff` 命令的实现。

2. **多文件同时修改**：如果 Agent 在一次对话中修改了 10 个文件，当前的标签栏 UX 如何优化？（提示：支持"全部 Accept"/"全部 Reject"按钮）

3. **持久化 Diff 历史**：目前关闭窗口后 pendingDiffs 丢失。如何保存到磁盘？

4. **亮色主题**：尝试添加一个 `.theme-light` CSS 类，覆盖 `:root` 变量实现亮色模式切换。

5. **分块 Accept**：当前只能整文件 Accept/Reject。能否实现"逐行"或"逐块"接受？（提示：VS Code 的 inline suggestions 就是这样做的）
npm install

# 开发模式
npm run dev

# 生产构建
npx electron-vite build

# 预览
npx electron-vite preview
```

---

## 项目结构（Day 8 关键变更文件）

```
day8/
├── src/
│   ├── main.css                          # 设计系统 + 动画
│   ├── components/
│   │   ├── editor/
│   │   │   ├── InlineDiffView.tsx         # ★ 新增：内联 Diff 组件
│   │   │   ├── EditorArea.tsx             # 重写：集成 Diff 标签栏
│   │   │   └── MonacoWrapper.tsx          # 更新：activeDiff 切换
│   │   ├── settings/
│   │   │   └── SettingsDialog.tsx         # 重写：6 配置项 + 新设计
│   │   └── ...                           # 全部组件 CSS 变量迁移
│   ├── stores/
│   │   └── editor.store.ts               # 新增 pendingDiffs 状态管理
│   └── hooks/
│       └── useChat.ts                    # 订阅文件变更事件
├── electron/
│   ├── services/agent/
│   │   ├── agent-loop.ts                 # 可配 maxIterations/temperature/systemPrompt
│   │   ├── chat.service.ts               # 透传配置到 AgentLoop
│   │   └── providers/
│   │       ├── base.provider.ts          # ProviderConfig 扩展字段
│   │       └── openai.provider.ts        # temperature 传递
│   ├── ipc/chat.ipc.ts                   # file-change 推送 + revert handler
│   └── preload.ts                        # onChatFileChange / revertFileChange
└── README-day8.md
```
