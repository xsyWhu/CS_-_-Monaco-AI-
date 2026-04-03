import { spawn, ChildProcess } from 'child_process'
import { randomUUID } from 'crypto'
import os from 'os'

interface TerminalInstance {
  process: ChildProcess
  id: string
}

export interface TerminalCreateOptions {
  cwd?: string
  shell?: string
}

export default class TerminalService {
  private terminals: Map<string, TerminalInstance> = new Map()

  create(options?: TerminalCreateOptions): { id: string } {
    const id = randomUUID()
    const cwd = options?.cwd || process.cwd()
    const shell = options?.shell || this.getDefaultShell()

    try {
      const proc = spawn(shell, [], {
        cwd,
        env: process.env,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        windowsHide: true,
      })

      this.terminals.set(id, { process: proc, id })

      proc.on('exit', () => {
        this.terminals.delete(id)
      })

      return { id }
    } catch (error) {
      throw new Error(`Failed to create terminal: ${(error as Error).message}`)
    }
  }

  onData(id: string, callback: (data: string) => void): void {
    const terminal = this.getTerminal(id)

    terminal.process.stdout?.on('data', (data: Buffer) => {
      callback(data.toString())
    })

    terminal.process.stderr?.on('data', (data: Buffer) => {
      callback(data.toString())
    })
  }

  write(id: string, data: string): void {
    const terminal = this.getTerminal(id)

    if (!terminal.process.stdin?.writable) {
      throw new Error(`Terminal "${id}" stdin is not writable`)
    }

    terminal.process.stdin.write(data)
  }

  resize(_id: string, _cols: number, _rows: number): void {
    // resize is a no-op when using child_process.spawn
    // PTY support (node-pty) would be needed for actual resize
  }

  close(id: string): void {
    const terminal = this.terminals.get(id)
    if (!terminal) return

    try {
      terminal.process.kill()
    } catch {
      // Process may have already exited
    }

    this.terminals.delete(id)
  }

  dispose(): void {
    for (const [id] of this.terminals) {
      this.close(id)
    }
  }

  private getTerminal(id: string): TerminalInstance {
    const terminal = this.terminals.get(id)
    if (!terminal) {
      throw new Error(`Terminal "${id}" not found`)
    }
    return terminal
  }

  private getDefaultShell(): string {
    if (os.platform() === 'win32') {
      return 'powershell.exe'
    }
    return process.env.SHELL || '/bin/bash'
  }
}
