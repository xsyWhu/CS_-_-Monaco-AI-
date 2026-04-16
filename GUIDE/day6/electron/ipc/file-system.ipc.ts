import { ipcMain } from 'electron'
import { FileSystemService } from '../services/file-system.service'

const fileSystemService = new FileSystemService()

export function registerFileSystemIpcHandlers(): void {
  ipcMain.removeHandler('file-system:get-tree')
  ipcMain.removeHandler('file-system:read-file')

  ipcMain.handle('file-system:get-tree', async () => {
    const tree = await fileSystemService.getFileTree()

    return {
      workspaceRoot: fileSystemService.getWorkspaceRoot(),
      tree
    }
  })

  ipcMain.handle('file-system:read-file', async (_event, filePath: string) => {
    return fileSystemService.readTextFile(filePath)
  })
}
