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

// Day 4~5: Chat 消息类型。
interface ChatMessageData {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  timestamp: number
  isStreaming?: boolean
  // Day 5 新增：关联的工具调用记录（仅 assistant 消息可能有）。
  toolCalls?: ToolCallInfo[]
}

// Day 5 新增：工具调用展示信息。
interface ToolCallInfo {
  id: string
  name: string
  args: string        // JSON 字符串（来自模型生成的参数）
  status: "running" | "completed" | "error"
  result?: string     // 工具执行后填入
}

interface RendererApi {
  // Day 2~3
  runCommand: (command: string) => Promise<TerminalCommandResult>
  getFileTree: () => Promise<WorkspaceTreeResult>
  readFile: (filePath: string) => Promise<string>

  // Day 4~5: Chat
  // Day 5: 新增 workspacePath 参数
  sendChatMessage: (message: string, workspacePath: string) => Promise<void>
  getChatSettings: () => Promise<{ apiKey: string; baseURL: string; model: string } | null>
  updateChatSettings: (config: { apiKey: string; baseURL: string; model: string }) => Promise<void>
  clearChat: () => Promise<void>
  onChatStream: (callback: (data: { token: string }) => void) => () => void
  onChatComplete: (callback: (data: { message: string }) => void) => () => void
  onChatError: (callback: (data: { error: string }) => void) => () => void
  // Day 5 新增
  onChatToolCall: (callback: (data: { id: string; name: string; args: string }) => void) => () => void
  onChatToolResult: (callback: (data: { id: string; result: string; isError: boolean }) => void) => () => void
}

declare global {
  interface Window {
    api: RendererApi
  }
}