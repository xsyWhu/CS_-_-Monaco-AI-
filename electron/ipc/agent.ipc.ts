import { ipcMain, BrowserWindow, IpcMainInvokeEvent } from 'electron'
import AgentService from '../services/agent/agent.service'

const agentService = new AgentService()

function getWindowFromEvent(event: IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender)
}

export function registerAgentIPC(): void {
  ipcMain.handle(
    'agent:sendMessage',
    async (event: IpcMainInvokeEvent, message: string, conversationId?: string, workspacePath?: string) => {
      const win = getWindowFromEvent(event)
      if (!win) {
        throw new Error('No window found for this request')
      }

      const send = (channel: string, data: Record<string, unknown>) => {
        if (!win.isDestroyed()) {
          win.webContents.send(channel, data)
        }
      }

      const convId = conversationId ?? undefined
      const { id, error } = agentService.prepareConversation(message, convId)

      console.log(`[Agent] sendMessage → conversation=${id}, workspace="${workspacePath ?? '(none)'}", message="${message.substring(0, 60)}..."`)

      if (error) {
        console.warn(`[Agent] Error: ${error}`)
        send('agent:error', { conversationId: id, error })
        return id
      }

      agentService
        .runConversation(id, {
          onTextDelta(token: string) {
            send('agent:stream', { conversationId: id, token })
          },

          onTextReplace(text: string) {
            send('agent:textReplace', { conversationId: id, text })
          },

          onToolCallStart(toolCall: { id: string; name: string }) {
            send('agent:toolCall', {
              conversationId: id,
              toolCall: { ...toolCall, status: 'running' },
            })
          },

          onToolCallResult(toolCall: { id: string; name: string; result: string }) {
            send('agent:toolCall', {
              conversationId: id,
              toolCall: { ...toolCall, status: 'completed' },
            })
          },

          onComplete(fullResponse: string) {
            console.log(`[Agent] Complete (${fullResponse.length} chars)`)
            send('agent:complete', { conversationId: id, message: fullResponse })
          },

          onError(err: string) {
            console.error(`[Agent] Error: ${err}`)
            send('agent:error', { conversationId: id, error: err })
          },
        }, workspacePath)
        .catch((err) => {
          const errMsg = err instanceof Error ? err.message : String(err)
          console.error(`[Agent] Unhandled: ${errMsg}`)
          send('agent:error', { conversationId: id, error: errMsg })
        })

      return id
    },
  )

  ipcMain.handle('agent:cancel', (_event: IpcMainInvokeEvent, conversationId: string) => {
    return agentService.cancel(conversationId)
  })

  ipcMain.handle('agent:getConversations', () => {
    return agentService.getConversations()
  })

  ipcMain.handle('agent:getConversation', (_event: IpcMainInvokeEvent, conversationId: string) => {
    return agentService.getConversation(conversationId)
  })

  ipcMain.handle('agent:deleteConversation', (_event: IpcMainInvokeEvent, conversationId: string) => {
    agentService.deleteConversation(conversationId)
  })

  ipcMain.handle('agent:getSettings', () => {
    return agentService.getSettings()
  })

  ipcMain.handle('agent:updateSettings', (_event: IpcMainInvokeEvent, settings: object) => {
    console.log('[Agent] Settings updated:', JSON.stringify(settings, null, 2).substring(0, 200))
    return agentService.updateSettings(settings)
  })
}
