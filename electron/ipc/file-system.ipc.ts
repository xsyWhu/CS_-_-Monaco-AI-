import { ipcMain, dialog, IpcMainInvokeEvent } from 'electron'
import FileSystemService from '../services/file-system.service'

const fileSystemService = new FileSystemService()

export function registerFileSystemIPC(): void {
  ipcMain.handle('fs:readFile', (_event: IpcMainInvokeEvent, filePath: string) => {
    return fileSystemService.readFile(filePath)
  })

  ipcMain.handle(
    'fs:writeFile',
    (_event: IpcMainInvokeEvent, filePath: string, content: string) => {
      return fileSystemService.writeFile(filePath, content)
    },
  )

  ipcMain.handle('fs:deleteFile', (_event: IpcMainInvokeEvent, filePath: string) => {
    return fileSystemService.deleteFile(filePath)
  })

  ipcMain.handle(
    'fs:renameFile',
    (_event: IpcMainInvokeEvent, oldPath: string, newPath: string) => {
      return fileSystemService.renameFile(oldPath, newPath)
    },
  )

  ipcMain.handle('fs:readDirectory', (_event: IpcMainInvokeEvent, dirPath: string) => {
    return fileSystemService.readDirectory(dirPath)
  })

  ipcMain.handle('fs:createDirectory', (_event: IpcMainInvokeEvent, dirPath: string) => {
    return fileSystemService.createDirectory(dirPath)
  })

  ipcMain.handle('fs:getFileStats', (_event: IpcMainInvokeEvent, filePath: string) => {
    return fileSystemService.getFileStats(filePath)
  })

  ipcMain.handle('fs:selectDirectory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0]
  })

  ipcMain.handle('fs:watchDirectory', (event: IpcMainInvokeEvent, dirPath: string) => {
    return fileSystemService.watchDirectory(dirPath, (eventType, filePath) => {
      event.sender.send('fs:fileChanged', eventType, filePath)
    })
  })

  ipcMain.handle('fs:unwatchDirectory', (_event: IpcMainInvokeEvent, dirPath: string) => {
    fileSystemService.unwatchDirectory(dirPath)
  })
}
