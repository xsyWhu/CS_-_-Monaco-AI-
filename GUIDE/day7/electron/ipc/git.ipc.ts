/**
 * Day 7: Git IPC 处理器——注册所有 git:* 频道。
 */

import { ipcMain, type IpcMainInvokeEvent } from "electron"
import GitService from "../services/git.service"

const gitService = new GitService()

export function registerGitIpcHandlers(): void {
  ipcMain.removeHandler("git:status")
  ipcMain.removeHandler("git:diff")
  ipcMain.removeHandler("git:add")
  ipcMain.removeHandler("git:commit")
  ipcMain.removeHandler("git:branches")
  ipcMain.removeHandler("git:checkout")
  ipcMain.removeHandler("git:log")

  ipcMain.handle("git:status", (_event: IpcMainInvokeEvent, repoPath: string) =>
    gitService.status(repoPath),
  )

  ipcMain.handle(
    "git:diff",
    (_event: IpcMainInvokeEvent, repoPath: string, filePath?: string) =>
      gitService.diff(repoPath, filePath),
  )

  ipcMain.handle(
    "git:add",
    (_event: IpcMainInvokeEvent, repoPath: string, files: string[]) =>
      gitService.add(repoPath, files),
  )

  ipcMain.handle(
    "git:commit",
    (_event: IpcMainInvokeEvent, repoPath: string, message: string) =>
      gitService.commit(repoPath, message),
  )

  ipcMain.handle("git:branches", (_event: IpcMainInvokeEvent, repoPath: string) =>
    gitService.branches(repoPath),
  )

  ipcMain.handle(
    "git:checkout",
    (_event: IpcMainInvokeEvent, repoPath: string, branch: string) =>
      gitService.checkout(repoPath, branch),
  )

  ipcMain.handle(
    "git:log",
    (_event: IpcMainInvokeEvent, repoPath: string, maxCount?: number) =>
      gitService.log(repoPath, maxCount),
  )
}
