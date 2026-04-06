import simpleGit, { SimpleGit } from 'simple-git'

export interface GitStatusResult {
  current: string | null
  tracking: string | null
  ahead: number
  behind: number
  files: Array<{
    path: string
    index: string
    working_dir: string
  }>
  modified: string[]
  staged: string[]
  untracked: string[]
  conflicted: string[]
  renamed: Array<{ from: string; to: string }>
  deleted: string[]
  isClean: boolean
}

export interface GitBranchInfo {
  name: string
  current: boolean
  commit: string
  label: string
}

export interface GitLogEntry {
  hash: string
  date: string
  message: string
  author: string
  email: string
}

export default class GitService {
  private getGit(repoPath: string): SimpleGit {
    return simpleGit(repoPath)
  }

  async status(repoPath: string): Promise<GitStatusResult> {
    try {
      const git = this.getGit(repoPath)
      const result = await git.status()

      return {
        current: result.current,
        tracking: result.tracking,
        ahead: result.ahead,
        behind: result.behind,
        files: result.files.map((file) => ({
          path: file.path,
          index: file.index,
          working_dir: file.working_dir,
        })),
        modified: result.modified,
        staged: result.staged,
        untracked: result.not_added,
        conflicted: result.conflicted,
        renamed: result.renamed.map((r) => ({ from: r.from, to: r.to })),
        deleted: result.deleted,
        isClean: result.isClean(),
      }
    } catch (error) {
      throw new Error(`Failed to get git status for "${repoPath}": ${(error as Error).message}`)
    }
  }

  async diff(repoPath: string, filePath?: string): Promise<string> {
    try {
      const git = this.getGit(repoPath)
      if (filePath) {
        return await git.diff([filePath])
      }
      return await git.diff()
    } catch (error) {
      throw new Error(`Failed to get diff: ${(error as Error).message}`)
    }
  }

  async add(repoPath: string, files: string[]): Promise<void> {
    try {
      const git = this.getGit(repoPath)
      await git.add(files)
    } catch (error) {
      throw new Error(`Failed to stage files: ${(error as Error).message}`)
    }
  }

  async commit(repoPath: string, message: string): Promise<string> {
    try {
      const git = this.getGit(repoPath)
      const result = await git.commit(message)
      return result.commit
    } catch (error) {
      throw new Error(`Failed to commit: ${(error as Error).message}`)
    }
  }

  async branches(repoPath: string): Promise<GitBranchInfo[]> {
    try {
      const git = this.getGit(repoPath)
      const result = await git.branch()

      return Object.values(result.branches).map((b) => ({
        name: b.name,
        current: b.current,
        commit: b.commit,
        label: b.label,
      }))
    } catch (error) {
      throw new Error(`Failed to list branches: ${(error as Error).message}`)
    }
  }

  async checkout(repoPath: string, branch: string): Promise<void> {
    try {
      const git = this.getGit(repoPath)
      await git.checkout(branch)
    } catch (error) {
      throw new Error(`Failed to checkout branch "${branch}": ${(error as Error).message}`)
    }
  }

  async log(repoPath: string, maxCount: number = 50): Promise<GitLogEntry[]> {
    try {
      const git = this.getGit(repoPath)
      const result = await git.log({ maxCount })

      return result.all.map((entry) => ({
        hash: entry.hash,
        date: entry.date,
        message: entry.message,
        author: entry.author_name,
        email: entry.author_email,
      }))
    } catch (error) {
      throw new Error(`Failed to get git log: ${(error as Error).message}`)
    }
  }
}
