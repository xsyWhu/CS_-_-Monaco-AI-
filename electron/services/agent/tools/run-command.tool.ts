import { execSync } from 'child_process'
import path from 'path'
import type { AgentTool, ToolContext } from './tool-registry'

const TIMEOUT_MS = 30_000
const MAX_OUTPUT_LENGTH = 10_000

function resolvePath(filePath: string, context: ToolContext): string {
  const stripped = filePath.replace(/^[/\\]+/, '')
  if (!stripped || stripped === '.') return context.workspacePath
  if (path.isAbsolute(stripped)) return stripped
  return path.resolve(context.workspacePath, stripped)
}

function truncateOutput(output: string): string {
  if (output.length <= MAX_OUTPUT_LENGTH) return output
  const half = Math.floor(MAX_OUTPUT_LENGTH / 2)
  return (
    output.slice(0, half) +
    `\n\n--- Output truncated (${output.length} chars total) ---\n\n` +
    output.slice(-half)
  )
}

const runCommandTool: AgentTool = {
  name: 'run_command',
  description: 'Execute a shell command in the workspace directory. Returns stdout and stderr.',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The shell command to execute' },
      cwd: {
        type: 'string',
        description: 'Working directory for the command. Defaults to workspace root.',
      },
    },
    required: ['command'],
  },

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<string> {
    const command = args.command as string
    const cwd = args.cwd ? resolvePath(args.cwd as string, context) : context.workspacePath

    try {
      const output = execSync(command, {
        cwd,
        timeout: TIMEOUT_MS,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/sh',
      })

      return truncateOutput(output ?? '(No output)')
    } catch (error) {
      const err = error as {
        status?: number
        stdout?: string
        stderr?: string
        message?: string
        killed?: boolean
        signal?: string
      }

      if (err.killed || err.signal === 'SIGTERM') {
        return `Error: Command timed out after ${TIMEOUT_MS / 1000} seconds`
      }

      const parts: string[] = []
      if (err.stdout) parts.push(err.stdout)
      if (err.stderr) parts.push(err.stderr)

      const combined = parts.length > 0 ? parts.join('\n') : err.message ?? 'Unknown error'
      const exitInfo = err.status != null ? `\n(Exit code: ${err.status})` : ''

      return truncateOutput(combined + exitInfo)
    }
  },
}

export default runCommandTool
