/**
 * Day 8: Chat IPC 模块（扩展版）。
 *
 * 相较 Day 7 新增：
 * 1. chat:file-change 推送事件 —— 工具修改文件时通知前端（供 Inline Diff 使用）。
 * 2. chat:revert-file 处理器 —— 用户拒绝变更时恢复文件原始内容。
 */

import { ipcMain, BrowserWindow, type IpcMainInvokeEvent } from "electron"
import { writeFileSync } from "fs"
import ChatService from "../services/agent/chat.service"

const chatService = new ChatService()

export function registerChatIpcHandlers(): void {
  ipcMain.removeHandler("chat:send-message")
  ipcMain.removeHandler("chat:abort")
  ipcMain.removeHandler("chat:get-settings")
  ipcMain.removeHandler("chat:update-settings")
  ipcMain.removeHandler("chat:clear")
  ipcMain.removeHandler("chat:revert-file")

  ipcMain.handle(
    "chat:send-message",
    async (event: IpcMainInvokeEvent, message: string, workspacePath: string) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return

      const safeSend = (channel: string, data: Record<string, unknown>): void => {
        if (!win.isDestroyed()) win.webContents.send(channel, data)
      }

      await chatService.sendMessage(message, workspacePath, {
        onToken(token: string) {
          safeSend("chat:stream", { token })
        },
        onThinking() {
          safeSend("chat:thinking", {})
        },
        onComplete(fullText: string) {
          safeSend("chat:complete", { message: fullText })
        },
        onError(error: string) {
          safeSend("chat:error", { error })
        },
        onToolCallStart(info: { id: string; name: string; args: string }) {
          safeSend("chat:tool-call", info)
        },
        onToolCallResult(info: { id: string; name: string; result: string; isError: boolean }) {
          safeSend("chat:tool-result", info)
        },
        onIteration(current: number, max: number) {
          safeSend("chat:iteration", { current, max })
        },
        // Day 8: 文件变更事件推送到渲染进程。
        onFileChange(info: { filePath: string; oldContent: string; newContent: string; toolName: string }) {
          safeSend("chat:file-change", info)
        },
      })
    },
  )

  ipcMain.handle("chat:abort", () => {
    chatService.abort()
  })

  ipcMain.handle("chat:get-settings", () => {
    return chatService.getSettings()
  })

  ipcMain.handle("chat:update-settings", (_event, config: { apiKey: string; baseURL: string; model: string }) => {
    chatService.updateSettings(config)
  })

  ipcMain.handle("chat:clear", () => {
    chatService.clearMessages()
  })

  // Day 8: 用户拒绝变更时恢复文件原始内容。
  ipcMain.handle("chat:revert-file", (_event, filePath: string, content: string) => {
    writeFileSync(filePath, content, "utf-8")
  })
}