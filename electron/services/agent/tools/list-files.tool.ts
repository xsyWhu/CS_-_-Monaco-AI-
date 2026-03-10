import fs from 'fs/promises'
import path from 'path'
import type { AgentTool, ToolContext } from './tool-registry'

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'out',
  '.next',
  '__pycache__',
  '.cache',
  '.turbo',
  'coverage',
])

const MAX_ENTRIES = 200

function resolvePath(filePath: string, context: ToolContext): string {
  const stripped = filePath.replace(/^[/\\]+/, '')
  if (!stripped || stripped === '.') return context.workspacePath
  if (path.isAbsolute(stripped)) return stripped
  return path.resolve(context.workspacePath, stripped)
}

interface TreeEntry {
  name: string
  isDir: boolean
  children?: TreeEntry[]
}

async function buildTree(
  dirPath: string,
  recursive: boolean,
  currentDepth: number,
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

    if (isDir && recursive && currentDepth < maxDepth) {
      node.children = await buildTree(
        path.join(dirPath, entry.name),
        recursive,
        currentDepth + 1,
        maxDepth,
        counter,
      )
    }

    result.push(node)
  }

  return result
}

function formatTree(entries: TreeEntry[], indent: string = ''): string {
  const lines: string[] = []
  for (const entry of entries) {
    const prefix = entry.isDir ? '[DIR] ' : ''
    lines.push(`${indent}${prefix}${entry.name}`)
    if (entry.children) {
      lines.push(formatTree(entry.children, indent + '  '))
    }
  }
  return lines.join('\n')
}

const listFilesTool: AgentTool = {
  name: 'list_files',
  description: 'List files and directories at the given path. Returns a tree-like listing.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Directory path to list' },
      recursive: {
        type: 'boolean',
        description: 'Whether to list recursively (default: false)',
      },
      maxDepth: {
        type: 'number',
        description: 'Maximum depth for recursive listing (default: 3)',
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
      if (!stat.isDirectory()) {
        return `Error: Path is not a directory: ${dirPath}`
      }
    } catch (error) {
      const err = error as NodeJS.ErrnoException
      if (err.code === 'ENOENT') {
        return `Error: Directory not found: ${dirPath}`
      }
      return `Error: ${err.message}`
    }

    const counter = { count: 0 }
    const tree = await buildTree(dirPath, recursive, 0, maxDepth, counter)
    const output = formatTree(tree)

    const suffix = counter.count >= MAX_ENTRIES ? `\n\n(Listing truncated at ${MAX_ENTRIES} entries)` : ''

    return output + suffix
  },
}

export default listFilesTool
