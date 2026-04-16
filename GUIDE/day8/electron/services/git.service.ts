/**
 * Day 7: Git 服务——封装 simple-git 常用操作。
 *
 * 负责：status / diff / add / commit / branches / checkout / log
 * 每个方法都只接收 repoPath，不持有任何状态，调用方可复用同一实例。
 */

import simpleGit from "simple-git"

// ── 返回类型定义 ──────────────────────────────────────────────────────────────

export interface GitFileStatus {
  path: string
  /** index 区（暂存区）状态字符：' '=未改变, 'M'=修改, 'A'=新增, 'D'=删除, '?'=未跟踪 */
  index: string
  /** working_dir 区（工作区）状态字符 */
  working_dir: string
}

export interface GitStatus {
  current: string | null
  ahead: number
  behind: number
  files: GitFileStatus[]
  isClean: boolean
}

export interface GitBranch {
  name: string
  current: boolean
  commit: string
}

export interface GitLogEntry {
  hash: string
  date: string
  message: string
  author: string
}

// ── GitService 类 ─────────────────────────────────────────────────────────────

export default class GitService {
  async status(repoPath: string): Promise<GitStatus> {
    const git = simpleGit(repoPath)
    const result = await git.status()
    return {
      current: result.current,
      ahead: result.ahead,
      behind: result.behind,
      files: result.files.map((f) => ({
        path: f.path,
        index: f.index,
        working_dir: f.working_dir,
      })),
      isClean: result.isClean(),
    }
  }

  async diff(repoPath: string, filePath?: string): Promise<string> {
    const git = simpleGit(repoPath)
    // filePath 为空时返回全量 diff；否则只 diff 指定文件。
    return filePath ? git.diff([filePath]) : git.diff()
  }

  async add(repoPath: string, files: string[]): Promise<void> {
    await simpleGit(repoPath).add(files)
  }

  async commit(repoPath: string, message: string): Promise<string> {
    const result = await simpleGit(repoPath).commit(message)
    return result.commit
  }

  async branches(repoPath: string): Promise<GitBranch[]> {
    const result = await simpleGit(repoPath).branch()
    return Object.values(result.branches).map((b) => ({
      name: b.name,
      current: b.current,
      commit: b.commit,
    }))
  }

  async checkout(repoPath: string, branch: string): Promise<void> {
    await simpleGit(repoPath).checkout(branch)
  }

  async log(repoPath: string, maxCount = 20): Promise<GitLogEntry[]> {
    const result = await simpleGit(repoPath).log({ maxCount })
    return result.all.map((e) => ({
      hash: e.hash.slice(0, 7),
      date: e.date,
      message: e.message,
      author: e.author_name,
    }))
  }
}
