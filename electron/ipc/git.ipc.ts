import { ipcMain, IpcMainInvokeEvent } from 'electron'
import GitService from '../services/git.service'

const gitService = new GitService()

export function registerGitIPC(): void {
  ipcMain.handle('git:status', (_event: IpcMainInvokeEvent, repoPath: string) => {
    return gitService.status(repoPath)
  })

  ipcMain.handle(
    'git:diff',
    (_event: IpcMainInvokeEvent, repoPath: string, filePath?: string) => {
      return gitService.diff(repoPath, filePath)
    },
  )

  ipcMain.handle(
    'git:fileAtHead',
    (_event: IpcMainInvokeEvent, repoPath: string, filePath: string) => {
      return gitService.fileAtHead(repoPath, filePath)
    },
  )

  ipcMain.handle(
    'git:add',
    (_event: IpcMainInvokeEvent, repoPath: string, files: string[]) => {
      return gitService.add(repoPath, files)
    },
  )

  ipcMain.handle(
    'git:commit',
    (_event: IpcMainInvokeEvent, repoPath: string, message: string) => {
      return gitService.commit(repoPath, message)
    },
  )

  ipcMain.handle('git:branches', (_event: IpcMainInvokeEvent, repoPath: string) => {
    return gitService.branches(repoPath)
  })

  ipcMain.handle(
    'git:checkout',
    (_event: IpcMainInvokeEvent, repoPath: string, branch: string) => {
      return gitService.checkout(repoPath, branch)
    },
  )

  ipcMain.handle(
    'git:log',
    (_event: IpcMainInvokeEvent, repoPath: string, maxCount?: number) => {
      return gitService.log(repoPath, maxCount)
    },
  )
}
