# Day 6 — 自动化智能体主循环 (AgentLoop)

> **系列定位**：在 Day 5 实现工具调用的基础上，Day 6 将「循环推理」逻辑从 ChatService 中彻底抽出，构建一个具备**无干预自主多轮推理**能力的独立 `AgentLoop` 类，并通过可视化 UI 将 Agent 内部的复杂状态流降维呈现给用户。

---

## 学习目标

| # | 目标 |
|---|------|
| 16 | 实现最核心的 **AgentLoop** 自动化循环机制（`agent-loop.ts`） |
| 17 | 处理多轮对话递归：模型请求工具 → 本地执行 → 结果合并进上下文 → 模型继续推理 |
| 18 | 添加可视化 UI 展示"思考中"、"正在调用工具"、"迭代轮次"等 Agent 内部状态 |

---

## Day 5 → Day 6 核心变化速览

```
Day 5 架构（扁平）：
  ChatService.sendMessage()
    └── for (let i = 0; i < MAX; i++) {  ← 循环逻辑直接在服务方法里
          调用 Provider → 执行工具 → ...
        }

Day 6 架构（分层）：
  ChatService.sendMessage()       ← 薄层：管理历史/配置/abort 信号
    └── AgentLoop.run()           ← 核心：推理-执行-推理自动循环
          ├── LLMProvider.chat()  ← 流式调用
          └── ToolRegistry.execute()  ← 工具执行
```

---

## 核心概念一：AgentLoop 设计模式

### ReAct 模式（Reason + Act）

AgentLoop 实现了 AI Agent 领域著名的 **ReAct**（Reasoning + Acting）模式：

```
┌─────────────────────────────────────────────────────────────────┐
│                         AgentLoop.run()                         │
│                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │  THINK   │───▶│   ACT    │───▶│ OBSERVE  │───▶│  THINK   │  │
│  │(模型推理) │    │(工具执行) │    │(结果注入) │    │(继续推理) │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│       │                                                         │
│       │ 无 tool_calls → 直接输出文字                             │
│       ▼                                                         │
│  ┌──────────┐                                                   │
│  │ RESPOND  │ ← onComplete()                                    │
│  └──────────┘                                                   │
└─────────────────────────────────────────────────────────────────┘
```

每次循环的决策逻辑：

```typescript
// 来自 agent-loop.ts
if (completedToolCalls.length === 0) {
  // 模型只返回文本 → 任务完成，退出循环
  callbacks.onComplete(fullText)
  return
}
// 有工具调用 → 执行工具，把结果追加进上下文 → 循环继续
```

### 为什么必须提取为独立类？

| 混入 ChatService (Day 5) | 独立 AgentLoop (Day 6) |
|---|---|
| 逻辑与配置/历史代码混在一起 | 职责单一，可独立单元测试 |
| 无法复用（每个服务都需重写） | 任何 Provider + ToolRegistry 都能用 |
| 无法干净地取消 | `abort()` 方法清晰暴露 |
| 难以扩展（如加超时、重试） | 在一处修改即可影响所有调用方 |

---

## 核心概念二：消息上下文的构建与累积

AgentLoop 的上下文由三层消息堆叠而成：

```
conversationMessages = [
  { role: "system",    content: buildSystemPrompt(workspacePath) },   // 层 1: 系统提示词
  ...initialMessages,    // 层 2: 传入的历史对话（user/assistant 交替）
  // 层 3: 每轮工具调用后动态追加
  { role: "assistant", content: null, tool_calls: [...] },           // 模型的工具调用意图
  { role: "tool",      content: "文件内容...", tool_call_id: "..." }, // 工具执行结果
  // ↑ 以上两条在每轮工具调用后追加，模型下一轮可以"看到"这些结果
]
```

关键规则：**OpenAI API 要求** `tool` 角色消息必须紧跟在对应的 `assistant` 消息之后，且 `tool_call_id` 必须匹配。这就是为什么代码中先 push `assistant` 消息再 push `tool` 消息。

---

## 核心概念三：系统提示词工程

`buildSystemPrompt()` 是让 Agent "知道自己是谁、能做什么" 的关键：

```typescript
function buildSystemPrompt(workspacePath: string): string {
  return `你是一个集成在代码编辑器中的 AI 编程助手...
当前工作区根目录：${workspacePath}   // ← 注入运行时信息

== 工具使用规则 ==              // ← 防止路径歧义
== 可用工具 ==                  // ← 告知工具列表
== 行为准则 ==                  // ← 约束行为（先读后写等）`
}
```

**为什么不在用户消息里注入**：系统提示词会在每次 run() 时自动添加，避免用户消息污染，模型也会更严格地遵守 `system` 角色的指令。

---

## 核心概念四：abort() 取消机制

```typescript
export default class AgentLoop {
  private aborted = false  // 简单布尔标志

  abort(): void {
    this.aborted = true  // 下一个检查点生效
  }

  async run(...) {
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      if (this.aborted) {  // ← 检查点 1：每轮开始前
        callbacks.onComplete(fullText)
        return
      }
      // ...
      for await (const chunk of stream) {
        if (this.aborted) break  // ← 检查点 2：流式消费中
      }
      if (this.aborted) {  // ← 检查点 3：工具执行前
        callbacks.onComplete(fullText)
        return
      }
    }
  }
}
```

**设计解析**：
- 不用 `AbortController`：流式 SDK 的 abort 支持不一致，布尔标志更可靠
- 三个检查点覆盖所有可能的阻塞位置
- 取消后调用 `onComplete`（而非 `onError`），保留已生成的部分内容

调用链：用户点击取消 → `ChatPanel` 调用 `abortChat()` → Store 调用 `window.api.abortChat()` → IPC `chat:abort` → `ChatService.abort()` → `AgentLoop.abort()`

---

## 核心概念五：复杂状态流的 UI 可视化降维

Agent 的内部状态比普通聊天复杂得多，需要将其「降维」为用户可理解的视觉反馈：

```
                    Agent 内部状态
                    ─────────────
isThinking=true     模型正在推理（调用 LLM API，等待第一个 token）
                    ↓ 脑电图标脉冲（紫色）
                    ─────────────
isThinking=false    模型开始输出文字
isStreaming=true     ↓ 旋转加载图标（蓝色）+ "生成中..."
                    ─────────────
toolCall.running    模型决定调用工具
                    ↓ ToolCallBlock（蓝色"执行中"徽章）
                    ─────────────
isThinking=true     工具执行完毕，再次调用模型
（下一轮）          ↓ 再次脑电图标脉冲
                    ─────────────
iteration N/M       当前迭代轮次（顶栏徽章）
```

这种设计让用户不必理解 Agent Loop 的内部机制，也能直观感知 Agent 正在做什么。

### 三个 UI 组件的状态联动

```
   chat.store.ts                ChatPanel.tsx
   ─────────────                ─────────────
   isThinking ──────────────▶  脑电图标 animate-pulse
   isStreaming ──────────────▶  旋转 Loader / 输入框禁用
   iteration / maxIteration ─▶  轮次徽章
   (abortChat action) ◀────────  取消按钮 onClick
```

---

## Day 6 新增文件与变更

### 新增文件

| 文件 | 说明 |
|------|------|
| `electron/services/agent/agent-loop.ts` | 核心：AgentLoop 类 + AgentLoopCallbacks 接口 + buildSystemPrompt |
| `electron/services/agent/tools/write-file.tool.ts` | write_file 工具（含路径穿越防护） |

### 重要变更

| 文件 | 变更说明 |
|------|---------|
| `electron/services/agent/chat.service.ts` | 从 ~160 行精简至 ~90 行；循环逻辑完全迁移至 AgentLoop |
| `electron/ipc/chat.ipc.ts` | 新增 `chat:abort` 处理器 + `chat:thinking` / `chat:iteration` 推送 |
| `electron/preload.ts` | 新增 `abortChat()` + `onChatThinking()` + `onChatIteration()` |
| `src/vite-env.d.ts` | `RendererApi` 新增三个方法签名 |
| `src/stores/chat.store.ts` | 新增 `isThinking`/`iteration`/`maxIteration` 状态 + 对应 actions |
| `src/hooks/useChat.ts` | 订阅两个新事件，暴露 `abortChat` |
| `src/components/chat/ChatPanel.tsx` | 思考中指示器 + 迭代轮次徽章 + 取消按钮 |
| `src/components/layout/StatusBar.tsx` | 更新为 "Day 6 AgentLoop"（紫色主题） |

---

## 代码核心片段解析

### 1. AgentLoopCallbacks 接口设计

```typescript
export interface AgentLoopCallbacks {
  onThinking(): void             // 状态：模型推理中（UI 显示脑电图标）
  onToken(token: string): void   // 数据：文字 token 流
  onToolCallStart(info): void    // 状态：工具调用开始（UI 显示工具卡片）
  onToolCallResult(info): void   // 数据：工具执行结果
  onComplete(fullText: string): void  // 终态：正常完成
  onError(error: string): void        // 终态：错误
  onIteration(cur: number, max: number): void  // 元信息：轮次进度
}
```

这是 AgentLoop 与外界通信的**唯一接口**，体现了关注点分离：AgentLoop 不知道也不关心谁在监听，只管按约定触发回调。

### 2. 工具调用的三阶段处理

```typescript
// 阶段 1: 流式过程中，先通知前端（工具名已知，参数还在生成）
case "tool_call_start":
  callbacks.onToolCallStart({ id, name, args: "" })

// 阶段 2: 流结束后，参数完整，加入待执行列表
case "tool_call_end":
  completedToolCalls.push({ id, function: { name, arguments } })

// 阶段 3: 同步执行工具，追加结果
for (const tc of completedToolCalls) {
  const result = await toolRegistry.execute(tc.name, args, { workspacePath })
  callbacks.onToolCallResult({ id, name, result, isError })
  conversationMessages.push({ role: "tool", content: result, tool_call_id: tc.id })
}
// 循环继续 → 模型基于 tool 消息继续推理
```

### 3. write_file 工具的路径安全校验

```typescript
const absTarget = path.resolve(context.workspacePath, relativePath)
const rel = path.relative(context.workspacePath, absTarget)

// path.relative() 返回 ".." 开头 → 目标在工作区之外 → 拒绝
if (rel.startsWith("..") || path.isAbsolute(rel)) {
  return JSON.stringify({ error: "安全错误：不允许写入工作区目录之外的文件。" })
}
```

这是防御 **Path Traversal（路径穿越）攻击** 的标准做法：不能仅检查用户输入是否含 `../`，因为 URL 编码等方式可绕过；必须将路径 **resolve 为绝对路径后再比较**。

### 4. ChatPanel 中的状态可视化

```tsx
{/* 状态指示区：根据 isThinking 切换两种视觉 */}
{isStreaming && (
  <div className="flex items-center gap-2 ...">
    {isThinking ? (
      // "思考中" = 模型推理阶段（脑电图标紫色脉冲）
      <><BrainCircuit size={13} className="text-purple-400 animate-pulse" />
        <span className="text-purple-400">思考中...</span></>
    ) : (
      // "生成中" = 模型输出文字阶段（蓝色旋转）
      <><Loader2 size={12} className="animate-spin text-blue-400" />
        <span>生成中...</span></>
    )}
  </div>
)}
```

---

## 运行方式

```bash
# 1. 进入 day6 目录
cd GUIDE/day6

# 2. 安装依赖（首次）
npm install

# 3. 开发模式启动
npm run dev
```

**配置 API Key（同 Day 4~5）**：打开开发者工具 Console，执行：

```js
window.api.updateChatSettings({
  apiKey: "sk-...",
  baseURL: "https://api.openai.com/v1",
  model: "gpt-4o-mini"
})
```

---

## 测试 Agent 能力

启动后，打开一个工作区文件夹，然后在聊天框中尝试：

```
帮我列出这个项目的目录结构，然后告诉我主要包含哪些模块。
```

```
读取 src/App.tsx，然后在同级目录下创建一个 HelloWorld.tsx 组件文件。
```

观察：
- 顶栏徽章显示 "轮次 1/10" → "轮次 2/10" 变化
- 底部状态栏在 "思考中..." 和 "生成中..." 之间切换
- ToolCallBlock 显示工具调用过程

---

## 与 Day 5 的对比测试

| 特性 | Day 5 | Day 6 |
|------|-------|-------|
| Agent Loop 位置 | ChatService.sendMessage() 内嵌 | 独立 AgentLoop 类 |
| 系统提示词 | 无 | 有（工作区路径 + 工具说明 + 行为准则） |
| 可用工具数 | 3 个（只读） | 4 个（+ write_file） |
| 取消操作 | 无 | 顶栏取消按钮 |
| 迭代进度 | 无 | 轮次 N/M 徽章 |
| 思考状态 | 无 | 脑电图标脉冲 |
| 路径安全 | 无 | Path Traversal 防护 |

---

## Day 6 核心架构图

```
Renderer Process                Main Process
────────────────                ────────────
ChatPanel.tsx                   chat.ipc.ts
  ├── isThinking (紫色脉冲)          ├── chat:send-message
  ├── iteration (轮次徽章)           │     └── chatService.sendMessage()
  └── abortChat (取消按钮)           │           └── AgentLoop.run()
                                    │                 ├── LLMProvider.chat()  ← OpenAI
chat.store.ts                       │                 │     └── 流式 chunk
  ├── handleThinking()              │                 └── ToolRegistry.execute()
  ├── handleIteration()             │                       ├── read_file
  └── abortChat()                   │                       ├── list_files
                                    │                       ├── search_files
useChat.ts                          │                       └── write_file ← 新增
  ├── onChatThinking  ◀──── chat:thinking
  ├── onChatIteration ◀──── chat:iteration
  ├── onChatToolCall  ◀──── chat:tool-call
  └── onChatToolResult◀──── chat:tool-result
                            └── chat:abort ────▶ chatService.abort()
                                                    └── agentLoop.abort()
```

---

## 延伸思考

### 为什么 MAX_ITERATIONS = 10？

防止「工具调用死循环」：极少情况下，模型可能陷入无限循环（每轮都调用工具，但无法收敛到最终答案）。设置上限是一种**防御性编程**策略。10 轮足以完成大多数编程任务。

### AgentLoop 与传统 Chat 的本质区别

传统 Chat：用户 → 模型 → 用户（单轮，人工干预）  
Agent Loop：用户 → [模型 ↔ 工具]* → 用户（多轮，无人干预）

这个 `*`（零次或多次的循环）就是「自主性」的来源：Agent 能够自己决定需要哪些信息，自己去获取，自己判断是否足够，**不需要用户每一步都手动介入**。

### Day 7 预告

引入更强大的文件编辑工具 `edit_file`（基于行号的精准替换），以及 Git 集成（读取 diff、提交变更），让 Agent 能够进行真正的代码修改与版本管理。
