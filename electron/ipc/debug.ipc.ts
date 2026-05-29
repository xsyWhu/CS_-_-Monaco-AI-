import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { debugService, type DebugBreakpoint } from '../services/debug.service'

export function registerDebugIPC(): void {
  ipcMain.handle('debug:start', async (event: IpcMainInvokeEvent, sourceFile: string, breakpoints: DebugBreakpoint[]) => {
    return await debugService.start(sourceFile, breakpoints, event.sender)
  })

  ipcMain.handle('debug:stop', async (event: IpcMainInvokeEvent) => {
    debugService.attachSender(event.sender)
    await debugService.stop()
  })

  ipcMain.handle('debug:continue', async (event: IpcMainInvokeEvent) => {
    debugService.attachSender(event.sender)
    await debugService.continue()
  })

  ipcMain.handle('debug:stepOver', async (event: IpcMainInvokeEvent) => {
    debugService.attachSender(event.sender)
    await debugService.stepOver()
  })

  ipcMain.handle('debug:stepInto', async (event: IpcMainInvokeEvent) => {
    debugService.attachSender(event.sender)
    await debugService.stepInto()
  })

  ipcMain.handle('debug:stepOut', async (event: IpcMainInvokeEvent) => {
    debugService.attachSender(event.sender)
    await debugService.stepOut()
  })

  ipcMain.handle('debug:pause', async (event: IpcMainInvokeEvent) => {
    debugService.attachSender(event.sender)
    await debugService.pause()
  })

  ipcMain.handle('debug:toggleBreakpoint', async (event: IpcMainInvokeEvent, filePath: string, line: number) => {
    debugService.attachSender(event.sender)
    return await debugService.toggleBreakpoint(filePath, line)
  })

  ipcMain.handle('debug:setBreakpoints', async (event: IpcMainInvokeEvent, breakpoints: DebugBreakpoint[]) => {
    debugService.attachSender(event.sender)
    return await debugService.setBreakpoints(breakpoints)
  })
}
