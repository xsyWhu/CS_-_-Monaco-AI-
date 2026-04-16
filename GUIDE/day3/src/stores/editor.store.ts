import { create } from 'zustand'

// 定义编辑器 UI 相关的最小全局状态结构。
interface EditorState {
  isSidebarOpen: boolean
  openFilePath: string | null
  openFileContent: string
  setSidebarOpen: (open: boolean) => void
  setOpenFile: (filePath: string, content: string) => void
  setOpenFileContent: (content: string) => void
}

// Day 3: 在 UI 状态基础上增加“当前打开文件”的路径与内容。
export const useEditorStore = create<EditorState>((set) => ({
  isSidebarOpen: true,
  openFilePath: null,
  openFileContent: '',
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  setOpenFile: (filePath, content) =>
    set({
      openFilePath: filePath,
      openFileContent: content
    }),
  setOpenFileContent: (content) => set({ openFileContent: content })
}))
