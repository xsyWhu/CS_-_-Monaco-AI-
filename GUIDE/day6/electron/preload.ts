import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron"
import { electronAPI } from "@electron-toolkit/preload"

// Day 6: 在 Day 5 基础上新增 thinking/iteration/abort。
const api = {
  // Day 2~3 保留
  runCommand: (command: string) => ipcRenderer.invoke("terminal:run-command", command),
  getFileTree: () => ipcRenderer.invoke("file-system:get-tree"),
  readFile: (filePath: string) => ipcRenderer.invoke("file-system:read-file", filePath),

  // Chat: send / settings / abort / clear
  sendChatMessage: (message: string, workspacePath: string) =>
    ipcRenderer.invoke("chat:send-message", message, workspacePath),
  abortChat: () => ipcRenderer.invoke("chat:abort"),
  getChatSettings: () => ipcRenderer.invoke("chat:get-settings"),
  updateChatSettings: (config: { apiKey: string; baseURL: string; model: string }) =>
    ipcRenderer.invoke("chat:update-settings", config),
  clearChat: () => ipcRenderer.invoke("chat:clear"),

  // 事件订阅（均返回取消订阅函数）
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
    const handler = (
      _event: IpcRendererEvent,
      data: { id: string; name: string; result: string; isError: boolean },
    ) => callback(data)
    ipcRenderer.on("chat:tool-result", handler)
    return () => { ipcRenderer.removeListener("chat:tool-result", handler) }
  },
  // Day 6 新增：模型进入推理阶段（思考中）。
  onChatThinking: (callback: () => void) => {
    const handler = (_event: IpcRendererEvent) => callback()
    ipcRenderer.on("chat:thinking", handler)
    return () => { ipcRenderer.removeListener("chat:thinking", handler) }
  },
  // Day 6 新增：迭代轮次变化。
  onChatIteration: (callback: (data: { current: number; max: number }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { current: number; max: number }) =>
      callback(data)
    ipcRenderer.on("chat:iteration", handler)
    return () => { ipcRenderer.removeListener("chat:iteration", handler) }
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