export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  isFile: boolean
  size: number
  modifiedTime: number
}

export interface FileStats {
  size: number
  isDirectory: boolean
  isFile: boolean
  modifiedTime: number
  createdTime: number
}

export interface SearchResult {
  filePath: string
  line: number
  column: number
  lineContent: string
  matchLength: number
}

export interface FileNameResult {
  filePath: string
  fileName: string
}

export interface GitStatus {
  current: string | null
  tracking: string | null
  ahead: number
  behind: number
  files: Array<{
    path: string
    index: string
    working_dir: string
  }>
  staged: string[]
  modified: string[]
  untracked: string[]
  deleted: string[]
  conflicted: string[]
  renamed: Array<{
    from: string
    to: string
  }>
  isClean: boolean
}

export interface GitBranch {
  name: string
  current: boolean
  commit: string
  label: string
}

export interface GitLogEntry {
  hash: string
  date: string
  message: string
  author: string
  email: string
}

export interface ElectronAPI {
  // Window / Dialog
  showConfirm(message: string): Promise<boolean>
  showUnsavedChangesDialog(fileName: string): Promise<'save' | 'dont_save' | 'cancel'>
  confirmClose(): Promise<void>

  // File system
  readFile(filePath: string): Promise<string>
  writeFile(filePath: string, content: string): Promise<void>
  deleteFile(filePath: string): Promise<void>
  renameFile(oldPath: string, newPath: string): Promise<void>
  readDirectory(dirPath: string): Promise<FileEntry[]>
  createDirectory(dirPath: string): Promise<void>
  getFileStats(filePath: string): Promise<FileStats>
  watchDirectory(dirPath: string): Promise<void>
  unwatchDirectory(dirPath: string): Promise<void>
  selectDirectory(): Promise<string | null>
  selectFile(): Promise<string | null>

  // Terminal
  createTerminal(options?: { cwd?: string; shell?: string }): Promise<{ id: string }>
  writeTerminal(id: string, data: string): Promise<void>
  resizeTerminal(id: string, cols: number, rows: number): Promise<void>
  closeTerminal(id: string): Promise<void>

  // Git
  gitStatus(repoPath: string): Promise<GitStatus>
  gitDiff(repoPath: string, filePath?: string): Promise<string>
  gitFileAtHead(repoPath: string, filePath: string): Promise<string>
  gitAdd(repoPath: string, files: string[]): Promise<void>
  gitCommit(repoPath: string, message: string): Promise<void>
  gitBranches(repoPath: string): Promise<GitBranch[]>
  gitCheckout(repoPath: string, branch: string): Promise<void>
  gitLog(repoPath: string, maxCount?: number): Promise<GitLogEntry[]>

  // Search
  searchFiles(rootPath: string, query: string, options?: {
    maxResults?: number
    caseSensitive?: boolean
    regex?: boolean
    filePattern?: string
  }): Promise<SearchResult[]>
  searchFileNames(rootPath: string, pattern: string): Promise<FileNameResult[]>

  // Agent
  sendMessage(message: string, conversationId?: string, workspacePath?: string): Promise<string>
  cancelAgent(conversationId: string): Promise<void>
  getConversations(): Promise<Array<{ id: string; title: string; createdAt: number; updatedAt: number }>>
  getConversation(conversationId: string): Promise<any>
  deleteConversation(conversationId: string): Promise<void>
  getSettings(): Promise<{ provider: any; workspacePath: string }>
  updateSettings(settings: any): Promise<void>

  // Event listeners (return unsubscribe function)
  onFileChanged(callback: (eventType: string, filePath: string) => void): () => void
  onTerminalData(callback: (data: { id: string; data: string }) => void): () => void
  onAgentStream(callback: (data: { conversationId: string; token: string }) => void): () => void
  onAgentTextReplace(callback: (data: { conversationId: string; text: string }) => void): () => void
  onAgentToolCall(callback: (data: { conversationId: string; toolCall: any }) => void): () => void
  onAgentComplete(callback: (data: { conversationId: string; message: string }) => void): () => void
  onAgentError(callback: (data: { conversationId: string; error: string }) => void): () => void
  onAppRequestClose(callback: () => void): () => void
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}

export {}
