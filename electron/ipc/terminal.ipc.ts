import { ipcMain, IpcMainInvokeEvent } from 'electron'
import TerminalService, { TerminalCreateOptions } from '../services/terminal.service'

const terminalService = new TerminalService()

export function registerTerminalIPC(): void {
  ipcMain.handle('terminal:create', (event: IpcMainInvokeEvent, options?: TerminalCreateOptions) => {
    const { id } = terminalService.create(options)

    terminalService.onData(id, (data: string) => {
      event.sender.send('terminal:data', { id, data })
    })

    return { id }
  })

  ipcMain.handle('terminal:write', (_event: IpcMainInvokeEvent, id: string, data: string) => {
    terminalService.write(id, data)
  })

  ipcMain.handle(
    'terminal:resize',
    (_event: IpcMainInvokeEvent, id: string, cols: number, rows: number) => {
      terminalService.resize(id, cols, rows)
    },
  )

  ipcMain.handle('terminal:close', (_event: IpcMainInvokeEvent, id: string) => {
    terminalService.close(id)
  })
}
