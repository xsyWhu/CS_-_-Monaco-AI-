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

const MAX_FILE_SIZE = 1024 * 1024 // 1MB
const MAX_RESULTS = 50

function resolvePath(filePath: string, context: ToolContext): string {
  const stripped = filePath.replace(/^[/\\]+/, '')
  if (!stripped || stripped === '.') return context.workspacePath
  if (path.isAbsolute(stripped)) return stripped
  return path.resolve(context.workspacePath, stripped)
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

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

async function walkAndSearch(
  dirPath: string,
  pattern: RegExp,
  results: string[],
  filePattern: string | undefined,
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
      if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
        await walkAndSearch(fullPath, pattern, results, filePattern)
      }
    } else if (entry.isFile()) {
      if (filePattern && !matchesGlob(entry.name, filePattern)) continue

      try {
        const stat = await fs.stat(fullPath)
        if (stat.size > MAX_FILE_SIZE || stat.size === 0) continue

        const content = await fs.readFile(fullPath, 'utf-8')
        const lines = content.split('\n')

        for (let i = 0; i < lines.length; i++) {
          if (results.length >= MAX_RESULTS) break

          pattern.lastIndex = 0
          if (pattern.test(lines[i])) {
            results.push(`${fullPath}:${i + 1}: ${lines[i].trimEnd()}`)
          }
        }
      } catch {
        // Skip unreadable files
      }
    }
  }
}

const searchFilesTool: AgentTool = {
  name: 'search_files',
  description:
    'Search for a text pattern in files within the workspace. Returns matching lines with file paths and line numbers.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Text pattern to search for' },
      path: {
        type: 'string',
        description: 'Subdirectory to search within (relative to workspace). Defaults to workspace root.',
      },
      caseSensitive: {
        type: 'boolean',
        description: 'Whether the search is case-sensitive (default: false)',
      },
      filePattern: {
        type: 'string',
        description: 'Glob pattern to filter files (e.g. "*.ts")',
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
      return `Error: Invalid search query: ${query}`
    }

    const results: string[] = []
    await walkAndSearch(searchPath, pattern, results, filePattern)

    if (results.length === 0) {
      return `No matches found for "${query}"`
    }

    const suffix =
      results.length >= MAX_RESULTS ? `\n\n(Results limited to ${MAX_RESULTS} matches)` : ''

    return results.join('\n') + suffix
  },
}

export default searchFilesTool
