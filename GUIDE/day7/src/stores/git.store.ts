/**
 * Day 7: Git 全局状态管理。
 *
 * 提供 status / diff / branches / log 的缓存与操作方法，
 * 供 GitPanel 组件读取，避免每次渲染都重复调用 IPC。
 */

import { create } from "zustand"

interface GitState {
  status: GitStatus | null
  branches: GitBranch[]
  log: GitLogEntry[]
  diff: string
  loading: boolean

  refreshStatus: (repoPath: string) => Promise<void>
  refreshBranches: (repoPath: string) => Promise<void>
  refreshLog: (repoPath: string) => Promise<void>
  stageFiles: (repoPath: string, files: string[]) => Promise<void>
  unstageFiles: (repoPath: string, files: string[]) => Promise<void>
  commit: (repoPath: string, message: string) => Promise<void>
  checkout: (repoPath: string, branch: string) => Promise<void>
  getDiff: (repoPath: string, filePath?: string) => Promise<void>
}

export const useGitStore = create<GitState>((set) => ({
  status: null,
  branches: [],
  log: [],
  diff: "",
  loading: false,

  refreshStatus: async (repoPath: string) => {
    try {
      set({ loading: true })
      const status = await window.api.gitStatus(repoPath)
      set({ status, loading: false })
    } catch {
      set({ status: null, loading: false })
    }
  },

  refreshBranches: async (repoPath: string) => {
    try {
      const branches = await window.api.gitBranches(repoPath)
      set({ branches })
    } catch {
      set({ branches: [] })
    }
  },

  refreshLog: async (repoPath: string) => {
    try {
      const log = await window.api.gitLog(repoPath, 20)
      set({ log })
    } catch {
      set({ log: [] })
    }
  },

  stageFiles: async (repoPath: string, files: string[]) => {
    await window.api.gitAdd(repoPath, files)
  },

  // simple-git 用 git add -p 或传 '.' 等方式 unstage；
  // 最简单的 Day 7 实现：重新 add（已在 index 的文件用 git reset 才能真正取消暂存）。
  // 此处暂不实现完整 unstage，仅提供接口占位，保留扩展性。
  unstageFiles: async (_repoPath: string, _files: string[]) => {
    // TODO: 实现 git reset HEAD <file>
  },

  commit: async (repoPath: string, message: string) => {
    await window.api.gitCommit(repoPath, message)
  },

  checkout: async (repoPath: string, branch: string) => {
    await window.api.gitCheckout(repoPath, branch)
  },

  getDiff: async (repoPath: string, filePath?: string) => {
    try {
      const diff = await window.api.gitDiff(repoPath, filePath)
      set({ diff })
    } catch {
      set({ diff: "" })
    }
  },
}))
