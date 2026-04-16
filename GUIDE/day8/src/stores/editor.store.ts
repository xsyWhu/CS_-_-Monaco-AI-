import { create } from 'zustand'

// Day 8: 新增 pendingDiffs —— 由 Agent 工具修改文件后产生的待审核变更列表。
interface EditorState {
  isSidebarOpen: boolean
  isChatOpen: boolean
  openFilePath: string | null
  openFileContent: string
  activeSidebarPanel: 'files' | 'git'
  /** Day 8: 等待用户审核的文件变更队列。 */
  pendingDiffs: FileChangeInfo[]
  /** Day 8: 当前正在审核的 diff（显示 InlineDiffView）。 */
  activeDiff: FileChangeInfo | null
  setSidebarOpen: (open: boolean) => void
  setChatOpen: (open: boolean) => void
  setOpenFile: (filePath: string, content: string) => void
  setOpenFileContent: (content: string) => void
  setActiveSidebarPanel: (panel: 'files' | 'git') => void
  /** Day 8: 添加一个待审核变更。 */
  addPendingDiff: (info: FileChangeInfo) => void
  /** Day 8: 开始审核某个 diff（设为 activeDiff）。 */
  reviewDiff: (filePath: string) => void
  /** Day 8: 接受当前 diff（从队列中移除，关闭审核视图）。 */
  acceptDiff: () => void
  /** Day 8: 拒绝当前 diff（恢复文件内容，从队列中移除）。 */
  rejectDiff: () => void
  /** Day 8: 清空所有 pending diffs。 */
  clearDiffs: () => void
}

export const useEditorStore = create<EditorState>((set, get) => ({
  isSidebarOpen: true,
  isChatOpen: false,
  openFilePath: null,
  openFileContent: '',
  activeSidebarPanel: 'files',
  pendingDiffs: [],
  activeDiff: null,

  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  setChatOpen: (open) => set({ isChatOpen: open }),
  setOpenFile: (filePath, content) =>
    set({
      openFilePath: filePath,
      openFileContent: content,
    }),
  setOpenFileContent: (content) => set({ openFileContent: content }),
  setActiveSidebarPanel: (panel) => set({ activeSidebarPanel: panel }),

  addPendingDiff: (info) =>
    set((state) => ({
      // 如果同一文件已有 pending diff，替换为最新。
      pendingDiffs: [
        ...state.pendingDiffs.filter((d) => d.filePath !== info.filePath),
        info,
      ],
    })),

  reviewDiff: (filePath) => {
    const diff = get().pendingDiffs.find((d) => d.filePath === filePath)
    if (diff) set({ activeDiff: diff })
  },

  acceptDiff: () => {
    const { activeDiff, pendingDiffs } = get()
    if (!activeDiff) return
    set({
      activeDiff: null,
      pendingDiffs: pendingDiffs.filter((d) => d.filePath !== activeDiff.filePath),
      // 更新编辑器内容为新内容。
      openFileContent: activeDiff.newContent,
    })
  },

  rejectDiff: () => {
    const { activeDiff, pendingDiffs } = get()
    if (!activeDiff) return
    // 通过 IPC 恢复旧内容。
    window.api.revertFileChange(activeDiff.filePath, activeDiff.oldContent)
    set({
      activeDiff: null,
      pendingDiffs: pendingDiffs.filter((d) => d.filePath !== activeDiff.filePath),
      // 编辑器内容恢复为旧内容。
      openFileContent: activeDiff.oldContent,
    })
  },

  clearDiffs: () => set({ pendingDiffs: [], activeDiff: null }),
}))