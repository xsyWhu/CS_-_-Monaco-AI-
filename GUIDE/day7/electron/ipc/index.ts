import { registerFileSystemIpcHandlers } from './file-system.ipc'
import { registerTerminalIpcHandlers } from './terminal.ipc'
import { registerChatIpcHandlers } from './chat.ipc'
import { registerGitIpcHandlers } from './git.ipc'

export function registerIpcHandlers(): void {
  registerTerminalIpcHandlers()
  registerFileSystemIpcHandlers()
  registerChatIpcHandlers()
  registerGitIpcHandlers()
}
