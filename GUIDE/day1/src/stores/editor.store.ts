import { create } from 'zustand'

// 定义编辑器 UI 相关的最小全局状态结构。
interface EditorState {
  isSidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

// Day 1 仅维护一个状态位，用于演示 Zustand 的读写闭环。
export const useEditorStore = create<EditorState>((set) => ({
  isSidebarOpen: true,
  setSidebarOpen: (open) => set({ isSidebarOpen: open })
}))
