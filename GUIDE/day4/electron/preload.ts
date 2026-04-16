import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Day 4: 在文件系统/终端基础上，新增 Chat 对话相关 API。
const api = {
  // ── Day 2~3 保留 ──
  runCommand: (command: string) => ipcRenderer.invoke('terminal:run-command', command),
  getFileTree: () => ipcRenderer.invoke('file-system:get-tree'),
  readFile: (filePath: string) => ipcRenderer.invoke('file-system:read-file', filePath),

  // ── Day 4 新增：Chat ──
  sendChatMessage: (message: string) => ipcRenderer.invoke('chat:send-message', message),
  getChatSettings: () => ipcRenderer.invoke('chat:get-settings'),
  updateChatSettings: (config: { apiKey: string; baseURL: string; model: string }) =>
    ipcRenderer.invoke('chat:update-settings', config),
  clearChat: () => ipcRenderer.invoke('chat:clear'),

  // 监听主进程推送的流式事件，返回取消订阅函数。
  onChatStream: (callback: (data: { token: string }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { token: string }) => callback(data)
    ipcRenderer.on('chat:stream', handler)
    return () => { ipcRenderer.removeListener('chat:stream', handler) }
  },
  onChatComplete: (callback: (data: { message: string }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { message: string }) => callback(data)
    ipcRenderer.on('chat:complete', handler)
    return () => { ipcRenderer.removeListener('chat:complete', handler) }
  },
  onChatError: (callback: (data: { error: string }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { error: string }) => callback(data)
    ipcRenderer.on('chat:error', handler)
    return () => { ipcRenderer.removeListener('chat:error', handler) }
  }
}

if (process.contextIsolated) {
  try {
    // 将 toolkit 提供的安全 API 显式挂载到 window.electron。
    contextBridge.exposeInMainWorld('electron', electronAPI)
    // 将业务 API 挂载到 window.api，后续通过 IPC 能力逐步填充。
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // 仅在关闭 contextIsolation 的兜底场景下直接赋值，正常项目不建议依赖该分支。
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
