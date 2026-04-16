/**
 * Day 6: Chat IPC 模块（扩展版）。
 *
 * 相较 Day 5 新增：
 * 1. chat:abort  —— 主动中断当前 AgentLoop。
 * 2. chat:thinking 推送事件 —— 模型进入推理阶段时通知前端（"思考中"状态）。
 * 3. chat:iteration 推送事件 —— 当前迭代轮次变化时通知前端（进度展示）。
 * 4. onToolCallStart 回调携带完整 name 字段（Day 5 遗漏）。
 */

import { ipcMain, BrowserWindow, type IpcMainInvokeEvent } from "electron"
import ChatService from "../services/agent/chat.service"

const chatService = new ChatService()

export function registerChatIpcHandlers(): void {
  ipcMain.removeHandler("chat:send-message")
  ipcMain.removeHandler("chat:abort")
  ipcMain.removeHandler("chat:get-settings")
  ipcMain.removeHandler("chat:update-settings")
  ipcMain.removeHandler("chat:clear")

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
}