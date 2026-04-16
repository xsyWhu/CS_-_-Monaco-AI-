/**
 * Day 5: list_files 工具——列出工作区目录结构。
 *
 * 以树形结果返回目录内容，供模型了解项目结构。
 * 自动跳过 node_modules、.git 等无关目录。
 */

import fs from 'fs/promises'
import path from 'path'
import type { AgentTool, ToolContext } from './tool-registry'

// 遍历时跳过的目录（对模型价值低且体积大）。
const IGNORED_DIRS = new Set([
  'node_modules', '.git', '.svn', 'dist', 'out', '.next', '__pycache__', '.cache', 'coverage',
])

const MAX_ENTRIES = 200

function resolvePath(filePath: string, context: ToolContext): string {
  const stripped = filePath.replace(/^[/\\]+/, '')
  if (!stripped || stripped === '.') return context.workspacePath
  if (path.isAbsolute(stripped)) return stripped
  return path.resolve(context.workspacePath, stripped)
}

/** 递归构建目录树节点。 */
interface TreeEntry { name: string; isDir: boolean; children?: TreeEntry[] }

async function buildTree(
  dirPath: string,
  recursive: boolean,
  depth: number,
  maxDepth: number,
  counter: { count: number },
): Promise<TreeEntry[]> {
  if (counter.count >= MAX_ENTRIES) return []

  let entries
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true })
  } catch {
    return []
  }

  // 目录排前面，同类按名称字典序。
  entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })

  const result: TreeEntry[] = []

  for (const entry of entries) {
    if (counter.count >= MAX_ENTRIES) break
    const isDir = entry.isDirectory()

    if (isDir && IGNORED_DIRS.has(entry.name)) continue
    counter.count++

    const node: TreeEntry = { name: entry.name, isDir }

    if (isDir && recursive && depth < maxDepth) {
      node.children = await buildTree(
        path.join(dirPath, entry.name),
        recursive,
        depth + 1,
        maxDepth,
        counter,
      )
    }
    result.push(node)
  }

  return result
}

/** 将树节点格式化为缩进字符串，供模型阅读。 */
function formatTree(entries: TreeEntry[], indent = ''): string {
  const lines: string[] = []
  for (const entry of entries) {
    lines.push(`${indent}${entry.isDir ? '[DIR] ' : ''}${entry.name}`)
    if (entry.children) {
      lines.push(formatTree(entry.children, indent + '  '))
    }
  }
  return lines.join('\n')
}

const listFilesTool: AgentTool = {
  name: 'list_files',
  description: '列出指定目录的文件和子目录结构（树形输出）。',

  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '要列出的目录路径（相对工作区），使用 "." 表示根目录',
      },
      recursive: {
        type: 'boolean',
        description: '是否递归列出子目录（默认 false）',
      },
      maxDepth: {
        type: 'number',
        description: '递归时的最大深度（默认 3）',
      },
    },
    required: ['path'],
  },

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<string> {
    const dirPath = resolvePath(args.path as string, context)
    const recursive = (args.recursive as boolean) ?? false
    const maxDepth = (args.maxDepth as number) ?? 3

    try {
      const stat = await fs.stat(dirPath)
      if (!stat.isDirectory()) return `错误：路径不是目录 ${dirPath}`
    } catch (err) {
      const e = err as NodeJS.ErrnoException
      if (e.code === 'ENOENT') return `错误：目录不存在 ${dirPath}`
      return `错误：${e.message}`
    }

    const counter = { count: 0 }
    const tree = await buildTree(dirPath, recursive, 0, maxDepth, counter)
    const output = formatTree(tree)
    const suffix = counter.count >= MAX_ENTRIES ? `\n\n(已截断，最多显示 ${MAX_ENTRIES} 条)` : ''
    return output + suffix
  },
}

export default listFilesTool
