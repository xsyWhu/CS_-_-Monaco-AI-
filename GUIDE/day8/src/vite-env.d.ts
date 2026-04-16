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

// Chat 消息类型（Day 4+）
interface ChatMessageData {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  timestamp: number
  isStreaming?: boolean
  toolCalls?: ToolCallInfo[]
}

// 工具调用展示信息（Day 5+）
interface ToolCallInfo {
  id: string
  name: string
  args: string
  status: "running" | "completed" | "error"
  result?: string
}

// Git 类型（Day 7 新增）
interface GitFileStatus {
  path: string
  index: string
  working_dir: string
}

// Day 8: 文件变更信息（Inline Diff 使用）
interface FileChangeInfo {
  filePath: string
  oldContent: string
  newContent: string
  toolName: string
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

interface RendererApi {
  // Day 2~3
  runCommand: (command: string) => Promise<TerminalCommandResult>
  getFileTree: () => Promise<WorkspaceTreeResult>
  readFile: (filePath: string) => Promise<string>

  // Chat (Day 4~6)
  sendChatMessage: (message: string, workspacePath: string) => Promise<void>
  abortChat: () => Promise<void>
  getChatSettings: () => Promise<{ apiKey: string; baseURL: string; model: string } | null>
  updateChatSettings: (config: { apiKey: string; baseURL: string; model: string }) => Promise<void>
  clearChat: () => Promise<void>
  onChatStream: (callback: (data: { token: string }) => void) => () => void
  onChatComplete: (callback: (data: { message: string }) => void) => () => void
  onChatError: (callback: (data: { error: string }) => void) => () => void
  onChatToolCall: (callback: (data: { id: string; name: string; args: string }) => void) => () => void
  onChatToolResult: (callback: (data: { id: string; name: string; result: string; isError: boolean }) => void) => () => void
  onChatThinking: (callback: () => void) => () => void
  onChatIteration: (callback: (data: { current: number; max: number }) => void) => () => void

  // Day 8: Inline Diff
  onChatFileChange: (callback: (data: FileChangeInfo) => void) => () => void
  revertFileChange: (filePath: string, oldContent: string) => Promise<void>

  // Git (Day 7 新增)
  gitStatus: (repoPath: string) => Promise<GitStatus>
  gitDiff: (repoPath: string, filePath?: string) => Promise<string>
  gitAdd: (repoPath: string, files: string[]) => Promise<void>
  gitCommit: (repoPath: string, message: string) => Promise<string>
  gitBranches: (repoPath: string) => Promise<GitBranch[]>
  gitCheckout: (repoPath: string, branch: string) => Promise<void>
  gitLog: (repoPath: string, maxCount?: number) => Promise<GitLogEntry[]>
}

declare global {
  interface Window {
    api: RendererApi
  }
}