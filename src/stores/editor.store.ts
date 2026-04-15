import { create } from 'zustand'
import type { CursorPosition, EditorProblem, FileTab } from '../types/editor.types'
import { generateId, getLanguageFromFileName } from '../lib/utils'

interface EditorState {
  tabs: FileTab[]
  activeTabId: string | null
  cursorPosition: CursorPosition
  problems: EditorProblem[]
  pendingReveal:
    | {
        filePath: string
        line: number
        column: number
        requestId: number
      }
    | null

  openFile: (filePath: string) => Promise<void>
  openFileAtPosition: (filePath: string, line: number, column: number) => Promise<void>
  closeTab: (tabId: string) => Promise<void>
  setActiveTab: (tabId: string) => void
  updateTabContent: (tabId: string, content: string) => void
  saveTab: (tabId: string) => Promise<void>
  saveAllTabs: () => Promise<void>
  hasDirtyTabs: () => boolean
  confirmAndHandleDirtyTabs: () => Promise<boolean>
  pruneTabsByWorkspace: (workspacePath: string) => void
  reloadFileFromDisk: (filePath: string) => Promise<void>
  setCursorPosition: (position: CursorPosition) => void
  setProblems: (problems: EditorProblem[]) => void
  clearPendingReveal: () => void
}

function normalizePath(input: string): string {
  return input.replace(/\\/g, '/').toLowerCase()
}

function isInsideWorkspace(filePath: string, workspacePath: string): boolean {
  const file = normalizePath(filePath)
  const workspace = normalizePath(workspacePath).replace(/\/+$/, '')
  return file === workspace || file.startsWith(`${workspace}/`)
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  cursorPosition: { line: 1, column: 1 },
  problems: [],
  pendingReveal: null,

  openFile: async (filePath) => {
    const { tabs } = get()
    const existing = tabs.find((t) => t.filePath === filePath)
    if (existing) {
      set({
        activeTabId: existing.id,
        tabs: tabs.map((t) => ({ ...t, isActive: t.id === existing.id })),
      })
      return
    }

    const content = await window.api.readFile(filePath)
    const fileName = filePath.split(/[/\\]/).pop() || filePath
    const language = getLanguageFromFileName(fileName)
    const id = generateId()
    const newTab: FileTab = { id, filePath, fileName, language, content, isDirty: false, isActive: true }

    set({
      tabs: [...tabs.map((t) => ({ ...t, isActive: false })), newTab],
      activeTabId: id,
    })
  },

  openFileAtPosition: async (filePath, line, column) => {
    await get().openFile(filePath)
    set({
      pendingReveal: {
        filePath,
        line,
        column,
        requestId: Date.now() + Math.floor(Math.random() * 1000),
      },
    })
  },

  closeTab: async (tabId) => {
    const targetTab = get().tabs.find((t) => t.id === tabId)
    if (!targetTab) return

    if (targetTab.isDirty) {
      const choice = await window.api.showUnsavedChangesDialog(targetTab.fileName)
      if (choice === 'cancel') return
      if (choice === 'save') {
        try {
          await get().saveTab(tabId)
        } catch (error) {
          console.error('Failed to save file before closing tab:', error)
          return
        }
      }
    }

    const { tabs, activeTabId } = get()
    const filtered = tabs.filter((t) => t.id !== tabId)
    let newActiveId = activeTabId
    if (activeTabId === tabId) {
      const idx = tabs.findIndex((t) => t.id === tabId)
      const next = filtered[Math.min(idx, filtered.length - 1)]
      newActiveId = next?.id ?? null
    }
    set({
      tabs: filtered.map((t) => ({ ...t, isActive: t.id === newActiveId })),
      activeTabId: newActiveId,
      problems: get().problems.filter((p) => p.filePath !== targetTab.filePath),
    })
  },

  setActiveTab: (tabId) =>
    set((state) => ({
      activeTabId: tabId,
      tabs: state.tabs.map((t) => ({ ...t, isActive: t.id === tabId })),
    })),

  updateTabContent: (tabId, content) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, content, isDirty: true } : t)),
    })),

  saveTab: async (tabId) => {
    const tab = get().tabs.find((t) => t.id === tabId)
    if (!tab) return
    await window.api.writeFile(tab.filePath, tab.content)
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, isDirty: false } : t)),
    }))
  },

  saveAllTabs: async () => {
    const dirtyTabs = get().tabs.filter((t) => t.isDirty)
    for (const tab of dirtyTabs) {
      await window.api.writeFile(tab.filePath, tab.content)
    }
    if (dirtyTabs.length > 0) {
      set((state) => ({
        tabs: state.tabs.map((t) => ({ ...t, isDirty: false })),
      }))
    }
  },

  hasDirtyTabs: () => {
    return get().tabs.some((t) => t.isDirty)
  },

  confirmAndHandleDirtyTabs: async () => {
    const dirtyTabs = get().tabs.filter((t) => t.isDirty)
    if (dirtyTabs.length === 0) return true

    const choice = await window.api.showUnsavedChangesDialog(
      `${dirtyTabs.length} unsaved file${dirtyTabs.length > 1 ? 's' : ''}`,
    )
    if (choice === 'cancel') return false

    if (choice === 'save') {
      try {
        await get().saveAllTabs()
      } catch (error) {
        console.error('Failed to save all tabs:', error)
        return false
      }
    }

    return true
  },

  pruneTabsByWorkspace: (workspacePath) => {
    const { tabs, activeTabId } = get()
    const filtered = tabs.filter((t) => isInsideWorkspace(t.filePath, workspacePath))

    let nextActiveId = activeTabId
    if (!nextActiveId || !filtered.some((t) => t.id === nextActiveId)) {
      nextActiveId = filtered.length > 0 ? filtered[filtered.length - 1].id : null
    }

    set({
      tabs: filtered.map((t) => ({ ...t, isActive: t.id === nextActiveId })),
      activeTabId: nextActiveId,
      problems: get().problems.filter((p) => isInsideWorkspace(p.filePath, workspacePath)),
    })
  },

  reloadFileFromDisk: async (filePath) => {
    const { tabs, activeTabId } = get()
    const target = tabs.find((t) => normalizePath(t.filePath) === normalizePath(filePath))
    if (!target) return

    try {
      const latest = await window.api.readFile(target.filePath)
      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === target.id ? { ...t, content: latest, isDirty: false } : t,
        ),
      }))
    } catch (error) {
      console.error(`Failed to reload file "${filePath}" from disk:`, error)
      const filtered = tabs.filter((t) => t.id !== target.id)
      const nextActiveId =
        activeTabId && activeTabId !== target.id
          ? activeTabId
          : filtered.length > 0
            ? filtered[filtered.length - 1].id
            : null

      set({
        tabs: filtered.map((t) => ({ ...t, isActive: t.id === nextActiveId })),
        activeTabId: nextActiveId,
        problems: get().problems.filter((p) => normalizePath(p.filePath) !== normalizePath(filePath)),
      })
    }
  },

  setCursorPosition: (position) => {
    set({ cursorPosition: position })
  },

  setProblems: (problems) => {
    set({ problems })
  },

  clearPendingReveal: () => set({ pendingReveal: null }),
}))
