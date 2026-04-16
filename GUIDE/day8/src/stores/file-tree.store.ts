/**
 * Day 5: 文件树全局状态。
 *
 * 将 workspaceRoot 从 FileExplorer 本地 state 提升到 Zustand store，
 * 使工具调用（useChat → sendMessage → 主进程）能读取工作区路径。
 */
import { create } from 'zustand'

interface FileTreeState {
  workspaceRoot: string
  setWorkspaceRoot: (root: string) => void
}

export const useFileTreeStore = create<FileTreeState>((set) => ({
  workspaceRoot: '',
  setWorkspaceRoot: (root) => set({ workspaceRoot: root }),
}))
