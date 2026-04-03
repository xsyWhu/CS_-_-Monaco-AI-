import fs from 'fs/promises'
import path from 'path'

export interface SearchMatch {
  filePath: string
  line: number
  column: number
  lineContent: string
  matchLength: number
}

export interface FileNameMatch {
  filePath: string
  fileName: string
}

export interface SearchOptions {
  maxResults?: number
  caseSensitive?: boolean
  regex?: boolean
  filePattern?: string
}

export default class SearchService {
  private readonly IGNORED_DIRS = ['node_modules', '.git', 'dist', 'out', '.next', '__pycache__']
  private readonly MAX_FILE_SIZE = 1024 * 1024 // 1MB

  async searchFiles(
    rootPath: string,
    query: string,
    options?: SearchOptions,
  ): Promise<SearchMatch[]> {
    const maxResults = options?.maxResults ?? 100
    const caseSensitive = options?.caseSensitive ?? false
    const useRegex = options?.regex ?? false
    const filePattern = options?.filePattern

    const results: SearchMatch[] = []

    let pattern: RegExp
    try {
      const flags = caseSensitive ? 'g' : 'gi'
      pattern = useRegex ? new RegExp(query, flags) : new RegExp(this.escapeRegex(query), flags)
    } catch {
      return results
    }

    await this.walkDirectory(rootPath, async (filePath) => {
      if (results.length >= maxResults) return

      if (filePattern && !this.matchesPattern(path.basename(filePath), filePattern)) {
        return
      }

      try {
        const stat = await fs.stat(filePath)
        if (stat.size > this.MAX_FILE_SIZE || stat.size === 0) return

        const content = await fs.readFile(filePath, 'utf-8')
        const lines = content.split('\n')

        for (let i = 0; i < lines.length; i++) {
          if (results.length >= maxResults) break

          const line = lines[i]
          pattern.lastIndex = 0

          let match: RegExpExecArray | null
          while ((match = pattern.exec(line)) !== null) {
            if (results.length >= maxResults) break

            results.push({
              filePath,
              line: i + 1,
              column: match.index + 1,
              lineContent: line.trimEnd(),
              matchLength: match[0].length,
            })

            if (!useRegex) break
          }
        }
      } catch {
        // Skip files that can't be read (binary, permission errors, etc.)
      }
    })

    return results
  }

  async searchFileNames(
    rootPath: string,
    pattern: string,
    maxResults: number = 50,
  ): Promise<FileNameMatch[]> {
    const results: FileNameMatch[] = []
    const lowerPattern = pattern.toLowerCase()

    await this.walkDirectory(rootPath, async (filePath) => {
      if (results.length >= maxResults) return

      const fileName = path.basename(filePath)

      if (this.matchesPattern(fileName, pattern) || fileName.toLowerCase().includes(lowerPattern)) {
        results.push({ filePath, fileName })
      }
    })

    return results
  }

  private async walkDirectory(
    dirPath: string,
    callback: (filePath: string) => Promise<void>,
  ): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)

        if (entry.isDirectory()) {
          if (!this.IGNORED_DIRS.includes(entry.name) && !entry.name.startsWith('.')) {
            await this.walkDirectory(fullPath, callback)
          }
        } else if (entry.isFile()) {
          await callback(fullPath)
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  private matchesPattern(fileName: string, pattern: string): boolean {
    if (!pattern.includes('*') && !pattern.includes('?')) {
      return fileName.toLowerCase().includes(pattern.toLowerCase())
    }

    const regexStr = pattern
      .split('*').map((s) => s.split('?').map(this.escapeRegex).join('.')).join('.*')

    try {
      return new RegExp(`^${regexStr}$`, 'i').test(fileName)
    } catch {
      return false
    }
  }
}
