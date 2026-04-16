import { ipcMain } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export function registerTerminalIpcHandlers(): void {
  // 防止开发期热重载时重复注册同一通道。
  ipcMain.removeHandler('terminal:run-command')

  ipcMain.handle('terminal:run-command', async (_event, command: string) => {
    if (!command || !command.trim()) {
      return { stdout: '', stderr: '命令为空。', code: 1 }
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: process.cwd(),
        windowsHide: true,
        maxBuffer: 1024 * 1024
      })

      return { stdout, stderr, code: 0 }
    } catch (error) {
      const execError = error as { stdout?: string; stderr?: string; message?: string; code?: number }

      return {
        stdout: execError.stdout ?? '',
        stderr: execError.stderr ?? execError.message ?? '命令执行失败。',
        code: execError.code ?? 1
      }
    }
  })
}
