import fs from 'fs/promises'
import path from 'path'
import type { AgentTool, ToolContext } from './tool-registry'

function resolvePath(filePath: string, context: ToolContext): string {
  const stripped = filePath.replace(/^[/\\]+/, '')
  if (!stripped || stripped === '.') return context.workspacePath
  if (path.isAbsolute(stripped)) return stripped
  return path.resolve(context.workspacePath, stripped)
}

const readFileTool: AgentTool = {
  name: 'read_file',
  description:
    'Read the contents of a file at the given path. Returns the file content with line numbers.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the file to read' },
      offset: {
        type: 'number',
        description: 'Start line number (1-indexed). If omitted, reads from the beginning.',
      },
      limit: {
        type: 'number',
        description: 'Number of lines to read. If omitted, reads to the end.',
      },
    },
    required: ['path'],
  },

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<string> {
    const filePath = resolvePath(args.path as string, context)
    const offset = args.offset as number | undefined
    const limit = args.limit as number | undefined

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      let lines = content.split('\n')

      const startIndex = offset && offset > 0 ? offset - 1 : 0
      const endIndex = limit && limit > 0 ? startIndex + limit : lines.length
      lines = lines.slice(startIndex, endIndex)

      const totalDigits = String(startIndex + lines.length).length
      const numbered = lines.map((line, i) => {
        const lineNum = String(startIndex + i + 1).padStart(totalDigits, ' ')
        return `${lineNum}|${line}`
      })

      return numbered.join('\n')
    } catch (error) {
      const err = error as NodeJS.ErrnoException
      if (err.code === 'ENOENT') {
        return `Error: File not found: ${filePath}`
      }
      if (err.code === 'EISDIR') {
        return `Error: Path is a directory, not a file: ${filePath}`
      }
      return `Error reading file: ${err.message}`
    }
  },
}

export default readFileTool
