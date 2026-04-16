/**
 * Day 5: read_file 工具——读取工作区内的文件内容。
 *
 * JSON Schema 参数定义：
 * - path (必填): 相对工作区的文件路径。
 * - offset (可选): 起始行号（1-indexed）。
 * - limit (可选): 读取行数上限。
 *
 * 返回带行号的文本，便于模型精准定位代码。
 */

import fs from 'fs/promises'
import path from 'path'
import type { AgentTool, ToolContext } from './tool-registry'

/** 将用户输入的路径安全地解析为绝对路径。 */
function resolvePath(filePath: string, context: ToolContext): string {
  // 去除开头的 / 和 \，防止路径穿越。
  const stripped = filePath.replace(/^[/\\]+/, '')
  if (!stripped || stripped === '.') return context.workspacePath
  if (path.isAbsolute(stripped)) return stripped
  return path.resolve(context.workspacePath, stripped)
}

const readFileTool: AgentTool = {
  name: 'read_file',
  description:
    '读取指定路径的文件内容，返回带行号的文本。支持通过 offset/limit 分页读取大文件。',

  // JSON Schema：OpenAI 依据此定义生成 tool_call 时的参数结构。
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '相对于工作区根目录的文件路径，例如 "src/main.ts"',
      },
      offset: {
        type: 'number',
        description: '起始行号（1-indexed），省略则从头读取',
      },
      limit: {
        type: 'number',
        description: '最多读取的行数，省略则读取全部',
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

      // 按 offset/limit 截取行范围。
      const startIndex = offset && offset > 0 ? offset - 1 : 0
      const endIndex = limit && limit > 0 ? startIndex + limit : lines.length
      lines = lines.slice(startIndex, endIndex)

      // 添加行号前缀，格式：" 1|line content"
      const totalDigits = String(startIndex + lines.length).length
      const numbered = lines.map((line, i) => {
        const lineNum = String(startIndex + i + 1).padStart(totalDigits, ' ')
        return `${lineNum}|${line}`
      })

      return numbered.join('\n')
    } catch (error) {
      const err = error as NodeJS.ErrnoException
      if (err.code === 'ENOENT') return `错误：文件不存在 ${filePath}`
      if (err.code === 'EISDIR') return `错误：路径是目录，请指定文件 ${filePath}`
      return `读取文件出错：${err.message}`
    }
  },
}

export default readFileTool
