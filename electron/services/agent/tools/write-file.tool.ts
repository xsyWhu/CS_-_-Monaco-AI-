import fs from 'fs/promises'
import path from 'path'
import type { AgentTool, ToolContext } from './tool-registry'

function resolvePath(filePath: string, context: ToolContext): string {
  const stripped = filePath.replace(/^[/\\]+/, '')
  if (!stripped || stripped === '.') return context.workspacePath
  if (path.isAbsolute(stripped)) return stripped
  return path.resolve(context.workspacePath, stripped)
}

const writeFileTool: AgentTool = {
  name: 'write_file',
  description:
    'Write content to a file. Creates parent directories if they do not exist. Overwrites the file if it exists.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the file to write' },
      content: { type: 'string', description: 'Content to write to the file' },
    },
    required: ['path', 'content'],
  },

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<string> {
    const filePath = resolvePath(args.path as string, context)
    const content = args.content as string

    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, content, 'utf-8')
      return `Successfully wrote to ${filePath}`
    } catch (error) {
      const err = error as NodeJS.ErrnoException
      return `Error writing file: ${err.message}`
    }
  },
}

export default writeFileTool
