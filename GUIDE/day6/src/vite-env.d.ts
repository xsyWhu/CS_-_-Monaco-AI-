/// <reference types="vite/client" />

declare module "*.css"

interface TerminalCommandResult {
  stdout: string
  stderr: string
  code: number
}

interface FileTreeNode {
  name: string
  path: string
  relativePath: string
  type: "file" | "directory"
  children?: FileTreeNode[]
}

interface WorkspaceTreeResult {
  workspaceRoot: string
  tree: FileTreeNode[]
}

// Chat 消息类型（Day 4+）。
interface ChatMessageData {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  timestamp: number
  isStreaming?: boolean
  toolCalls?: ToolCallInfo[]
}

// 工具调用展示信息（Day 5+）。
interface ToolCallInfo {
  id: string
  name: string
  args: string
  status: "running" | "completed" | "error"
  result?: string
}

interface RendererApi {
  // Day 2~3
  runCommand: (command: string) => Promise<TerminalCommandResult>
  getFileTree: () => Promise<WorkspaceTreeResult>
  readFile: (filePath: string) => Promise<string>

  // Chat
  sendChatMessage: (message: string, workspacePath: string) => Promise<void>
  // Day 6 新增：中断当前 AgentLoop。
  abortChat: () => Promise<void>
  getChatSettings: () => Promise<{ apiKey: string; baseURL: string; model: string } | null>
  updateChatSettings: (config: { apiKey: string; baseURL: string; model: string }) => Promise<void>
  clearChat: () => Promise<void>

  // 事件订阅
  onChatStream: (callback: (data: { token: string }) => void) => () => void
  onChatComplete: (callback: (data: { message: string }) => void) => () => void
  onChatError: (callback: (data: { error: string }) => void) => () => void
  onChatToolCall: (callback: (data: { id: string; name: string; args: string }) => void) => () => void
  onChatToolResult: (callback: (data: { id: string; name: string; result: string; isError: boolean }) => void) => () => void
  // Day 6 新增
  onChatThinking: (callback: () => void) => () => void
  onChatIteration: (callback: (data: { current: number; max: number }) => void) => () => void
}

declare global {
  interface Window {
    api: RendererApi
  }
}