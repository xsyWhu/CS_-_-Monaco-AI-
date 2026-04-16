import { create } from 'zustand'

// Day 7: 新增侧边栏活动面板（files | git）状态。
interface EditorState {
  isSidebarOpen: boolean
  isChatOpen: boolean
  openFilePath: string | null
  openFileContent: string
  activeSidebarPanel: 'files' | 'git'
  setSidebarOpen: (open: boolean) => void
  setChatOpen: (open: boolean) => void
  setOpenFile: (filePath: string, content: string) => void
  setOpenFileContent: (content: string) => void
  setActiveSidebarPanel: (panel: 'files' | 'git') => void
}

export const useEditorStore = create<EditorState>((set) => ({
  isSidebarOpen: true,
  isChatOpen: false,
  openFilePath: null,
  openFileContent: '',
  activeSidebarPanel: 'files',
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  setChatOpen: (open) => set({ isChatOpen: open }),
  setOpenFile: (filePath, content) =>
    set({
      openFilePath: filePath,
      openFileContent: content
    }),
  setOpenFileContent: (content) => set({ openFileContent: content }),
  setActiveSidebarPanel: (panel) => set({ activeSidebarPanel: panel }),
}))