import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron"
import { electronAPI } from "@electron-toolkit/preload"

// Day 8: 在 Day 7 基础上新增 Inline Diff 相关 API。
const api = {
  // Day 2~3
  runCommand: (command: string) => ipcRenderer.invoke("terminal:run-command", command),
  getFileTree: () => ipcRenderer.invoke("file-system:get-tree"),
  readFile: (filePath: string) => ipcRenderer.invoke("file-system:read-file", filePath),

  // Chat (Day 4~6)
  sendChatMessage: (message: string, workspacePath: string) =>
    ipcRenderer.invoke("chat:send-message", message, workspacePath),
  abortChat: () => ipcRenderer.invoke("chat:abort"),
  getChatSettings: () => ipcRenderer.invoke("chat:get-settings"),
  updateChatSettings: (config: { apiKey: string; baseURL: string; model: string }) =>
    ipcRenderer.invoke("chat:update-settings", config),
  clearChat: () => ipcRenderer.invoke("chat:clear"),

  onChatStream: (callback: (data: { token: string }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { token: string }) => callback(data)
    ipcRenderer.on("chat:stream", handler)
    return () => { ipcRenderer.removeListener("chat:stream", handler) }
  },
  onChatComplete: (callback: (data: { message: string }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { message: string }) => callback(data)
    ipcRenderer.on("chat:complete", handler)
    return () => { ipcRenderer.removeListener("chat:complete", handler) }
  },
  onChatError: (callback: (data: { error: string }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { error: string }) => callback(data)
    ipcRenderer.on("chat:error", handler)
    return () => { ipcRenderer.removeListener("chat:error", handler) }
  },
  onChatToolCall: (callback: (data: { id: string; name: string; args: string }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { id: string; name: string; args: string }) =>
      callback(data)
    ipcRenderer.on("chat:tool-call", handler)
    return () => { ipcRenderer.removeListener("chat:tool-call", handler) }
  },
  onChatToolResult: (callback: (data: { id: string; name: string; result: string; isError: boolean }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { id: string; name: string; result: string; isError: boolean }) =>
      callback(data)
    ipcRenderer.on("chat:tool-result", handler)
    return () => { ipcRenderer.removeListener("chat:tool-result", handler) }
  },
  onChatThinking: (callback: () => void) => {
    const handler = (_event: IpcRendererEvent) => callback()
    ipcRenderer.on("chat:thinking", handler)
    return () => { ipcRenderer.removeListener("chat:thinking", handler) }
  },
  onChatIteration: (callback: (data: { current: number; max: number }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { current: number; max: number }) =>
      callback(data)
    ipcRenderer.on("chat:iteration", handler)
    return () => { ipcRenderer.removeListener("chat:iteration", handler) }
  },

  // Day 8: Inline Diff 文件变更事件。
  onChatFileChange: (callback: (data: { filePath: string; oldContent: string; newContent: string; toolName: string }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { filePath: string; oldContent: string; newContent: string; toolName: string }) =>
      callback(data)
    ipcRenderer.on("chat:file-change", handler)
    return () => { ipcRenderer.removeListener("chat:file-change", handler) }
  },
  // Day 8: 用户拒绝变更时恢复文件。
  revertFileChange: (filePath: string, oldContent: string) =>
    ipcRenderer.invoke("chat:revert-file", filePath, oldContent),

  // Git (Day 7 新增)
  gitStatus: (repoPath: string) => ipcRenderer.invoke("git:status", repoPath),
  gitDiff: (repoPath: string, filePath?: string) => ipcRenderer.invoke("git:diff", repoPath, filePath),
  gitAdd: (repoPath: string, files: string[]) => ipcRenderer.invoke("git:add", repoPath, files),
  gitCommit: (repoPath: string, message: string) => ipcRenderer.invoke("git:commit", repoPath, message),
  gitBranches: (repoPath: string) => ipcRenderer.invoke("git:branches", repoPath),
  gitCheckout: (repoPath: string, branch: string) => ipcRenderer.invoke("git:checkout", repoPath, branch),
  gitLog: (repoPath: string, maxCount?: number) => ipcRenderer.invoke("git:log", repoPath, maxCount),
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI)
    contextBridge.exposeInMainWorld("api", api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}