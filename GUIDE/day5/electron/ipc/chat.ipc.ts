/**
 * Day 5: Chat IPC 模块（扩展版）。
 *
 * 相较 Day 4，新增：
 * 1. chat:send-message 接收 workspacePath 参数，用于工具执行上下文。
 * 2. 推送 chat:tool-call 事件（工具开始执行时）。
 * 3. 推送 chat:tool-result 事件（工具执行完毕时）。
 */

import { ipcMain, BrowserWindow, type IpcMainInvokeEvent } from "electron"
import ChatService from "../services/agent/chat.service"

const chatService = new ChatService()

export function registerChatIpcHandlers(): void {
  ipcMain.removeHandler("chat:send-message")
  ipcMain.removeHandler("chat:get-settings")
  ipcMain.removeHandler("chat:update-settings")
  ipcMain.removeHandler("chat:clear")

  ipcMain.handle(
    "chat:send-message",
    async (event: IpcMainInvokeEvent, message: string, workspacePath: string) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return

      // 安全发送：推送前检查窗口未销毁。
      const safeSend = (channel: string, data: Record<string, unknown>): void => {
        if (!win.isDestroyed()) {
          win.webContents.send(channel, data)
        }
      }

      await chatService.sendMessage(message, workspacePath, {
        onToken(token: string) {
          safeSend("chat:stream", { token })
        },
        onComplete(fullText: string) {
          safeSend("chat:complete", { message: fullText })
        },
        onError(error: string) {
          safeSend("chat:error", { error })
        },
        // Day 5 新增：通知前端某工具正在执行。
        onToolCall(info: { id: string; name: string; args: string }) {
          safeSend("chat:tool-call", info)
        },
        // Day 5 新增：通知前端工具执行结果。
        onToolResult(info: { id: string; result: string; isError: boolean }) {
          safeSend("chat:tool-result", info)
        },
      })
    },
  )

  ipcMain.handle("chat:get-settings", () => {
    return chatService.getSettings()
  })

  ipcMain.handle("chat:update-settings", (_event, config: { apiKey: string; baseURL: string; model: string }) => {
    chatService.updateSettings(config)
  })

  ipcMain.handle("chat:clear", () => {
    chatService.clearMessages()
  })
}