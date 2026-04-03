import { create } from 'zustand'
import type { GitStatus, GitBranch, GitLogEntry } from '@/types/electron'

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
  commit: (repoPath: string, message: string) => Promise<void>
  checkout: (repoPath: string, branch: string) => Promise<void>
  getDiff: (repoPath: string, filePath?: string) => Promise<void>
}

export const useGitStore = create<GitState>((set) => ({
  status: null,
  branches: [],
  log: [],
  diff: '',
  loading: false,

  refreshStatus: async (repoPath: string) => {
    try {
      set({ loading: true })
      const status = await window.api.gitStatus(repoPath)
      set({ status, loading: false })
    } catch (error) {
      console.error('Failed to refresh git status:', error)
      set({ loading: false })
    }
  },

  refreshBranches: async (repoPath: string) => {
    try {
      set({ loading: true })
      const branches = await window.api.gitBranches(repoPath)
      set({ branches, loading: false })
    } catch (error) {
      console.error('Failed to refresh branches:', error)
      set({ loading: false })
    }
  },

  refreshLog: async (repoPath: string) => {
    try {
      set({ loading: true })
      const log = await window.api.gitLog(repoPath)
      set({ log, loading: false })
    } catch (error) {
      console.error('Failed to refresh git log:', error)
      set({ loading: false })
    }
  },

  stageFiles: async (repoPath: string, files: string[]) => {
    try {
      await window.api.gitAdd(repoPath, files)
    } catch (error) {
      console.error('Failed to stage files:', error)
    }
  },

  commit: async (repoPath: string, message: string) => {
    try {
      await window.api.gitCommit(repoPath, message)
    } catch (error) {
      console.error('Failed to commit:', error)
    }
  },

  checkout: async (repoPath: string, branch: string) => {
    try {
      await window.api.gitCheckout(repoPath, branch)
    } catch (error) {
      console.error('Failed to checkout branch:', error)
    }
  },

  getDiff: async (repoPath: string, filePath?: string) => {
    try {
      const diff = await window.api.gitDiff(repoPath, filePath)
      set({ diff })
    } catch (error) {
      console.error('Failed to get diff:', error)
      set({ diff: '' })
    }
  },
}))
