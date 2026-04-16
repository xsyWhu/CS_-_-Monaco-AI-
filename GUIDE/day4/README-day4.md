# Day 4：Chat 面板、LLM Provider 与流式对话

## 前言
Day 1\~3 我们搭建了 IDE 骨架（布局 → 编辑器/终端 → 文件系统/文件树）。

Day 4 的目标是把 IDE 从"开发工具"推进到"AI 辅助开发环境"的起点：

1. 在主进程实现 OpenAI 兼容 LLM Provider，通过流式 API 生成文本。
2. 通过 IPC 事件推送（`webContents.send`）将流式 token 实时传递到渲染进程。
3. 在渲染层构建 Chat 面板（消息列表 + 输入框 + 流式光标），通过活动栏图标切换显隐。

完成 Day 4 后，你将拥有一个"能与 LLM 实时对话"的 IDE。

---

## 1. 本日增量目标

### 1.1 功能目标
1. 点击活动栏聊天图标，右侧弹出 Chat 面板。
2. 在输入框发送消息后，Chat 面板实时展示 LLM 流式输出。
3. 支持多轮对话（上下文自动携带历史消息）。
4. 保持 Day 1\~3 的文件树、编辑器、终端能力完好。

### 1.2 工程目标
1. LLM 调用在主进程执行，渲染进程不直接持有 API Key。
2. 流式数据通过 `webContents.send` 推送到渲染进程，渲染层通过事件监听器接收。
3. Provider 配置持久化到 Electron userData 目录。
4. TypeScript 类型覆盖完整，无假错误。

---

## 2. 运行步骤

### 2.1 安装依赖
```powershell
Set-Location .\GUIDE\day4
npm install
```

### 2.2 配置 LLM Provider
Day 4 暂未实现设置弹窗 UI。启动后请在 Electron 开发者工具 Console 中执行：

```js
window.api.updateChatSettings({
  apiKey: '你的 API Key',
  baseURL: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini'
})
```

> 兼容端点（DeepSeek、Moonshot、Ollama 等）只需修改 `baseURL` 和 `model`。

### 2.3 启动项目
```powershell
npm run dev
```

### 2.4 预期现象
1. Electron 窗口正常启动。
2. 点击左侧活动栏 💬 图标，右侧弹出 Chat 面板。
3. 输入消息回车后，助手消息以流式方式逐字出现。
4. 状态栏显示 `Day 4 Chat + LLM`。
5. 文件树、Monaco、终端功能保持正常。

---

## 3. Day 4 变更结构（相对 Day 3）

```text
day4/
├─ electron/
│  ├─ main.ts                                    (修改：注释更新)
│  ├─ preload.ts                                 (修改：新增 Chat API + 事件监听)
│  ├─ ipc/
│  │  ├─ index.ts                                (修改：注册 Chat IPC)
│  │  └─ chat.ipc.ts                             (新增：Chat 通道注册)
│  └─ services/
│     └─ agent/
│        ├─ chat.service.ts                      (新增：Chat 服务)
│        └─ providers/
│           ├─ base.provider.ts                  (新增：Provider 接口)
│           └─ openai.provider.ts                (新增：OpenAI 实现)
├─ src/
│  ├─ hooks/
│  │  └─ useChat.ts                              (新增：事件监听 Hook)
│  ├─ stores/
│  │  ├─ editor.store.ts                         (修改：增加 isChatOpen)
│  │  └─ chat.store.ts                           (新增：Chat 状态管理)
│  ├─ components/
│  │  ├─ chat/
│  │  │  ├─ ChatPanel.tsx                        (新增：Chat 面板)
│  │  │  ├─ ChatInput.tsx                        (新增：输入框)
│  │  │  └─ ChatMessage.tsx                      (新增：消息气泡)
│  │  ├─ layout/
│  │  │  ├─ AppLayout.tsx                        (修改：接入 Chat 面板)
│  │  │  └─ StatusBar.tsx                        (修改：Day 4 标识)
│  │  └─ terminal/
│  │     └─ TerminalInstance.tsx                 (修改：Day 4 欢迎文案)
│  └─ vite-env.d.ts                              (修改：Chat 相关类型)
├─ package.json                                  (修改：新增 openai 依赖)
└─ README-day4.md                                (新增)
```

---

## 4. 主进程增量一：Provider 接口与 OpenAI 实现

### 4.1 文件 `electron/services/agent/providers/base.provider.ts`

文件导读：
- 技术栈：TypeScript 接口定义 + 异步迭代器协议。
- 作用：定义所有 LLM Provider 必须实现的契约。
- 关系：`OpenAIProvider` 实现此接口；`ChatService` 通过此接口调用。

关键类型：

```ts
export interface StreamChunk {
  type: 'text_delta' | 'done' | 'error'
  content?: string
  error?: string
}

export interface LLMProvider {
  chat(params: {
    messages: ChatMessage[]
    stream: boolean
  }): AsyncIterable<StreamChunk>
}
```

解释：
1. `StreamChunk` 用联合字面量类型 `type` 区分"增量文本 / 完成 / 错误"三种事件。
2. `AsyncIterable<StreamChunk>` 表示返回值可被 `for await...of` 消费——这是流式处理的核心抽象。
3. Provider 接口只有 `chat` 一个方法，职责单一，便于日后扩展更多 Provider。

### 4.2 文件 `electron/services/agent/providers/openai.provider.ts`

文件导读：
- 技术栈：OpenAI Node.js SDK + `async function*`（异步生成器）。
- 作用：将 OpenAI Chat Completions 流式 API 适配为统一 `StreamChunk` 迭代器。
- 兼容性：任何实现了 OpenAI 协议的端点（DeepSeek、Moonshot、Ollama）只需改 `baseURL`。

关键代码：

```ts
async *chat(params: { messages: ChatMessage[]; stream: boolean }): AsyncIterable<StreamChunk> {
  const stream = await this.client.chat.completions.create({
    model: this.config.model,
    messages: openaiMessages,
    stream: true
  })

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta
    if (delta?.content) {
      yield { type: 'text_delta', content: delta.content }
    }
  }

  yield { type: 'done' }
}
```

解释：
1. `async *chat(...)` 声明异步生成器：函数体内可以用 `yield` 逐块产出数据。
2. `this.client.chat.completions.create({ stream: true })` 返回 SDK 内置的异步迭代流。
3. 每收到一个 chunk，提取 `delta.content` 并 `yield` 一个 `text_delta` 类型的 `StreamChunk`。
4. 所有 chunk 消费完毕后 `yield { type: 'done' }` 通知下游。
5. 异常捕获后 `yield { type: 'error', error: message }` 代替抛出，保持流的完整性。

---

## 5. 主进程增量二：Chat 服务

### 5.1 文件 `electron/services/agent/chat.service.ts`

文件导读：
- 技术栈：Node.js `fs` + Electron `app.getPath` + TypeScript 类/接口。
- 作用：管理 Provider 生命周期、消息历史、持久化配置。
- 关系：被 `chat.ipc.ts` 调用。

关键设计：

1. **消息历史**：`private messages: ChatMessage[]` 保存当前会话所有消息。每次 `sendMessage` 先 push 用户消息，流式完成后 push 助手回复。这样后续对话自动携带上下文。

2. **回调模式**：`sendMessage` 接收 `ChatCallbacks` 对象：
   ```ts
   interface ChatCallbacks {
     onToken: (token: string) => void
     onComplete: (fullText: string) => void
     onError: (error: string) => void
   }
   ```
   IPC 层将这三个回调绑定到 `webContents.send`，实现主进程 → 渲染进程的事件推送。

3. **配置持久化**：启动时从 `app.getPath('userData')` 读取 JSON，保存时写回。

---

## 6. 主进程增量三：Chat IPC

### 6.1 文件 `electron/ipc/chat.ipc.ts`

文件导读：
- 技术栈：Electron `ipcMain.handle` + `BrowserWindow.fromWebContents`。
- 作用：注册 4 个 IPC 通道。
- 核心模式：`chat:send-message` 是"请求-推送"混合模式。

关键代码：

```ts
ipcMain.handle('chat:send-message', async (event, message: string) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return

  const safeSend = (channel: string, data: Record<string, unknown>): void => {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, data)
    }
  }

  await chatService.sendMessage(message, {
    onToken(token) { safeSend('chat:stream', { token }) },
    onComplete(fullText) { safeSend('chat:complete', { message: fullText }) },
    onError(error) { safeSend('chat:error', { error }) }
  })
})
```

解释：
1. `ipcMain.handle` 接收 `invoke` 请求。
2. 通过 `event.sender` 反查所属窗口。
3. `safeSend` 在推送前检查窗口是否销毁，防止竞态崩溃。
4. `onToken` 每收到一个 token 就推送一次 `chat:stream` 事件。

### 6.2 IPC 模式对比

| IPC 模式 | Day 2\~3 终端/文件系统 | Day 4 Chat |
|----------|----------------------|------------|
| 方向 | 渲染 → 主（request-response） | 渲染 → 主（invoke）+ 主 → 渲染（push） |
| 返回 | Promise 结果 | invoke 无返回值，数据通过事件流推送 |
| 适用 | 一次性操作 | 长时间流式操作 |

---

## 7. 预加载层扩展

### 7.1 文件 `electron/preload.ts`

Day 4 关键新增：

```ts
// 请求-响应式 API
sendChatMessage: (message: string) => ipcRenderer.invoke('chat:send-message', message),
getChatSettings: () => ipcRenderer.invoke('chat:get-settings'),
updateChatSettings: (config) => ipcRenderer.invoke('chat:update-settings', config),
clearChat: () => ipcRenderer.invoke('chat:clear'),

// 事件监听式 API（返回取消订阅函数）
onChatStream: (callback) => {
  const handler = (_event, data) => callback(data)
  ipcRenderer.on('chat:stream', handler)
  return () => { ipcRenderer.removeListener('chat:stream', handler) }
},
```

设计要点：
1. `on` 系列方法返回 `() => void` 取消订阅函数，便于 React `useEffect` cleanup。
2. 渲染层只看到类型安全的函数签名，不接触 `ipcRenderer` 低层 API。

---

## 8. 渲染层增量一：Chat 状态管理

### 8.1 文件 `src/stores/chat.store.ts`

关键状态与动作：

```ts
interface ChatState {
  messages: ChatMessageData[]
  isStreaming: boolean
  currentStreamText: string
  sendMessage: (content: string) => Promise<void>
  appendToken: (token: string) => void
  handleComplete: (fullText: string) => void
  handleError: (error: string) => void
  newConversation: () => void
}
```

流程：
1. `sendMessage` 同时创建 user 和 streaming assistant 两条消息，然后 invoke IPC。
2. 事件监听 Hook 收到 `chat:stream` 后调用 `appendToken`，逐 token 更新最后一条 assistant 消息。
3. 收到 `chat:complete` 后调用 `handleComplete`，固定最终文本并关闭 streaming 标志。
4. 收到 `chat:error` 后调用 `handleError`，写入错误文本。

### 8.2 文件 `src/hooks/useChat.ts`

作用：在组件挂载时注册事件监听，卸载时自动解注册（通过 `useEffect` cleanup）。
关键点：监听回调里用 `useChatStore.getState()` 获取最新 state 引用，避免闭包过期。

---

## 9. 渲染层增量二：Chat 组件

### 9.1 文件 `src/components/chat/ChatPanel.tsx`

结构：
- 顶部栏：标题 + 新建对话/设置按钮。
- 消息列表：遍历 `messages`，自动滚动到底部。
- 流式指示器：`isStreaming` 时显示旋转图标。
- 输入框：委托给 `ChatInput`。

### 9.2 文件 `src/components/chat/ChatInput.tsx`

特性：
- Enter 发送、Shift+Enter 换行。
- `textarea` 自动高度调节（最大 160px）。
- 流式输出期间禁止输入。

### 9.3 文件 `src/components/chat/ChatMessage.tsx`

渲染规则：
- 用户消息右对齐 + 蓝色 User 头像。
- 助手消息左对齐 + 灰色 Bot 头像。
- `isStreaming` 时尾部显示闪烁光标。
- 系统消息居中灰色展示。

---

## 10. 布局集成

### 10.1 文件 `src/stores/editor.store.ts`

新增状态：`isChatOpen: boolean` + `setChatOpen`。

### 10.2 文件 `src/components/layout/AppLayout.tsx`

关键变更：
1. 活动栏聊天图标绑定 `setChatOpen(!isChatOpen)`，点击切换 Chat 面板。
2. 主工作区右侧条件渲染 `<ChatPanel />`（通过 `PanelGroup` 嵌入，可拖拽调整宽度）。
3. 打开 Chat 时主工作区 `defaultSize` 从 80 减至 55。

---

## 11. Day 4 必学知识点（零基础展开）

### 11.1 流式输出为什么重要
1. LLM 生成速度通常为每秒 20\~80 token。
2. 等整条回复生成完毕再返回，用户可能等待 5\~30 秒无反馈。
3. 流式输出让用户即刻看到文字出现，体验显著提升。

### 11.2 AsyncIterable 与 async generator
```ts
async function* myGenerator(): AsyncIterable<string> {
  yield 'hello'
  yield 'world'
}

for await (const chunk of myGenerator()) {
  console.log(chunk)
}
```
1. `async function*` 声明异步生成器，可在内部 `await` 异步操作后 `yield` 值。
2. `for await...of` 消费异步迭代器，每次 `yield` 暂停生成器，消费方拿到值后继续。
3. 这是 TypeScript/JavaScript 处理流式数据的原生抽象。

### 11.3 IPC 推送模式 vs 请求-响应模式
- **请求-响应**（`invoke` + `handle`）：适合一次性操作，如读文件、获取设置。
- **事件推送**（`webContents.send` + `ipcRenderer.on`）：适合持续数据流，如流式输出、文件变更通知。
- Day 4 的 Chat 使用混合模式：`invoke` 发起请求，`on` 接收流式数据。

### 11.4 为什么 API Key 不能放在渲染进程
1. 渲染进程本质是浏览器环境，容易通过 DevTools 提取。
2. 主进程是 Node.js 环境，配置文件存在系统目录，普通操作不可见。
3. preload 白名单确保渲染层只能"发消息"，无法读取或篡改 Key。

### 11.5 Day 4 在 Agent 路线图中的位置
Day 4 完成了"人 → LLM"的单向对话通道。后续：
- Day 5 将引入工具定义与 Function Calling，实现"LLM → 工具 → LLM"循环。
- Day 6 将组装完整 Agent Loop，实现自主多轮推理。

---

## 12. 完整运行流程追踪（发送消息到流式渲染）

场景：用户在 Chat 输入 "Hello" 并按回车。

### 12.1 渲染层发起请求
1. `ChatInput.handleSend` 取输入值 `"Hello"`。
2. 调用 `useChat().sendMessage("Hello")`。
3. `chatStore.sendMessage` 创建 user + streaming assistant 消息条目。
4. 调用 `window.api.sendChatMessage("Hello")`。

### 12.2 preload 转发
```ts
sendChatMessage: (message) => ipcRenderer.invoke('chat:send-message', message)
```

### 12.3 主进程处理
1. `chat.ipc.ts` 接收请求。
2. 调用 `chatService.sendMessage("Hello", callbacks)`。
3. `chatService` 将消息加入历史，调用 `provider.chat()`。
4. `openai.provider.ts` 发起 OpenAI API 流式请求。

### 12.4 流式 token 推送
1. OpenAI SDK 异步迭代器产出 chunk。
2. `chatService` 的 `for await` 循环读取并调用 `callbacks.onToken(token)`。
3. `chat.ipc.ts` 的 `onToken` 回调执行 `safeSend('chat:stream', { token })`。
4. 主进程通过 `webContents.send` 推送事件到渲染进程。

### 12.5 渲染层接收 & 更新
1. `useChat` Hook 中 `window.api.onChatStream` 的回调被触发。
2. 调用 `chatStore.appendToken(data.token)`。
3. Zustand 更新 `currentStreamText` 和最后一条 assistant 消息的 `content`。
4. `ChatMessage` 组件重新渲染，文字逐字出现，尾部闪烁光标。

### 12.6 流结束
1. `chatService` 收到 `{ type: 'done' }` chunk，调用 `callbacks.onComplete(fullText)`。
2. 主进程推送 `chat:complete` 事件。
3. 渲染层 `handleComplete` 关闭 streaming 标志，光标消失。

---

## 13. 验证清单

启动后请按顺序检查：

1. 点击活动栏 💬 图标，Chat 面板在右侧弹出/收起。
2. 未配置 Provider 时发送消息，应显示错误"未配置 LLM Provider"。
3. 在 DevTools Console 执行 `updateChatSettings` 配置 API Key。
4. 发送消息后，助手回复以流式方式逐字显示。
5. 发送第二条消息，验证多轮对话上下文保持。
6. 点击"新建对话"按钮，消息列表清空。
7. 文件树、Monaco 编辑器、终端功能不受影响。

---

## 14. 常见问题

### 14.1 发送后无响应
1. 确认已通过 `updateChatSettings` 设置了有效的 API Key。
2. 检查 DevTools Console 是否有网络错误。
3. 确认 `baseURL` 是否正确（OpenAI 默认为 `https://api.openai.com/v1`）。

### 14.2 配置丢失
- 配置持久化到 `%APPDATA%/my-agent-ide-day4/chat-settings.json`。
- 如果路径不存在，重新执行 `updateChatSettings`。

### 14.3 使用国产模型 / 本地模型
只需修改 `baseURL` 和 `model`：
```js
window.api.updateChatSettings({
  apiKey: 'sk-xxx',
  baseURL: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat'
})
```

---

## 15. 下一步（Day 5 预告）

Day 5 将进入 Agent 工具与 Function Calling 阶段：
1. 引入 `ToolRegistry` 注册工具。
2. 实现只读工具（`read_file`、`list_files`、`search`）。
3. 让模型通过 Function Calling 自主选择并调用工具。

此时你已经具备：
- 可浏览工作区、打开文件、执行命令
- 可与 LLM 实时流式对话

这两者组合起来，就是 Agent 自主操作的输入/输出基座。
