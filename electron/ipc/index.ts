import { registerFileSystemIPC } from './file-system.ipc'
import { registerTerminalIPC } from './terminal.ipc'
import { registerGitIPC } from './git.ipc'
import { registerSearchIPC } from './search.ipc'
import { registerAgentIPC } from './agent.ipc'

export function registerAllIPC(): void {
  registerFileSystemIPC()
  registerTerminalIPC()
  registerGitIPC()
  registerSearchIPC()
  registerAgentIPC()
}
