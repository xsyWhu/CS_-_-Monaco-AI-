import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Day 2: 暴露最小终端能力，后续会逐步扩展文件与搜索等工具。
const api = {
  runCommand: (command: string) => ipcRenderer.invoke('terminal:run-command', command)
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
