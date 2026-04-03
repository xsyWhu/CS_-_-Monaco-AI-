import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import chokidar from 'chokidar'

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  isFile: boolean
  size: number
  modifiedTime: Date
}

export interface FileStats {
  size: number
  isDirectory: boolean
  isFile: boolean
  modifiedTime: Date
  createdTime: Date
}

export default class FileSystemService {
  private watchers: Map<string, chokidar.FSWatcher> = new Map()

  async readFile(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf-8')
    } catch (error) {
      throw new Error(`Failed to read file "${filePath}": ${(error as Error).message}`)
    }
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    try {
      const dir = path.dirname(filePath)
      await fs.mkdir(dir, { recursive: true })
      await fs.writeFile(filePath, content, 'utf-8')
    } catch (error) {
      throw new Error(`Failed to write file "${filePath}": ${(error as Error).message}`)
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      const stats = await fs.stat(filePath)
      if (stats.isDirectory()) {
        await fs.rm(filePath, { recursive: true, force: true })
      } else {
        await fs.unlink(filePath)
      }
    } catch (error) {
      throw new Error(`Failed to delete "${filePath}": ${(error as Error).message}`)
    }
  }

  async renameFile(oldPath: string, newPath: string): Promise<void> {
    try {
      const newDir = path.dirname(newPath)
      await fs.mkdir(newDir, { recursive: true })
      await fs.rename(oldPath, newPath)
    } catch (error) {
      throw new Error(`Failed to rename "${oldPath}" to "${newPath}": ${(error as Error).message}`)
    }
  }

  async readDirectory(dirPath: string): Promise<FileEntry[]> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      const results: FileEntry[] = []

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        try {
          const stats = await fs.stat(fullPath)
          results.push({
            name: entry.name,
            path: fullPath,
            isDirectory: entry.isDirectory(),
            isFile: entry.isFile(),
            size: stats.size,
            modifiedTime: stats.mtime,
          })
        } catch {
          // Skip entries we can't stat (e.g. broken symlinks)
        }
      }

      results.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) {
          return a.isDirectory ? -1 : 1
        }
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      })

      return results
    } catch (error) {
      throw new Error(`Failed to read directory "${dirPath}": ${(error as Error).message}`)
    }
  }

  async createDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true })
    } catch (error) {
      throw new Error(`Failed to create directory "${dirPath}": ${(error as Error).message}`)
    }
  }

  async getFileStats(filePath: string): Promise<FileStats> {
    try {
      const stats = await fs.stat(filePath)
      return {
        size: stats.size,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        modifiedTime: stats.mtime,
        createdTime: stats.birthtime,
      }
    } catch (error) {
      throw new Error(`Failed to get stats for "${filePath}": ${(error as Error).message}`)
    }
  }

  watchDirectory(
    dirPath: string,
    callback: (event: string, filePath: string) => void,
  ): string {
    if (this.watchers.has(dirPath)) {
      this.unwatchDirectory(dirPath)
    }

    const watcher = chokidar.watch(dirPath, {
      ignored: /(^|[/\\])(node_modules|\.git)([/\\]|$)/,
      persistent: true,
      ignoreInitial: true,
      depth: undefined,
    })

    watcher
      .on('add', (fp) => callback('add', fp))
      .on('change', (fp) => callback('change', fp))
      .on('unlink', (fp) => callback('unlink', fp))
      .on('addDir', (fp) => callback('addDir', fp))
      .on('unlinkDir', (fp) => callback('unlinkDir', fp))
      .on('error', (err) => callback('error', err.message))

    this.watchers.set(dirPath, watcher)
    return dirPath
  }

  unwatchDirectory(dirPath: string): void {
    const watcher = this.watchers.get(dirPath)
    if (watcher) {
      watcher.close()
      this.watchers.delete(dirPath)
    }
  }

  dispose(): void {
    for (const [dirPath, watcher] of this.watchers) {
      watcher.close()
      this.watchers.delete(dirPath)
    }
  }
}
