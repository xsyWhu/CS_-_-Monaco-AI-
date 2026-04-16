import { readdir, readFile, stat } from 'fs/promises'
import { isAbsolute, relative, resolve, sep } from 'path'

export interface FileTreeNode {
  name: string
  path: string
  relativePath: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
}

const EXCLUDED_DIRECTORIES = new Set(['node_modules', '.git', 'out', 'dist'])

export class FileSystemService {
  private readonly workspaceRoot: string

  constructor(workspaceRoot = process.cwd()) {
    this.workspaceRoot = resolve(workspaceRoot)
  }

  getWorkspaceRoot(): string {
    return this.workspaceRoot
  }

  async getFileTree(): Promise<FileTreeNode[]> {
    return this.readDirectory(this.workspaceRoot)
  }

  async readTextFile(filePath: string): Promise<string> {
    const absolutePath = this.ensureInsideWorkspace(filePath)
    const fileStat = await stat(absolutePath)

    if (fileStat.isDirectory()) {
      throw new Error('不能读取目录，请选择具体文件。')
    }

    return readFile(absolutePath, 'utf-8')
  }

  private ensureInsideWorkspace(targetPath: string): string {
    const absolutePath = isAbsolute(targetPath)
      ? resolve(targetPath)
      : resolve(this.workspaceRoot, targetPath)

    const rel = relative(this.workspaceRoot, absolutePath)

    if (rel.startsWith('..') || isAbsolute(rel)) {
      throw new Error('访问路径超出工作区范围。')
    }

    return absolutePath
  }

  private async readDirectory(directoryPath: string): Promise<FileTreeNode[]> {
    const entries = await readdir(directoryPath, { withFileTypes: true })

    const visibleEntries = entries
      .filter((entry) => {
        if (entry.name === '.DS_Store') {
          return false
        }

        if (entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)) {
          return false
        }

        return true
      })
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) {
          return -1
        }

        if (!a.isDirectory() && b.isDirectory()) {
          return 1
        }

        return a.name.localeCompare(b.name)
      })

    const tree: FileTreeNode[] = []

    for (const entry of visibleEntries) {
      const fullPath = resolve(directoryPath, entry.name)
      const relativePath = relative(this.workspaceRoot, fullPath).split(sep).join('/')

      if (entry.isDirectory()) {
        let children: FileTreeNode[] = []

        try {
          children = await this.readDirectory(fullPath)
        } catch {
          // 某些目录可能无权限访问，教学阶段忽略并继续展示其它节点。
          children = []
        }

        tree.push({
          name: entry.name,
          path: fullPath,
          relativePath,
          type: 'directory',
          children
        })
        continue
      }

      tree.push({
        name: entry.name,
        path: fullPath,
        relativePath,
        type: 'file'
      })
    }

    return tree
  }
}
