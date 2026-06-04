import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

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
  readDirectory(dirPath: string): Promise<unknown[]>
  createDirectory(dirPath: string): Promise<void>
  getFileStats(filePath: string): Promise<unknown>
  watchDirectory(dirPath: string): Promise<string>
  unwatchDirectory(dirPath: string): Promise<void>
  selectDirectory(): Promise<string | null>
  selectFile(): Promise<string | null>
  getTempDir(): Promise<string>

  // Terminal
  createTerminal(options?: { cwd?: string; shell?: string }): Promise<{ id: string }>
  writeTerminal(id: string, data: string): Promise<void>
  resizeTerminal(id: string, cols: number, rows: number): Promise<void>
  closeTerminal(id: string): Promise<void>

  // Debug
  startDebug(sourceFile: string, breakpoints: { filePath: string; line: number }[]): Promise<unknown>
  stopDebug(): Promise<void>
  continueDebug(): Promise<void>
  stepOverDebug(): Promise<void>
  stepIntoDebug(): Promise<void>
  stepOutDebug(): Promise<void>
  pauseDebug(): Promise<void>
  toggleDebugBreakpoint(filePath: string, line: number): Promise<unknown>
  setDebugBreakpoints(breakpoints: { filePath: string; line: number }[]): Promise<unknown>

  // Git
  gitStatus(repoPath: string): Promise<unknown>
  gitDiff(repoPath: string, filePath?: string): Promise<string>
  gitFileAtHead(repoPath: string, filePath: string): Promise<string>
  gitAdd(repoPath: string, files: string[]): Promise<void>
  gitUnstage(repoPath: string, files: string[]): Promise<void>
  gitDiscard(repoPath: string, files: string[]): Promise<void>
  gitCommit(repoPath: string, message: string): Promise<string>
  gitBranches(repoPath: string): Promise<unknown[]>
  gitCheckout(repoPath: string, branch: string): Promise<void>
  gitPull(repoPath: string): Promise<void>
  gitPush(repoPath: string): Promise<void>
  gitLog(repoPath: string, maxCount?: number): Promise<unknown[]>

  // Search
  searchFiles(rootPath: string, query: string, options?: object): Promise<unknown[]>
  searchFileNames(rootPath: string, pattern: string): Promise<unknown[]>

  // Agent
  sendMessage(message: string, conversationId?: string, workspacePath?: string): Promise<string>
  cancelAgent(conversationId: string): Promise<void>
  getConversations(): Promise<unknown[]>
  getConversation(conversationId: string): Promise<unknown>
  deleteConversation(conversationId: string): Promise<void>
  getSettings(): Promise<unknown>
  updateSettings(settings: object): Promise<void>

  // Event listeners
  onFileChanged(callback: (event: string, filePath: string) => void): () => void
  onTerminalData(callback: (data: { id: string; data: string }) => void): () => void
  onAgentStream(callback: (data: { conversationId: string; token: string }) => void): () => void
  onAgentToolCall(
    callback: (data: { conversationId: string; toolCall: unknown }) => void,
  ): () => void
  onAgentTextReplace(
    callback: (data: { conversationId: string; text: string }) => void,
  ): () => void
  onAgentComplete(callback: (data: { conversationId: string; message: unknown }) => void): () => void
  onAgentError(callback: (data: { conversationId: string; error: string }) => void): () => void
  onAppRequestClose(callback: () => void): () => void
}

const api: ElectronAPI = {
  // Window / Dialog
  showConfirm: (message: string) => ipcRenderer.invoke('dialog:confirm', message),
  showUnsavedChangesDialog: (fileName: string) =>
    ipcRenderer.invoke('dialog:unsavedChanges', fileName),
  confirmClose: () => ipcRenderer.invoke('app:confirmClose'),

  // File system
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('fs:writeFile', filePath, content),
  deleteFile: (filePath) => ipcRenderer.invoke('fs:deleteFile', filePath),
  renameFile: (oldPath, newPath) => ipcRenderer.invoke('fs:renameFile', oldPath, newPath),
  readDirectory: (dirPath) => ipcRenderer.invoke('fs:readDirectory', dirPath),
  createDirectory: (dirPath) => ipcRenderer.invoke('fs:createDirectory', dirPath),
  getFileStats: (filePath) => ipcRenderer.invoke('fs:getFileStats', filePath),
  watchDirectory: (dirPath) => ipcRenderer.invoke('fs:watchDirectory', dirPath),
  unwatchDirectory: (dirPath) => ipcRenderer.invoke('fs:unwatchDirectory', dirPath),
  selectDirectory: () => ipcRenderer.invoke('fs:selectDirectory'),
  selectFile: () => ipcRenderer.invoke('fs:selectFile'),
  getTempDir: () => ipcRenderer.invoke('fs:getTempDir'),

  // Terminal
  createTerminal: (options?) => ipcRenderer.invoke('terminal:create', options),
  writeTerminal: (id, data) => ipcRenderer.invoke('terminal:write', id, data),
  resizeTerminal: (id, cols, rows) => ipcRenderer.invoke('terminal:resize', id, cols, rows),
  closeTerminal: (id) => ipcRenderer.invoke('terminal:close', id),

  // Debug
  startDebug: (sourceFile, breakpoints) => ipcRenderer.invoke('debug:start', sourceFile, breakpoints),
  stopDebug: () => ipcRenderer.invoke('debug:stop'),
  continueDebug: () => ipcRenderer.invoke('debug:continue'),
  stepOverDebug: () => ipcRenderer.invoke('debug:stepOver'),
  stepIntoDebug: () => ipcRenderer.invoke('debug:stepInto'),
  stepOutDebug: () => ipcRenderer.invoke('debug:stepOut'),
  pauseDebug: () => ipcRenderer.invoke('debug:pause'),
  toggleDebugBreakpoint: (filePath, line) =>
    ipcRenderer.invoke('debug:toggleBreakpoint', filePath, line),
  setDebugBreakpoints: (breakpoints) => ipcRenderer.invoke('debug:setBreakpoints', breakpoints),

  // Git
  gitStatus: (repoPath) => ipcRenderer.invoke('git:status', repoPath),
  gitDiff: (repoPath, filePath?) => ipcRenderer.invoke('git:diff', repoPath, filePath),
  gitFileAtHead: (repoPath, filePath) => ipcRenderer.invoke('git:fileAtHead', repoPath, filePath),
  gitAdd: (repoPath, files) => ipcRenderer.invoke('git:add', repoPath, files),
  gitUnstage: (repoPath, files) => ipcRenderer.invoke('git:unstage', repoPath, files),
  gitDiscard: (repoPath, files) => ipcRenderer.invoke('git:discard', repoPath, files),
  gitCommit: (repoPath, message) => ipcRenderer.invoke('git:commit', repoPath, message),
  gitBranches: (repoPath) => ipcRenderer.invoke('git:branches', repoPath),
  gitCheckout: (repoPath, branch) => ipcRenderer.invoke('git:checkout', repoPath, branch),
  gitPull: (repoPath) => ipcRenderer.invoke('git:pull', repoPath),
  gitPush: (repoPath) => ipcRenderer.invoke('git:push', repoPath),
  gitLog: (repoPath, maxCount?) => ipcRenderer.invoke('git:log', repoPath, maxCount),

  // Search
  searchFiles: (rootPath, query, options?) =>
    ipcRenderer.invoke('search:files', rootPath, query, options),
  searchFileNames: (rootPath, pattern) =>
    ipcRenderer.invoke('search:fileNames', rootPath, pattern),

  // Agent
  sendMessage: (message, conversationId?, workspacePath?) =>
    ipcRenderer.invoke('agent:sendMessage', message, conversationId, workspacePath),
  cancelAgent: (conversationId) => ipcRenderer.invoke('agent:cancel', conversationId),
  getConversations: () => ipcRenderer.invoke('agent:getConversations'),
  getConversation: (conversationId) => ipcRenderer.invoke('agent:getConversation', conversationId),
  deleteConversation: (conversationId) => ipcRenderer.invoke('agent:deleteConversation', conversationId),
  getSettings: () => ipcRenderer.invoke('agent:getSettings'),
  updateSettings: (settings) => ipcRenderer.invoke('agent:updateSettings', settings),

  // Event listeners
  onFileChanged: (callback) => {
    const handler = (_event: IpcRendererEvent, eventType: string, filePath: string): void => {
      callback(eventType, filePath)
    }
    ipcRenderer.on('fs:fileChanged', handler)
    return () => {
      ipcRenderer.removeListener('fs:fileChanged', handler)
    }
  },

  onTerminalData: (callback) => {
    const handler = (_event: IpcRendererEvent, data: { id: string; data: string }): void => {
      callback(data)
    }
    ipcRenderer.on('terminal:data', handler)
    return () => {
      ipcRenderer.removeListener('terminal:data', handler)
    }
  },

  onDebugState: (callback) => {
    const handler = (_event: IpcRendererEvent, state: unknown): void => {
      callback(state as never)
    }
    ipcRenderer.on('debug:state', handler)
    return () => {
      ipcRenderer.removeListener('debug:state', handler)
    }
  },

  onDebugOutput: (callback) => {
    const handler = (_event: IpcRendererEvent, lines: unknown): void => {
      callback(lines as never)
    }
    ipcRenderer.on('debug:output', handler)
    return () => {
      ipcRenderer.removeListener('debug:output', handler)
    }
  },

  onDebugLocation: (callback) => {
    const handler = (_event: IpcRendererEvent, location: unknown): void => {
      callback(location as never)
    }
    ipcRenderer.on('debug:location', handler)
    return () => {
      ipcRenderer.removeListener('debug:location', handler)
    }
  },

  onAgentStream: (callback) => {
    const handler = (
      _event: IpcRendererEvent,
      data: { conversationId: string; token: string },
    ): void => {
      callback(data)
    }
    ipcRenderer.on('agent:stream', handler)
    return () => {
      ipcRenderer.removeListener('agent:stream', handler)
    }
  },

  onAgentToolCall: (callback) => {
    const handler = (
      _event: IpcRendererEvent,
      data: { conversationId: string; toolCall: unknown },
    ): void => {
      callback(data)
    }
    ipcRenderer.on('agent:toolCall', handler)
    return () => {
      ipcRenderer.removeListener('agent:toolCall', handler)
    }
  },

  onAgentTextReplace: (callback) => {
    const handler = (
      _event: IpcRendererEvent,
      data: { conversationId: string; text: string },
    ): void => {
      callback(data)
    }
    ipcRenderer.on('agent:textReplace', handler)
    return () => {
      ipcRenderer.removeListener('agent:textReplace', handler)
    }
  },

  onAgentComplete: (callback) => {
    const handler = (
      _event: IpcRendererEvent,
      data: { conversationId: string; message: unknown },
    ): void => {
      callback(data)
    }
    ipcRenderer.on('agent:complete', handler)
    return () => {
      ipcRenderer.removeListener('agent:complete', handler)
    }
  },

  onAgentError: (callback) => {
    const handler = (
      _event: IpcRendererEvent,
      data: { conversationId: string; error: string },
    ): void => {
      callback(data)
    }
    ipcRenderer.on('agent:error', handler)
    return () => {
      ipcRenderer.removeListener('agent:error', handler)
    }
  },

  onAppRequestClose: (callback) => {
    const handler = (): void => {
      callback()
    }
    ipcRenderer.on('app:requestClose', handler)
    return () => {
      ipcRenderer.removeListener('app:requestClose', handler)
    }
  },
}

contextBridge.exposeInMainWorld('api', api)
