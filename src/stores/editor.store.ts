import { create } from 'zustand'
import type { FileTab } from '../types/editor.types'
import { generateId, getLanguageFromFileName } from '../lib/utils'

interface EditorState {
  tabs: FileTab[]
  activeTabId: string | null
  pendingReveal:
    | {
        filePath: string
        line: number
        column: number
      }
    | null

  openFile: (filePath: string) => Promise<void>
  openFileAtPosition: (filePath: string, line: number, column: number) => Promise<void>
  closeTab: (tabId: string) => Promise<void>
  setActiveTab: (tabId: string) => void
  updateTabContent: (tabId: string, content: string) => void
  saveTab: (tabId: string) => Promise<void>
  clearPendingReveal: () => void
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activeTabId: null,
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

  clearPendingReveal: () => set({ pendingReveal: null }),
}))
