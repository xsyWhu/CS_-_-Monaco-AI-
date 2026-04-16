import { registerFileSystemIpcHandlers } from './file-system.ipc'
import { registerTerminalIpcHandlers } from './terminal.ipc'

export function registerIpcHandlers(): void {
  registerTerminalIpcHandlers()
  registerFileSystemIpcHandlers()
}
