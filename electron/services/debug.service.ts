import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import type { WebContents } from 'electron'

export interface DebugBreakpoint {
  filePath: string
  line: number
}

export interface DebugStackFrame {
  level: number
  func: string
  file?: string
  fullname?: string
  line?: number
}

export interface DebugVariable {
  name: string
  value: string
}

export interface DebugLocation {
  filePath: string
  line: number
  column: number
}

export interface DebugSessionState {
  status: 'idle' | 'starting' | 'running' | 'stopped' | 'ended' | 'error'
  sourceFile: string | null
  executablePath: string | null
  currentLocation: DebugLocation | null
  breakpoints: DebugBreakpoint[]
  stackFrames: DebugStackFrame[]
  variables: DebugVariable[]
  output: string[]
  error: string | null
}

interface InternalSession {
  gdb: ChildProcessWithoutNullStreams
  sourceFile: string
  executablePath: string
  cwd: string
}

interface PendingCommand {
  resolve: (value: string) => void
  reject: (reason: Error) => void
}

const MAX_OUTPUT_LINES = 200
const DEBUG_WORKDIR = path.join(os.tmpdir(), 'agent-ide-debug')

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

function normalizePath(input: string): string {
  return input.replace(/\\/g, '/')
}

function escapeForMi(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function baseNameWithoutExt(filePath: string): string {
  const base = path.basename(filePath)
  const index = base.lastIndexOf('.')
  return index === -1 ? base : base.slice(0, index)
}

function unescapeMiString(input: string): string {
  try {
    return JSON.parse(`"${input}"`)
  } catch {
    return input.replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\n/g, '\n')
  }
}

function parseMiAttributes(payload: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const regex = /([A-Za-z0-9_]+)="((?:\\.|[^"])*)"/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(payload))) {
    attrs[match[1]] = unescapeMiString(match[2])
  }
  return attrs
}

function parseFrames(line: string): DebugStackFrame[] {
  const stackMatch = line.match(/stack=\[(.*)\]$/)
  if (!stackMatch) return []

  const frames: DebugStackFrame[] = []
  const frameRegex = /frame=\{([^}]*)\}/g
  let match: RegExpExecArray | null
  while ((match = frameRegex.exec(stackMatch[1]))) {
    const attrs = parseMiAttributes(match[1])
    frames.push({
      level: Number(attrs.level ?? '0'),
      func: attrs.func ?? 'anonymous',
      file: attrs.file,
      fullname: attrs.fullname,
      line: attrs.line ? Number(attrs.line) : undefined,
    })
  }
  return frames
}

function parseVariables(line: string): DebugVariable[] {
  const varsMatch = line.match(/variables=\[(.*)\]$/)
  if (!varsMatch) return []

  const variables: DebugVariable[] = []
  const itemRegex = /\{([^}]*)\}/g
  let match: RegExpExecArray | null
  while ((match = itemRegex.exec(varsMatch[1]))) {
    const attrs = parseMiAttributes(match[1])
    if (!attrs.name) continue
    variables.push({
      name: attrs.name,
      value: attrs.value ?? '',
    })
  }
  return variables
}

function extractStoppedLocation(line: string): DebugLocation | null {
  const attrsMatch = line.match(/frame=\{([^}]*)\}/)
  if (!attrsMatch) return null

  const attrs = parseMiAttributes(attrsMatch[1])
  const filePath = attrs.fullname || attrs.file
  const lineNumber = Number(attrs.line ?? '0')
  if (!filePath || !Number.isFinite(lineNumber) || lineNumber < 1) {
    return null
  }

  return {
    filePath: normalizePath(filePath),
    line: Math.floor(lineNumber),
    column: 1,
  }
}

function stripMiPrefix(line: string): string {
  const content = line.trim()
  if (content.startsWith('~') || content.startsWith('@') || content.startsWith('&')) {
    const quoted = content.slice(1)
    return unescapeMiString(quoted.startsWith('"') ? quoted.slice(1, -1) : quoted)
  }
  return content
}

function stripResponsePayload(line: string): string {
  const cleaned = line.trim()
  const doneMatch = cleaned.match(/^\d+\^done,(.*)$/)
  if (doneMatch) return doneMatch[1]
  const errorMatch = cleaned.match(/^\d+\^error,(.*)$/)
  if (errorMatch) return errorMatch[1]
  const plainDoneMatch = cleaned.match(/^\^done,(.*)$/)
  if (plainDoneMatch) return plainDoneMatch[1]
  return cleaned
}

function formatToolStartError(tool: 'g++' | 'gdb', error: Error): string {
  const errorWithCode = error as NodeJS.ErrnoException
  if (errorWithCode.code === 'ENOENT') {
    if (tool === 'gdb' && process.platform === 'win32') {
      return [
        'Failed to start gdb: gdb was not found in PATH.',
        'Install it in MSYS2 UCRT64 with: pacman -S --needed mingw-w64-ucrt-x86_64-gdb',
        'Then restart this app so the embedded terminal and Electron main process can reload PATH.',
      ].join(' ')
    }

    if (tool === 'g++' && process.platform === 'win32') {
      return [
        'Failed to start g++: g++ was not found in PATH.',
        'Install it in MSYS2 UCRT64 with: pacman -S --needed mingw-w64-ucrt-x86_64-gcc',
        'Then restart this app so the embedded terminal and Electron main process can reload PATH.',
      ].join(' ')
    }

    return `Failed to start ${tool}: ${tool} was not found in PATH.`
  }

  return `Failed to start ${tool}: ${error.message}`
}

class DebugService {
  private sender: WebContents | null = null
  private session: InternalSession | null = null
  private sessionState: DebugSessionState = {
    status: 'idle',
    sourceFile: null,
    executablePath: null,
    currentLocation: null,
    breakpoints: [],
    stackFrames: [],
    variables: [],
    output: [],
    error: null,
  }
  private token = 1
  private pending = new Map<number, PendingCommand>()
  private stdoutBuffer = ''
  private readyResolver: (() => void) | null = null
  private readyPromise: Promise<void> | null = null

  attachSender(sender: WebContents): void {
    this.sender = sender
  }

  getState(): DebugSessionState {
    return {
      ...this.sessionState,
      breakpoints: [...this.sessionState.breakpoints],
      stackFrames: [...this.sessionState.stackFrames],
      variables: [...this.sessionState.variables],
      output: [...this.sessionState.output],
    }
  }

  async start(sourceFile: string, breakpoints: DebugBreakpoint[], sender: WebContents): Promise<DebugSessionState> {
    this.attachSender(sender)
    await this.stop()

    ensureDir(DEBUG_WORKDIR)
    const executablePath = path.join(
      DEBUG_WORKDIR,
      `${baseNameWithoutExt(sourceFile)}-${Date.now()}.exe`,
    )

    this.sessionState = {
      status: 'starting',
      sourceFile,
      executablePath,
      currentLocation: null,
      breakpoints: breakpoints.map((bp) => ({
        filePath: normalizePath(bp.filePath),
        line: bp.line,
      })),
      stackFrames: [],
      variables: [],
      output: [],
      error: null,
    }
    this.emitState()

    const compileResult = await this.compile(sourceFile, executablePath)
    if (!compileResult.ok) {
      this.sessionState = {
        ...this.sessionState,
        status: 'error',
        error: compileResult.error,
      }
      this.pushOutput(compileResult.output)
      this.emitState()
      return this.getState()
    }

    const cwd = path.dirname(sourceFile)
    const gdb = spawn('gdb', ['--interpreter=mi2', '--quiet', executablePath], {
      cwd,
      windowsHide: true,
      stdio: 'pipe',
    })

    let didSpawn = false
    let resolveStartup: ((error: Error | null) => void) | null = null
    const startupPromise = new Promise<Error | null>((resolve) => {
      resolveStartup = resolve
    })

    this.session = {
      gdb,
      sourceFile,
      executablePath,
      cwd,
    }

    this.pending.clear()
    this.stdoutBuffer = ''
    this.readyPromise = new Promise((resolve) => {
      this.readyResolver = resolve
    })

    gdb.once('spawn', () => {
      didSpawn = true
      resolveStartup?.(null)
      resolveStartup = null
    })
    gdb.on('error', (error) => {
      const message = formatToolStartError('gdb', error)
      this.pending.forEach((pending) => {
        pending.reject(error)
      })
      this.pending.clear()
      this.session = null
      this.readyResolver?.()
      this.readyResolver = null
      this.readyPromise = null
      this.sessionState = {
        ...this.sessionState,
        status: 'error',
        error: message,
      }
      this.pushOutput(message)
      this.emitState()

      if (!didSpawn) {
        resolveStartup?.(error)
        resolveStartup = null
      }
    })
    gdb.stdout.on('data', (chunk: Buffer) => {
      this.handleStdout(chunk.toString('utf8'))
    })
    gdb.stderr.on('data', (chunk: Buffer) => {
      this.pushOutput(chunk.toString('utf8'))
    })
    gdb.on('exit', (code, signal) => {
      this.pending.forEach((pending) => {
        pending.reject(new Error('Debugger exited'))
      })
      this.pending.clear()
      this.session = null
      if (this.sessionState.status !== 'error') {
        this.sessionState = {
          ...this.sessionState,
          status: 'ended',
          error: code === 0 ? null : `Debugger exited with code ${code ?? 'unknown'}${signal ? ` (${signal})` : ''}`,
        }
        this.emitState()
      }
    })

    const startupError = await startupPromise
    if (startupError) {
      return this.getState()
    }

    try {
      await this.waitForReady()
      await this.sendCommand('-gdb-set pagination off')
      await this.sendCommand('-gdb-set mi-async on')
      await this.sendCommand('-enable-pretty-printing')
      await this.syncBreakpoints()
      await this.sendCommand('-exec-run')
    } catch (error) {
      const message = `Debugger start failed: ${(error as Error).message}`
      this.sessionState = {
        ...this.sessionState,
        status: 'error',
        error: message,
      }
      this.pushOutput(message)
      this.emitState()
      return this.getState()
    }

    this.sessionState = {
      ...this.sessionState,
      status: 'running',
      error: null,
    }
    this.emitState()
    return this.getState()
  }

  async stop(): Promise<void> {
    if (!this.session) {
      this.sessionState = {
        ...this.sessionState,
        status: 'idle',
        currentLocation: null,
        stackFrames: [],
        variables: [],
        error: null,
      }
      this.emitState()
      return
    }

    const { gdb } = this.session
    try {
      if (!gdb.killed) {
        gdb.kill()
      }
    } catch {
      // Ignore shutdown errors.
    }

    this.session = null
    this.sessionState = {
      status: 'idle',
      sourceFile: null,
      executablePath: null,
      currentLocation: null,
      breakpoints: [...this.sessionState.breakpoints],
      stackFrames: [],
      variables: [],
      output: [],
      error: null,
    }
    this.emitState()
  }

  async continue(): Promise<void> {
    if (!this.session) return
    await this.sendCommand('-exec-continue')
  }

  async stepOver(): Promise<void> {
    if (!this.session) return
    await this.sendCommand('-exec-next')
  }

  async stepInto(): Promise<void> {
    if (!this.session) return
    await this.sendCommand('-exec-step')
  }

  async stepOut(): Promise<void> {
    if (!this.session) return
    await this.sendCommand('-exec-finish')
  }

  async pause(): Promise<void> {
    if (!this.session) return
    await this.sendCommand('-exec-interrupt')
  }

  async toggleBreakpoint(filePath: string, line: number): Promise<DebugSessionState> {
    const normalizedPath = normalizePath(filePath)
    const breakpoints = [...this.sessionState.breakpoints]
    const index = breakpoints.findIndex((bp) => normalizePath(bp.filePath) === normalizedPath && bp.line === line)
    if (index >= 0) {
      breakpoints.splice(index, 1)
    } else {
      breakpoints.push({ filePath: normalizedPath, line })
    }
    this.sessionState.breakpoints = breakpoints
    this.emitState()

    if (this.session) {
      await this.syncBreakpoints()
    }

    return this.getState()
  }

  async setBreakpoints(breakpoints: DebugBreakpoint[]): Promise<DebugSessionState> {
    this.sessionState.breakpoints = breakpoints.map((bp) => ({
      filePath: normalizePath(bp.filePath),
      line: bp.line,
    }))
    this.emitState()
    if (this.session) {
      await this.syncBreakpoints()
    }
    return this.getState()
  }

  private async compile(sourceFile: string, executablePath: string): Promise<{ ok: true } | { ok: false; error: string; output: string }> {
    const args = [
      '-g',
      '-O0',
      '-std=c++17',
      '-Wall',
      '-Wextra',
      '-o',
      executablePath,
      sourceFile,
    ]

    return await new Promise((resolve) => {
      const proc = spawn('g++', args, { cwd: path.dirname(sourceFile), windowsHide: true })
      let output = ''

      proc.stdout.on('data', (chunk: Buffer) => {
        output += chunk.toString('utf8')
      })
      proc.stderr.on('data', (chunk: Buffer) => {
        output += chunk.toString('utf8')
      })
      proc.on('error', (error) => {
        resolve({ ok: false, error: formatToolStartError('g++', error), output })
      })
      proc.on('exit', (code) => {
        if (code === 0) {
          resolve({ ok: true })
        } else {
          resolve({ ok: false, error: `g++ exited with code ${code ?? 'unknown'}`, output })
        }
      })
    })
  }

  private async waitForReady(): Promise<void> {
    if (this.readyPromise) {
      await this.readyPromise
    }
  }

  private emit(channel: string, payload: unknown): void {
    this.sender?.send(channel, payload)
  }

  private emitState(): void {
    this.emit('debug:state', this.getState())
  }

  private pushOutput(text: string): void {
    const lines = text.split(/\r?\n/).filter(Boolean)
    if (lines.length === 0) return

    this.sessionState.output = [...this.sessionState.output, ...lines].slice(-MAX_OUTPUT_LINES)
    this.emit('debug:output', lines)
    this.emitState()
  }

  private async syncBreakpoints(): Promise<void> {
    if (!this.session) return

    const filePath = normalizePath(this.session.sourceFile)
    const breakpoints = this.sessionState.breakpoints.filter((bp) => normalizePath(bp.filePath) === filePath)

    try {
      await this.sendCommand('-break-delete')
    } catch {
      // Ignore if there are no existing breakpoints.
    }
    for (const breakpoint of breakpoints) {
      const location = `${normalizePath(breakpoint.filePath)}:${breakpoint.line}`
      await this.sendCommand(`-break-insert "${escapeForMi(location)}"`)
    }
  }

  private async refreshContext(): Promise<void> {
    if (!this.session) return

    const stackResponse = stripResponsePayload(await this.sendCommand('-stack-list-frames'))
    const varsResponse = stripResponsePayload(await this.sendCommand('-stack-list-variables --all-values'))

    const stackFrames = parseFrames(stackResponse)
    const variables = parseVariables(varsResponse)
    const currentLocation = stackFrames[0]
      ? {
          filePath: normalizePath(stackFrames[0].fullname || stackFrames[0].file || this.session.sourceFile),
          line: stackFrames[0].line ?? 1,
          column: 1,
        }
      : null

    this.sessionState = {
      ...this.sessionState,
      status: 'stopped',
      currentLocation,
      stackFrames,
      variables,
    }
    this.emit('debug:stack', stackFrames)
    this.emit('debug:variables', variables)
    this.emitState()
  }

  private async sendCommand(command: string): Promise<string> {
    if (!this.session) {
      throw new Error('Debugger session is not active')
    }

    const token = this.token++
    const line = `${token}${command}\n`
    const result = await new Promise<string>((resolve, reject) => {
      this.pending.set(token, { resolve, reject })
      this.session?.gdb.stdin.write(line)
    })
    return result
  }

  private handleStdout(chunk: string): void {
    this.stdoutBuffer += chunk

    const lines = this.stdoutBuffer.split(/\r?\n/)
    this.stdoutBuffer = lines.pop() ?? ''

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line) continue

      if (line === '(gdb)') {
        this.readyResolver?.()
        this.readyResolver = null
        continue
      }

      if (line.startsWith('~') || line.startsWith('@') || line.startsWith('&')) {
        this.pushOutput(stripMiPrefix(line))
        continue
      }

      const tokenMatch = line.match(/^(\d+)([\^\*\=])(.*)$/)
      if (tokenMatch) {
        const token = Number(tokenMatch[1])
        const type = tokenMatch[2]
        const payload = tokenMatch[3]
        if (type === '^') {
          if (payload.startsWith('done') || payload.startsWith('running')) {
            this.pending.get(token)?.resolve(line)
            this.pending.delete(token)
          } else if (payload.startsWith('error')) {
            const messageMatch = payload.match(/msg="((?:\\.|[^"])*)"/)
            const message = messageMatch ? unescapeMiString(messageMatch[1]) : 'Debugger command failed'
            this.pending.get(token)?.reject(new Error(message))
            this.pending.delete(token)
          }
          continue
        }
      }

      if (line.startsWith('*stopped')) {
        void this.refreshContext().catch((error) => {
          this.pushOutput(`Debugger refresh failed: ${(error as Error).message}`)
        })

        const stoppedLocation = extractStoppedLocation(line)
        if (stoppedLocation) {
          this.sessionState.currentLocation = stoppedLocation
          this.emit('debug:location', stoppedLocation)
        }
        this.emitState()
      }
    }
  }
}

export const debugService = new DebugService()
