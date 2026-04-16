/**
 * Day 5: search_files 工具——在工作区内全文搜索。
 *
 * 功能：
 * - 递归扫描文件，对每行执行正则匹配。
 * - 返回"文件路径:行号: 行内容"格式，便于模型定位代码。
 * - 自动跳过 node_modules 等无关目录和超大文件。
 */

import fs from 'fs/promises'
import path from 'path'
import type { AgentTool, ToolContext } from './tool-registry'

const IGNORED_DIRS = new Set([
  'node_modules', '.git', '.svn', 'dist', 'out', '.next', '__pycache__', '.cache', 'coverage',
])
const MAX_FILE_SIZE = 1024 * 1024 // 1 MB
const MAX_RESULTS = 50

function resolvePath(filePath: string, context: ToolContext): string {
  const stripped = filePath.replace(/^[/\\]+/, '')
  if (!stripped || stripped === '.') return context.workspacePath
  if (path.isAbsolute(stripped)) return stripped
  return path.resolve(context.workspacePath, stripped)
}

/** 转义正则特殊字符，将普通字符串作为字面量匹配。 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 简单 glob 匹配（仅支持 * 通配符），用于文件扩展名过滤。 */
function matchesGlob(fileName: string, pattern: string): boolean {
  const regexStr = pattern
    .split('*')
    .map((s) => s.split('?').map(escapeRegex).join('.'))
    .join('.*')
  try {
    return new RegExp(`^${regexStr}$`, 'i').test(fileName)
  } catch {
    return false
  }
}

/** 递归遍历目录并搜索匹配行。 */
async function walkAndSearch(
  dirPath: string,
  pattern: RegExp,
  results: string[],
  filePattern?: string,
): Promise<void> {
  if (results.length >= MAX_RESULTS) return

  let entries
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    if (results.length >= MAX_RESULTS) break
    const fullPath = path.join(dirPath, entry.name)

    if (entry.isDirectory()) {
      // 隐藏目录和黑名单目录一律跳过。
      if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
        await walkAndSearch(fullPath, pattern, results, filePattern)
      }
    } else if (entry.isFile()) {
      // 文件类型过滤。
      if (filePattern && !matchesGlob(entry.name, filePattern)) continue

      try {
        const stat = await fs.stat(fullPath)
        // 跳过超大文件和空文件。
        if (stat.size > MAX_FILE_SIZE || stat.size === 0) continue

        const content = await fs.readFile(fullPath, 'utf-8')
        const lines = content.split('\n')

        for (let i = 0; i < lines.length; i++) {
          if (results.length >= MAX_RESULTS) break
          pattern.lastIndex = 0 // 重置正则状态（全局模式）。
          if (pattern.test(lines[i])) {
            results.push(`${fullPath}:${i + 1}: ${lines[i].trimEnd()}`)
          }
        }
      } catch {
        // 跳过无法读取的文件（权限不足等）。
      }
    }
  }
}

const searchFilesTool: AgentTool = {
  name: 'search_files',
  description:
    '在工作区内搜索包含指定文本的代码行，返回匹配的文件路径、行号和行内容。',

  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '要搜索的文本（当作字面量处理，不是正则）',
      },
      path: {
        type: 'string',
        description: '搜索范围（相对工作区的子目录），省略则搜索整个工作区',
      },
      caseSensitive: {
        type: 'boolean',
        description: '是否区分大小写（默认 false）',
      },
      filePattern: {
        type: 'string',
        description: '文件名 glob 过滤，例如 "*.ts" 只搜索 TypeScript 文件',
      },
    },
    required: ['query'],
  },

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<string> {
    const query = args.query as string
    const searchPath = args.path
      ? resolvePath(args.path as string, context)
      : context.workspacePath
    const caseSensitive = (args.caseSensitive as boolean) ?? false
    const filePattern = args.filePattern as string | undefined

    const flags = caseSensitive ? 'g' : 'gi'
    let pattern: RegExp
    try {
      pattern = new RegExp(escapeRegex(query), flags)
    } catch {
      return `错误：无效的搜索关键词 "${query}"`
    }

    const results: string[] = []
    await walkAndSearch(searchPath, pattern, results, filePattern)

    if (results.length === 0) return `未找到与 "${query}" 相关的结果`

    const suffix =
      results.length >= MAX_RESULTS ? `\n\n(结果已截断，最多显示 ${MAX_RESULTS} 条)` : ''
    return results.join('\n') + suffix
  },
}

export default searchFilesTool
