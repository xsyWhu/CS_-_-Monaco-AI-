/**
 * Day 4: Chat IPC 模块。
 *
 * 负责注册三个 IPC 通道：
 * 1. chat:send-message — 接收用户消息，触发流式生成，
 *    通过 webContents.send 向渲染进程推送 token/complete/error 事件。
 * 2. chat:get-settings — 读取当前 Provider 配置。
 * 3. chat:update-settings — 更新 Provider 配置。
 * 4. chat:clear — 清空对话历史。
 */

import { ipcMain, BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import ChatService from '../services/agent/chat.service'

const chatService = new ChatService()

export function registerChatIpcHandlers(): void {
  ipcMain.removeHandler('chat:send-message')
  ipcMain.removeHandler('chat:get-settings')
  ipcMain.removeHandler('chat:update-settings')
  ipcMain.removeHandler('chat:clear')

  ipcMain.handle('chat:send-message', async (event: IpcMainInvokeEvent, message: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return

    // 安全发送：检查窗口是否已销毁。
    const safeSend = (channel: string, data: Record<string, unknown>): void => {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, data)
      }
    }

    await chatService.sendMessage(message, {
      onToken(token: string) {
        safeSend('chat:stream', { token })
      },
      onComplete(fullText: string) {
        safeSend('chat:complete', { message: fullText })
      },
      onError(error: string) {
        safeSend('chat:error', { error })
      }
    })
  })

  ipcMain.handle('chat:get-settings', () => {
    return chatService.getSettings()
  })

  ipcMain.handle('chat:update-settings', (_event, config: { apiKey: string; baseURL: string; model: string }) => {
    chatService.updateSettings(config)
  })

  ipcMain.handle('chat:clear', () => {
    chatService.clearMessages()
  })
}
