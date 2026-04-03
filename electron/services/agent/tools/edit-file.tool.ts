import fs from 'fs/promises'
import path from 'path'
import type { AgentTool, ToolContext } from './tool-registry'

function resolvePath(filePath: string, context: ToolContext): string {
  const stripped = filePath.replace(/^[/\\]+/, '')
  if (!stripped || stripped === '.') return context.workspacePath
  if (path.isAbsolute(stripped)) return stripped
  return path.resolve(context.workspacePath, stripped)
}

const editFileTool: AgentTool = {
  name: 'edit_file',
  description:
    'Edit a file by replacing an exact string match. The old_string must uniquely identify the text to replace in the file.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the file to edit' },
      old_string: { type: 'string', description: 'The exact text to find and replace' },
      new_string: { type: 'string', description: 'The replacement text' },
    },
    required: ['path', 'old_string', 'new_string'],
  },

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<string> {
    const filePath = resolvePath(args.path as string, context)
    const oldString = args.old_string as string
    const newString = args.new_string as string

    try {
      const content = await fs.readFile(filePath, 'utf-8')

      const occurrences = content.split(oldString).length - 1

      if (occurrences === 0) {
        return `Error: old_string not found in ${filePath}. Make sure the string matches exactly, including whitespace and indentation.`
      }

      if (occurrences > 1) {
        return `Error: old_string appears ${occurrences} times in ${filePath}. It must uniquely identify the text to replace. Include more surrounding context to make it unique.`
      }

      const newContent = content.replace(oldString, newString)
      await fs.writeFile(filePath, newContent, 'utf-8')

      return `Successfully edited ${filePath}`
    } catch (error) {
      const err = error as NodeJS.ErrnoException
      if (err.code === 'ENOENT') {
        return `Error: File not found: ${filePath}`
      }
      return `Error editing file: ${err.message}`
    }
  },
}

export default editFileTool
