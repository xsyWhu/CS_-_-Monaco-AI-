import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron"
import { electronAPI } from "@electron-toolkit/preload"

// Day 5: 在 Day 4 基础上新增工具调用事件监听。
const api = {
  // ── Day 2~3 保留 ──
  runCommand: (command: string) => ipcRenderer.invoke("terminal:run-command", command),
  getFileTree: () => ipcRenderer.invoke("file-system:get-tree"),
  readFile: (filePath: string) => ipcRenderer.invoke("file-system:read-file", filePath),

  // ── Day 4~5: Chat ──
  // Day 5: sendChatMessage 新增 workspacePath 参数，用于工具执行上下文。
  sendChatMessage: (message: string, workspacePath: string) =>
    ipcRenderer.invoke("chat:send-message", message, workspacePath),
  getChatSettings: () => ipcRenderer.invoke("chat:get-settings"),
  updateChatSettings: (config: { apiKey: string; baseURL: string; model: string }) =>
    ipcRenderer.invoke("chat:update-settings", config),
  clearChat: () => ipcRenderer.invoke("chat:clear"),

  // 监听流式文本 token。
  onChatStream: (callback: (data: { token: string }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { token: string }) => callback(data)
    ipcRenderer.on("chat:stream", handler)
    return () => { ipcRenderer.removeListener("chat:stream", handler) }
  },
  // 监听对话完成事件。
  onChatComplete: (callback: (data: { message: string }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { message: string }) => callback(data)
    ipcRenderer.on("chat:complete", handler)
    return () => { ipcRenderer.removeListener("chat:complete", handler) }
  },
  // 监听对话错误事件。
  onChatError: (callback: (data: { error: string }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { error: string }) => callback(data)
    ipcRenderer.on("chat:error", handler)
    return () => { ipcRenderer.removeListener("chat:error", handler) }
  },
  // Day 5 新增：监听工具调用开始事件（id/name/args）。
  onChatToolCall: (callback: (data: { id: string; name: string; args: string }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { id: string; name: string; args: string }) =>
      callback(data)
    ipcRenderer.on("chat:tool-call", handler)
    return () => { ipcRenderer.removeListener("chat:tool-call", handler) }
  },
  // Day 5 新增：监听工具执行结果事件（id/result/isError）。
  onChatToolResult: (callback: (data: { id: string; result: string; isError: boolean }) => void) => {
    const handler = (
      _event: IpcRendererEvent,
      data: { id: string; result: string; isError: boolean },
    ) => callback(data)
    ipcRenderer.on("chat:tool-result", handler)
    return () => { ipcRenderer.removeListener("chat:tool-result", handler) }
  },
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