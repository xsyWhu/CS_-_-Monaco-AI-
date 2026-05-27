import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import os from 'os'
import * as pty from 'node-pty'

interface TerminalInstance {
  process: pty.IPty
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
    const cwd = this.resolveCwd(options?.cwd)
    const shell = this.resolveShell(options?.shell)

    try {
      const proc = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd,
        env: process.env as Record<string, string>,
        encoding: 'utf8',
      })

      this.terminals.set(id, { process: proc, id })

      proc.onExit(() => {
        this.terminals.delete(id)
      })

      return { id }
    } catch (error) {
      throw new Error(`Failed to create terminal: ${(error as Error).message}`)
    }
  }

  onData(id: string, callback: (data: string) => void): void {
    const terminal = this.getTerminal(id)

    terminal.process.onData((data) => {
      callback(data)
    })
  }

  write(id: string, data: string): void {
    const terminal = this.getTerminal(id)

    terminal.process.write(data)
  }

  resize(id: string, cols: number, rows: number): void {
    const terminal = this.getTerminal(id)
    terminal.process.resize(cols, rows)
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

  private resolveShell(requestedShell?: string): string {
    if (requestedShell && this.isUsableShell(requestedShell)) {
      return requestedShell
    }

    const candidates = os.platform() === 'win32'
      ? ['powershell.exe', 'pwsh.exe', 'cmd.exe']
      : [process.env.SHELL, '/bin/bash', '/bin/zsh', '/bin/sh']

    for (const candidate of candidates) {
      if (candidate && this.isUsableShell(candidate)) {
        return candidate
      }
    }

    return this.getDefaultShell()
  }

  private resolveCwd(requestedCwd?: string): string {
    const candidates = [
      requestedCwd,
      process.env.PWD,
      process.cwd(),
      os.homedir(),
    ]

    for (const candidate of candidates) {
      if (!candidate) continue
      try {
        const stats = fs.statSync(candidate)
        if (stats.isDirectory()) {
          return path.resolve(candidate)
        }
      } catch {
        // Try the next candidate.
      }
    }

    return process.cwd()
  }

  private isUsableShell(shellPath: string): boolean {
    if (os.platform() === 'win32') {
      return true
    }

    if (path.isAbsolute(shellPath)) {
      try {
        const stats = fs.statSync(shellPath)
        return stats.isFile()
      } catch {
        return false
      }
    }

    return true
  }
}
