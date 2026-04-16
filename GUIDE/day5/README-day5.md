# Day 5：智能体工具箱与 Function Calling

## 前言

Day 4 我们搭建了"人 → LLM → 人"的流式对话通道。模型只能阅读你的提问并回答，无法主动触碰工作区。

Day 5 的目标是给模型装上"眼睛"：

1. 建立工具注册中心（ToolRegistry），让 LLM 知道它持有哪些工具。
2. 实现三个只读工具：`read_file`（读文件）、`list_files`（列目录）、`search_files`（全文搜索）。
3. 在 OpenAI Provider 中接入 Function Calling，解析流式 `tool_calls` 响应。
4. 在 ChatService 中构建 Agent Loop：LLM 决定调用工具 → 执行工具 → 结果回传 → LLM 继续推理。
5. 在 Chat 面板中以可折叠块展示每次工具调用的参数与结果。

完成 Day 5 后，你可以问"帮我读一下 src/main.ts"，模型会自动调用 `read_file` 工具并告诉你文件内容。

---

## 1. 本日增量目标

### 1.1 功能目标
1. 在 Chat 面板提问有关工作区内容的问题时，模型自动选择工具并执行。
2. 工具调用以可折叠卡片形式嵌入对话流，实时显示状态（执行中 / 完成 / 失败）。
3. 支持多工具多轮调用（最多 10 次迭代）。
4. 保持 Day 1\~4 的文件树、编辑器、终端、对话功能完好。

### 1.2 工程目标
1. 工具与 Provider 通过接口解耦：增加新工具只需在注册中心调用 `register()`。
2. JSON Schema 定义参数格式：模型据此生成合法参数，无需人工编码解析控制流。
3. Agent Loop 在主进程中完整运行，渲染进程只负责展示。

---

## 2. 运行步骤

```powershell
Set-Location .\GUIDE\day5
npm install
npm run dev
```

配置 Provider（首次运行，在 DevTools Console 执行）：

```js
window.api.updateChatSettings({
  apiKey: '你的 API Key',
  baseURL: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini'
})
```

### 验证工具调用

提问示例：

```
帮我列出工作区根目录的文件结构
搜索代码中所有叫 useEffect 的地方
读取 package.json 的内容
```

模型应当自动调用 `list_files` / `search_files` / `read_file`，Chat 面板中出现蓝色"执行中"卡片，完成后变为绿色。

---

## 3. Day 5 变更结构（相对 Day 4）

```text
day5/
├─ electron/
│  ├─ preload.ts                                  (修改：新增工具调用事件监听)
│  ├─ ipc/
│  │  └─ chat.ipc.ts                              (修改：传入 workspacePath，新增工具推送)
│  └─ services/
│     └─ agent/
│        ├─ chat.service.ts                       (修改：升级为 Agent Loop)
│        ├─ providers/
│        │  ├─ base.provider.ts                   (修改：新增 ToolCall/ToolDefinition/Message.tool)
│        │  └─ openai.provider.ts                 (修改：支持 Function Calling 流式解析)
│        └─ tools/                                (全部新增)
│           ├─ tool-registry.ts
│           ├─ read-file.tool.ts
│           ├─ list-files.tool.ts
│           └─ search.tool.ts
├─ src/
│  ├─ hooks/
│  │  └─ useChat.ts                               (修改：订阅工具事件，传递 workspaceRoot)
│  ├─ stores/
│  │  ├─ chat.store.ts                            (修改：新增工具调用状态管理)
│  │  └─ file-tree.store.ts                       (新增：提升 workspaceRoot 到全局 store)
│  ├─ components/
│  │  ├─ chat/
│  │  │  ├─ ToolCallBlock.tsx                     (新增：工具调用展示卡片)
│  │  │  └─ ChatMessage.tsx                       (修改：在 assistant 消息下渲染工具卡片)
│  │  └─ file-explorer/
│  │     └─ FileExplorer.tsx                      (修改：使用 file-tree store)
│  └─ vite-env.d.ts                               (修改：新增 ToolCallInfo 类型)
└─ README-day5.md
```

---

## 4. 核心增量一：ToolRegistry 工具注册中心

### 4.1 文件 `electron/services/agent/tools/tool-registry.ts`

文件导读：
- 技术栈：TypeScript 类 / Map 数据结构 / 接口定义。
- 作用：统一维护工具索引；提供 `getToolDefinitions()` 把工具描述转为 OpenAI 接受的格式；提供 `execute()` 按名称路由执行。

关键接口：

```ts
export interface AgentTool {
  name: string               // 触发名称，必须唯一
  description: string        // 自然语言描述，模型阅读此文字决定是否调用工具
  parameters: Record<string, unknown>  // JSON Schema
  execute(args, context): Promise<string>
}
```

关键方法：

```ts
getToolDefinitions(): ToolDefinition[] {
  return this.getAll().map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,   // ← 直接映射 JSON Schema
    },
  }))
}
```

设计要点：工具注册中心不关心工具实现，只维护名称→实现的映射表。扩展时在 `chat.service.ts` 里 `register()` 一行代码即可。

---

## 5. 核心增量二：三个只读工具

### 5.1 工具：`read_file`（文件 `read-file.tool.ts`）

JSON Schema：

```json
{
  "type": "object",
  "properties": {
    "path":   { "type": "string" },
    "offset": { "type": "number", "description": "起始行号（1-indexed）" },
    "limit":  { "type": "number", "description": "读取行数" }
  },
  "required": ["path"]
}
```

执行逻辑：读取文件 → 按 offset/limit 截取行 → 添加行号前缀（` 1|line content`）。

### 5.2 工具：`list_files`（文件 `list-files.tool.ts`）

功能：递归构建目录树，自动跳过 `node_modules`、`.git`、`dist` 等无关目录，最多返回 200 条。

JSON Schema 关键参数：
- `path`：目录路径（字符串）
- `recursive`：是否递归（布尔，可选）
- `maxDepth`：最大深度（数字，可选，默认 3）

### 5.3 工具：`search_files`（文件 `search.tool.ts`）

功能：全文扫描工作区，对每行执行正则匹配（字面量转义，默认大小写不敏感），返回 `文件路径:行号: 内容`，最多 50 条。

JSON Schema 关键参数：
- `query`：搜索词（必填）
- `path`：限定目录（可选）
- `caseSensitive`：区分大小写（可选）
- `filePattern`：文件名 glob，如 `"*.ts"`（可选）

---

## 6. 核心增量三：Provider 支持 Function Calling

### 6.1 文件 `electron/services/agent/providers/base.provider.ts`（新增类型）

```ts
// 工具调用描述
export interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }  // arguments 是 JSON 字符串
}

// OpenAI tools 字段格式
export interface ToolDefinition {
  type: 'function'
  function: { name: string; description: string; parameters: Record<string, unknown> }
}

// 扩展消息类型
export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: ToolCall[]     // assistant 消息在调用工具时携带
  tool_call_id?: string       // tool 消息必须携带，与调用对应
}

// 扩展流式块类型
export interface StreamChunk {
  type: 'text_delta' | 'tool_call_start' | 'tool_call_end' | 'done' | 'error'
  content?: string
  toolCall?: Partial<ToolCall>
}
```

### 6.2 文件 `electron/services/agent/providers/openai.provider.ts`（流式 tool_calls 解析）

OpenAI 流式 Function Calling 的特殊性：

| 普通文本 | Function Calling |
|---------|----------------|
| `delta.content` 逐 token 增量 | `delta.tool_calls[].function.arguments` 逐字符增量 |
| 直接 yield text_delta | 需要缓冲拼装，finish_reason 时才输出完整参数 |

关键代码逻辑：

```ts
const activeToolCalls = new Map<number, { id, name, arguments }>()

if (tc.id) {
  // 第一个 chunk：初始化记录 + 通知开始
  activeToolCalls.set(idx, { id: tc.id, name: tc.function.name, arguments: '' })
  yield { type: 'tool_call_start', toolCall: { id, name } }
} else {
  // 后续 chunk：追加 arguments 字符串
  existing.arguments += tc.function.arguments
}

// finish_reason 出现时：所有参数已齐全
for (const tc of activeToolCalls) {
  yield { type: 'tool_call_end', toolCall: { id, name, arguments: tc.arguments } }
}
```

---

## 7. 核心增量四：ChatService Agent Loop

### 7.1 文件 `electron/services/agent/chat.service.ts`

Agent Loop 伪代码：

```
构造函数：初始化 ToolRegistry，注册三个工具

sendMessage(userContent, workspacePath, callbacks):
  push 用户消息到历史

  for i in range(MAX_ITERATIONS=10):
    stream = provider.chat(messages, tools=registry.getToolDefinitions())

    for chunk in stream:
      if text_delta: callbacks.onToken(token)
      if tool_call_start: callbacks.onToolCall(id, name)
      if tool_call_end: 收集 completedToolCalls
      if error: callbacks.onError; return

    if completedToolCalls 为空:
      push assistant 文本消息
      callbacks.onComplete; return   ← 正常结束

    push assistant message (含 tool_calls 字段)
    for each tc in completedToolCalls:
      result = toolRegistry.execute(tc.name, tc.args)
      callbacks.onToolResult(id, result)
      push tool message (含 tool_call_id)

    // 继续下一轮，携带工具结果重新调用模型
```

关键设计：
1. tool 消息的 `tool_call_id` 必须与 assistant 消息的 `tool_calls[].id` 一一对应，OpenAI API 会校验。
2. 工具执行失败时返回 JSON 错误字符串，而不是抛异常——让模型感知失败并调整策略。
3. 最大 10 次迭代防止模型陷入无请求循环。

### 7.2 消息历史在多轮工具调用中的演化

```
初始：
  [user] "帮我列出目录结构"

第一轮调用后（模型选择工具）：
  → [assistant, tool_calls=[{id:"c1", name:"list_files", args:'{"path":"."}'}]]

工具执行后追加：
  → [tool, tool_call_id:"c1", content:"[DIR] src\n[DIR] electron\n..."]

第二轮调用（模型生成答复）：
  → [assistant, content:"工作区包含 src/ 和 electron/ 两个主目录..."]
```

---

## 8. 渲染层增量

### 8.1 文件 `src/stores/file-tree.store.ts`（新增）

将 `workspaceRoot` 从 `FileExplorer` 的本地 state 提升为 Zustand store。

原因：`useChat.ts` 需要在调用 `sendChatMessage` 时传入工作区路径，而它不能直接读取 `FileExplorer` 的本地 state。

### 8.2 文件 `src/stores/chat.store.ts`（工具调用状态）

新增两个动作：

```ts
// 工具调用开始：在最后一条 assistant 消息的 toolCalls 数组追加 running 记录
handleToolCall(info: { id, name, args }): void

// 工具调用结束：找到对应 id，更新 status 和 result
handleToolResult(info: { id, result, isError }): void
```

### 8.3 文件 `src/components/chat/ToolCallBlock.tsx`（新增）

可折叠卡片组件：
- 顶部：工具名称 + 状态徽章（蓝色旋转 = 执行中，绿勾 = 完成，红叉 = 失败）。
- 展开内容：格式化 JSON 参数 + 滚动区域内的执行结果。

### 8.4 文件 `src/hooks/useChat.ts`（扩展）

新增两个事件订阅：

```ts
window.api.onChatToolCall((data) => chatStore.handleToolCall(data))
window.api.onChatToolResult((data) => chatStore.handleToolResult(data))
```

传递工作区路径：

```ts
const workspaceRoot = useFileTreeStore((s) => s.workspaceRoot)
await sendMessage(content, workspaceRoot ?? process.cwd())
```

---

## 9. Day 5 必学知识点（零基础展开）

### 9.1 JSON Schema 是什么

JSON Schema 是一套用 JSON 描述"数据结构和约束"的规范。示例：

```json
{
  "type": "object",
  "properties": {
    "path": { "type": "string", "description": "文件路径" },
    "limit": { "type": "number" }
  },
  "required": ["path"]
}
```

在 Function Calling 中，`parameters` 字段就是一个 JSON Schema。模型阅读它并按照格式生成参数 JSON，调用方再 `JSON.parse()` 解析。

### 9.2 Function Calling 完整流程

```
1. 请求：发送 messages + tools（含 JSON Schema）给 OpenAI API
2. 模型推理：模型判断"需要调用工具"时，不生成文本，
             而是在 delta.tool_calls 中输出工具名和参数
3. 流式拼装：因为 arguments 是增量的，需要 Buffer 累积
4. finish_reason="tool_calls" 时：参数齐全，可以执行
5. 执行工具，将结果作为 role=tool 的消息追加到历史
6. 再次调用 API，模型用工具结果作为依据生成最终答复
```

### 9.3 为什么 tool_call_id 必须对应

OpenAI 的多工具调用协议要求：
- 每个 `tool_calls[i].id` 必须有一条 `tool_call_id === id` 的 tool 消息与之配对。
- 数量和顺序都不能错，否则 API 返回 400 错误。
- 这是实现"一轮调用多个工具（并行工具调用）"的基础。

### 9.4 Agent Loop 与普通对话的区别

| 普通对话 | Agent Loop |
|---------|------------|
| 用户说一轮，模型回一轮 | 用户说一轮，模型可能推理多轮 |
| 单次 `provider.chat()` | 循环调用 `provider.chat()` |
| 无工具 | 携带工具定义，模型自主选择 |
| 结果固定 | 结果取决于工具执行情况 |

### 9.5 只读工具的工程意义

Day 5 刻意只实现只读工具（无写入、无命令执行）：
1. 教学安全：防止模型在演示中意外修改文件。
2. 功能完备：凭借"读文件 + 列目录 + 全文搜索"，模型能理解 95% 的代码库结构。
3. Day 6 将引入写入工具（edit_file），届时将讲解权限控制和变更确认机制。

---

## 10. 完整运行流程追踪（提问"列出目录结构"）

### 10.1 渲染层发起请求
1. 用户输入"帮我列出工作区目录" → `ChatInput` → `useChatStore.sendMessage(content, workspacePath)`。
2. Store 追加 user 消息 + 空 assistant 消息（含 `toolCalls: []`）。
3. 调用 `window.api.sendChatMessage(content, workspacePath)`。

### 10.2 主进程 Agent Loop 第一轮
1. `chatService.sendMessage` 携带 3 个工具定义调用 `provider.chat()`。
2. OpenAI 模型判断需调用 `list_files`，在流中产出 `delta.tool_calls`。
3. Provider yield `tool_call_start` → IPC push `chat:tool-call` → 渲染层 `handleToolCall` → 卡片变为蓝色旋转。
4. 参数拼装完毕，Provider yield `tool_call_end` → `completedToolCalls` 收到。

### 10.3 工具执行
1. Agent Loop 执行 `toolRegistry.execute('list_files', { path: '.' }, { workspacePath })`。
2. `list-files.tool.ts` 扫描目录，返回树形字符串。
3. IPC push `chat:tool-result` → 渲染层 `handleToolResult` → 卡片变为绿色。
4. tool 消息被追加到历史。

### 10.4 主进程 Agent Loop 第二轮
1. 携带 tool 结果再次调用模型。
2. 模型不再产出 `tool_calls`，直接生成文本答复。
3. 文本以流方式 push `chat:stream` token → 渲染层 append，看到字符逐一出现。
4. `chat:complete` → 光标消失，循环结束。

---

## 11. 验证清单

1. 启动应用，状态栏显示 `Day 5 Agent + Tools`。
2. 配置 API Key 后（DevTools Console）发送"列出根目录文件"。
3. Chat 面板出现蓝色"执行中"的 `list_files` 卡片，点开可展开看参数。
4. 卡片变绿后，模型生成文字答复。
5. 发送"搜索 useState 的使用位置"，验证 `search_files` 工具被调用。
6. 发送"读取 package.json 内容"，验证 `read_file` 工具被调用。
7. 点击工具卡片展开/折叠正常。

---

## 12. 常见问题

### 12.1 模型不调用工具，直接回答
- 某些模型（尤其国产 4B 小模型）Function Calling 遵从度差。
- 换用 `gpt-4o-mini` 或 `deepseek-chat` 效果更佳。
- 在问题里明确指示"请使用工具"也能提示模型。

### 12.2 工具卡片一直转（执行中）
- 检查 DevTools Console 是否有 `chat:tool-result` 事件。
- 检查 `workspacePath` 是否正确（应为 day5 目录路径，如 `D:\Project\...\day5`）。

### 12.3 API 返回 400 Bad Request
- 多数情况是 `tool_call_id` 不匹配，检查 chat.service.ts 中 tool 消息是否携带 `tool_call_id`。
- 也可能是模型不支持 Function Calling，尝试换模型。

---

## 13. 下一步（Day 6 预告）

Day 6 将在 Day 5 只读工具基础上引入写入工具：
1. `write_file`：覆盖写文件。
2. `edit_file`：精确行级编辑（类似 patch）。
3. 模型提出变更时，在 Chat 面板弹出"确认"界面，用户批准后才真正写入文件。

届时，一个能"理解项目结构 → 读取源码 → 生成修改方案 → 等待确认 → 写入文件"的完整 AI 编码助手将成形。
