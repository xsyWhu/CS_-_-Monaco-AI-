import { create } from 'zustand'
import type { CursorPosition, EditorProblem, FileTab, OutlineItem } from '../types/editor.types'
import { generateId, getLanguageFromFileName } from '../lib/utils'
import { getSavedWorkspacePath } from './file-tree.store'

export type EditorPane = 'left' | 'right'

interface PaneState {
  left: string[]
  right: string[]
}

interface ClosedTab {
  filePath: string
  fileName: string
  language: string
  isPinned?: boolean
  position?: CursorPosition
}

interface EditorSession {
  workspacePath: string | null
  tabs: Array<{
    filePath: string
    fileName: string
    language: string
    isPinned?: boolean
    position?: CursorPosition
  }>
  activeTabId: string | null
  focusedPane: EditorPane
  splitEnabled: boolean
  paneTabs: PaneState
  recentFiles: string[]
  closedTabs: ClosedTab[]
  tabCursorPositions: Record<string, CursorPosition>
}

interface EditorState {
  tabs: FileTab[]
  activeTabId: string | null
  focusedPane: EditorPane
  splitEnabled: boolean
  paneTabs: PaneState
  cursorPosition: CursorPosition
  problems: EditorProblem[]
  outlineItems: OutlineItem[]
  recentFiles: string[]
  closedTabs: ClosedTab[]
  tabCursorPositions: Record<string, CursorPosition>
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
  openFileInPane: (filePath: string, pane: EditorPane) => Promise<void>
  openFileAtPositionInPane: (
    filePath: string,
    line: number,
    column: number,
    pane: EditorPane,
  ) => Promise<void>
  closeTab: (tabId: string) => Promise<void>
  setActiveTab: (tabId: string) => void
  setFocusedPane: (pane: EditorPane) => void
  toggleSplitView: () => void
  setPaneTabs: (pane: EditorPane, tabIds: string[]) => void
  updateTabContent: (tabId: string, content: string) => void
  saveTab: (tabId: string) => Promise<void>
  saveAllTabs: () => Promise<void>
  hasDirtyTabs: () => boolean
  confirmAndHandleDirtyTabs: () => Promise<boolean>
  pruneTabsByWorkspace: (workspacePath: string) => void
  reloadFileFromDisk: (filePath: string) => Promise<void>
  setCursorPosition: (position: CursorPosition) => void
  setTabCursorPosition: (tabId: string, position: CursorPosition) => void
  setProblems: (problems: EditorProblem[]) => void
  setOutlineItems: (items: OutlineItem[]) => void
  togglePinTab: (tabId: string) => void
  setTabPinned: (tabId: string, pinned: boolean) => void
  closeOtherTabs: (tabId: string, pane: EditorPane) => Promise<void>
  closeTabsToRight: (tabId: string, pane: EditorPane) => Promise<void>
  reopenClosedTab: () => Promise<void>
  restoreSessionForWorkspace: (workspacePath: string) => Promise<void>
  clearPendingReveal: () => void
  moveTabToPane: (tabId: string, pane: EditorPane) => void
}

const SESSION_KEY = 'agent-ide.editor.session.v1'
const MAX_RECENT_FILES = 20
const MAX_CLOSED_TABS = 20

function normalizePath(input: string): string {
  return input.replace(/\\/g, '/').toLowerCase()
}

function isInsideWorkspace(filePath: string, workspacePath: string): boolean {
  const file = normalizePath(filePath)
  const workspace = normalizePath(workspacePath).replace(/\/+$/, '')
  return file === workspace || file.startsWith(`${workspace}/`)
}

function loadSession(): EditorSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as EditorSession
  } catch {
    return null
  }
}

function persistSession(state: EditorState): void {
  try {
    const session: EditorSession = {
      workspacePath: getSavedWorkspacePath(),
      tabs: state.tabs.map((tab) => ({
        filePath: tab.filePath,
        fileName: tab.fileName,
        language: tab.language,
        isPinned: !!tab.isPinned,
        position: state.tabCursorPositions[tab.id],
      })),
      activeTabId: state.tabs.find((tab) => tab.id === state.activeTabId)?.filePath ?? null,
      focusedPane: state.focusedPane,
      splitEnabled: state.splitEnabled,
      paneTabs: state.paneTabs,
      recentFiles: state.recentFiles,
      closedTabs: state.closedTabs,
      tabCursorPositions: state.tabCursorPositions,
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // Ignore storage failures
  }
}

function updateRecentFiles(recentFiles: string[], filePath: string): string[] {
  return [filePath, ...recentFiles.filter((item) => item !== filePath)].slice(0, MAX_RECENT_FILES)
}

function findTabByFilePath(tabs: FileTab[], filePath: string): FileTab | undefined {
  return tabs.find((tab) => normalizePath(tab.filePath) === normalizePath(filePath))
}

function getCurrentTabPosition(
  tabCursorPositions: Record<string, CursorPosition>,
  tabId: string,
): CursorPosition {
  return tabCursorPositions[tabId] ?? { line: 1, column: 1 }
}

function getPaneForTab(paneTabs: PaneState, tabId: string): EditorPane | null {
  if (paneTabs.left.includes(tabId)) return 'left'
  if (paneTabs.right.includes(tabId)) return 'right'
  return null
}

function removeTabId(paneTabs: PaneState, tabId: string): PaneState {
  return {
    left: paneTabs.left.filter((id) => id !== tabId),
    right: paneTabs.right.filter((id) => id !== tabId),
  }
}

function prependTabId(ids: string[], tabId: string): string[] {
  return [tabId, ...ids.filter((id) => id !== tabId)]
}

function sanitizePaneTabs(paneTabs: PaneState, tabs: FileTab[]): PaneState {
  const validIds = new Set(tabs.map((tab) => tab.id))
  const left = paneTabs.left.filter((id) => validIds.has(id))
  const right = paneTabs.right.filter((id) => validIds.has(id) && !left.includes(id))
  return { left, right }
}

function getActiveTabIdForPane(paneTabs: PaneState, pane: EditorPane): string | null {
  return paneTabs[pane][0] ?? null
}

function getNextTabIdInPane(
  paneTabs: PaneState,
  pane: EditorPane,
  removedTabId: string,
): string | null {
  const ids = paneTabs[pane].filter((id) => id !== removedTabId)
  return ids[0] ?? null
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  focusedPane: 'left',
  splitEnabled: false,
  paneTabs: { left: [], right: [] },
  cursorPosition: { line: 1, column: 1 },
  problems: [],
  outlineItems: [],
  recentFiles: [],
  closedTabs: [],
  tabCursorPositions: {},
  pendingReveal: null,

  openFile: async (filePath) => {
    await get().openFileInPane(filePath, get().focusedPane)
  },

  openFileAtPosition: async (filePath, line, column) => {
    await get().openFileAtPositionInPane(filePath, line, column, get().focusedPane)
  },

  openFileInPane: async (filePath, pane) => {
    const existing = get().tabs.find((tab) => normalizePath(tab.filePath) === normalizePath(filePath))
    if (existing) {
      set((state) => {
        const paneTabs = sanitizePaneTabs(removeTabId(state.paneTabs, existing.id), state.tabs)
        return {
          splitEnabled: state.splitEnabled || pane === 'right',
          focusedPane: pane,
          activeTabId: existing.id,
          paneTabs: {
            ...paneTabs,
            [pane]: prependTabId(paneTabs[pane], existing.id),
          },
          recentFiles: updateRecentFiles(state.recentFiles, filePath),
        }
      })
      persistSession(get())
      return
    }

    const content = await window.api.readFile(filePath)
    const fileName = filePath.split(/[/\\]/).pop() || filePath
    const language = getLanguageFromFileName(fileName)
    const id = generateId()
    const newTab: FileTab = {
      id,
      filePath,
      fileName,
      language,
      content,
      isDirty: false,
      isActive: true,
      isPinned: false,
    }

    set((state) => {
      const tabs = [...state.tabs.map((tab) => ({ ...tab, isActive: false })), newTab]
      const paneTabs = sanitizePaneTabs(removeTabId(state.paneTabs, id), tabs)
      return {
        tabs,
        splitEnabled: state.splitEnabled || pane === 'right',
        focusedPane: pane,
        activeTabId: id,
        paneTabs: {
          ...paneTabs,
          [pane]: prependTabId(paneTabs[pane], id),
        },
        recentFiles: updateRecentFiles(state.recentFiles, filePath),
      }
    })
    persistSession(get())
  },

  openFileAtPositionInPane: async (filePath, line, column, pane) => {
    await get().openFileInPane(filePath, pane)
    set({
      pendingReveal: {
        filePath,
        line,
        column,
        requestId: Date.now() + Math.floor(Math.random() * 1000),
      },
    })
    persistSession(get())
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

    const { tabs, activeTabId, paneTabs, focusedPane } = get()
    const currentPane = getPaneForTab(paneTabs, tabId)
    const filteredTabs = tabs.filter((tab) => tab.id !== tabId)
    const nextActivePaneTabs = removeTabId(paneTabs, tabId)

    let nextFocusedPane = focusedPane
    let nextActiveTabId = activeTabId

    if (activeTabId === tabId) {
      const pane = currentPane ?? focusedPane
      const nextId = getNextTabIdInPane(nextActivePaneTabs, pane, tabId)
      const fallbackPane = pane === 'left' ? 'right' : 'left'
      nextActiveTabId =
        nextId ??
        getActiveTabIdForPane(nextActivePaneTabs, fallbackPane) ??
        filteredTabs[filteredTabs.length - 1]?.id ??
        null
      nextFocusedPane =
        nextId || nextActiveTabId === getActiveTabIdForPane(nextActivePaneTabs, fallbackPane)
          ? pane
          : fallbackPane
    }

    const closedTab: ClosedTab = {
      filePath: targetTab.filePath,
      fileName: targetTab.fileName,
      language: targetTab.language,
      isPinned: !!targetTab.isPinned,
      position: getCurrentTabPosition(get().tabCursorPositions, tabId),
    }

    const nextTabs = filteredTabs.map((tab) => ({
      ...tab,
      isActive: tab.id === nextActiveTabId,
    }))

    set({
      tabs: nextTabs,
      activeTabId: nextActiveTabId,
      focusedPane: nextFocusedPane,
      paneTabs: sanitizePaneTabs(nextActivePaneTabs, nextTabs),
      problems: get().problems.filter((problem) => problem.filePath !== targetTab.filePath),
      closedTabs: [closedTab, ...get().closedTabs.filter((t) => normalizePath(t.filePath) !== normalizePath(targetTab.filePath))].slice(0, MAX_CLOSED_TABS),
    })
    persistSession(get())
  },

  setActiveTab: (tabId) => {
    const pane = getPaneForTab(get().paneTabs, tabId)
    if (!pane) return
    set((state) => ({
      focusedPane: pane,
      activeTabId: tabId,
      paneTabs: {
        ...state.paneTabs,
        [pane]: prependTabId(state.paneTabs[pane], tabId),
      },
      tabs: state.tabs.map((tab) => ({ ...tab, isActive: tab.id === tabId })),
    }))
    persistSession(get())
  },

  setFocusedPane: (pane) => {
    const paneTabId = getActiveTabIdForPane(get().paneTabs, pane)
    set((state) => ({
      focusedPane: pane,
      activeTabId: paneTabId ?? state.activeTabId,
      tabs: state.tabs.map((tab) => ({ ...tab, isActive: tab.id === (paneTabId ?? state.activeTabId) })),
    }))
  },

  toggleSplitView: () => {
    const { splitEnabled, paneTabs, activeTabId, tabs, focusedPane } = get()
    if (!splitEnabled) {
      const otherTab = tabs.find((tab) => tab.id !== activeTabId)
      const nextPaneTabs = {
        left: activeTabId ? [activeTabId] : [],
        right: otherTab ? [otherTab.id] : [],
      }
      set({
        splitEnabled: true,
        focusedPane,
        paneTabs: sanitizePaneTabs(nextPaneTabs, tabs),
      })
    } else {
      const nextActive = activeTabId ?? paneTabs.left[0] ?? paneTabs.right[0] ?? null
      set({
        splitEnabled: false,
        focusedPane: 'left',
        activeTabId: nextActive,
        paneTabs: { left: nextActive ? [nextActive] : [], right: [] },
      })
    }
    persistSession(get())
  },

  setPaneTabs: (pane, tabIds) => {
    set((state) => {
      const nextPaneTabs = sanitizePaneTabs({ ...state.paneTabs, [pane]: tabIds }, state.tabs)
      const nextActive = nextPaneTabs[pane][0] ?? state.activeTabId
      return {
        paneTabs: nextPaneTabs,
        splitEnabled: state.splitEnabled || pane === 'right',
        focusedPane: pane,
        activeTabId: nextActive,
        tabs: state.tabs.map((tab) => ({ ...tab, isActive: tab.id === nextActive })),
      }
    })
    persistSession(get())
  },

  moveTabToPane: (tabId, pane) => {
    set((state) => {
      const nextPaneTabs = removeTabId(state.paneTabs, tabId)
      nextPaneTabs[pane] = prependTabId(nextPaneTabs[pane], tabId)
      return {
        splitEnabled: state.splitEnabled || pane === 'right',
        paneTabs: sanitizePaneTabs(nextPaneTabs, state.tabs),
        focusedPane: pane,
        activeTabId: tabId,
        tabs: state.tabs.map((tab) => ({ ...tab, isActive: tab.id === tabId })),
      }
    })
    persistSession(get())
  },

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
    persistSession(get())
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
    persistSession(get())
  },

  hasDirtyTabs: () => get().tabs.some((t) => t.isDirty),

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
    const { tabs, activeTabId, paneTabs, focusedPane } = get()
    const filtered = tabs.filter((t) => isInsideWorkspace(t.filePath, workspacePath))
    const validIds = new Set(filtered.map((tab) => tab.id))

    const sanitizedPaneTabs = {
      left: paneTabs.left.filter((id) => validIds.has(id)),
      right: paneTabs.right.filter((id) => validIds.has(id)),
    }

    const nextActiveTabId =
      (activeTabId && validIds.has(activeTabId) ? activeTabId : null) ??
      sanitizedPaneTabs[focusedPane][0] ??
      sanitizedPaneTabs.left[0] ??
      sanitizedPaneTabs.right[0] ??
      null

    set({
      tabs: filtered.map((t) => ({ ...t, isActive: t.id === nextActiveTabId })),
      activeTabId: nextActiveTabId,
      focusedPane,
      paneTabs: sanitizePaneTabs(sanitizedPaneTabs, filtered),
      problems: get().problems.filter((p) => isInsideWorkspace(p.filePath, workspacePath)),
      closedTabs: get().closedTabs.filter((t) => isInsideWorkspace(t.filePath, workspacePath)),
      recentFiles: get().recentFiles.filter((filePath) => isInsideWorkspace(filePath, workspacePath)),
      tabCursorPositions: Object.fromEntries(
        Object.entries(get().tabCursorPositions).filter(([filePath]) =>
          isInsideWorkspace(filePath, workspacePath),
        ),
      ),
    })
    persistSession(get())
  },

  reloadFileFromDisk: async (filePath) => {
    const { tabs, activeTabId, paneTabs } = get()
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
          : paneTabs.left.find((id) => id !== target.id) ??
            paneTabs.right.find((id) => id !== target.id) ??
            filtered[filtered.length - 1]?.id ??
            null

      set({
        tabs: filtered.map((t) => ({ ...t, isActive: t.id === nextActiveId })),
        activeTabId: nextActiveId,
        focusedPane: getPaneForTab(removeTabId(paneTabs, target.id), nextActiveId ?? '') ?? 'left',
        paneTabs: sanitizePaneTabs(removeTabId(paneTabs, target.id), filtered),
        problems: get().problems.filter((p) => normalizePath(p.filePath) !== normalizePath(filePath)),
        tabCursorPositions: Object.fromEntries(
          Object.entries(get().tabCursorPositions).filter(([path]) => normalizePath(path) !== normalizePath(filePath)),
        ),
      })
      persistSession(get())
    }
  },

  setCursorPosition: (position) => {
    set({ cursorPosition: position })
  },

  setTabCursorPosition: (tabId, position) => {
    const tab = get().tabs.find((item) => item.id === tabId)
    if (!tab) return

    set((state) => ({
      tabCursorPositions: {
        ...state.tabCursorPositions,
        [tab.filePath]: position,
      },
    }))
    persistSession(get())
  },

  setProblems: (problems) => {
    set({ problems })
  },

  setOutlineItems: (items) => {
    set({ outlineItems: items })
  },

  togglePinTab: (tabId) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId ? { ...tab, isPinned: !tab.isPinned } : tab,
      ),
    }))
    persistSession(get())
  },

  setTabPinned: (tabId, pinned) => {
    set((state) => ({
      tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, isPinned: pinned } : tab)),
    }))
    persistSession(get())
  },

  closeOtherTabs: async (tabId, pane) => {
    const targetTab = get().tabs.find((tab) => tab.id === tabId)
    if (!targetTab) return

    const shouldContinue = await get().confirmAndHandleDirtyTabs()
    if (!shouldContinue) return

    set((state) => {
      const keepIds = new Set([tabId, ...state.paneTabs[getPaneForTab(state.paneTabs, tabId) ?? pane]])
      const nextTabs = state.tabs.filter((tab) => keepIds.has(tab.id) || tab.isPinned)
      const nextPaneTabs = {
        left: state.paneTabs.left.filter((id) => id === tabId || state.tabs.find((tab) => tab.id === id)?.isPinned),
        right: state.paneTabs.right.filter((id) => id === tabId || state.tabs.find((tab) => tab.id === id)?.isPinned),
      }

      return {
        tabs: nextTabs.map((tab) => ({ ...tab, isActive: tab.id === tabId })),
        activeTabId: tabId,
        focusedPane: pane,
        paneTabs: sanitizePaneTabs(nextPaneTabs, nextTabs),
        problems: state.problems.filter((problem) =>
          nextTabs.some((tab) => normalizePath(tab.filePath) === normalizePath(problem.filePath)),
        ),
      }
    })
    persistSession(get())
  },

  closeTabsToRight: async (tabId, pane) => {
    const paneList = get().paneTabs[pane]
    const index = paneList.findIndex((id) => id === tabId)
    if (index < 0) return

    const shouldContinue = await get().confirmAndHandleDirtyTabs()
    if (!shouldContinue) return

    const keepIds = new Set(paneList.slice(0, index + 1))
    set((state) => {
      const nextPaneTabs = {
        ...state.paneTabs,
        [pane]: state.paneTabs[pane].filter((id) => keepIds.has(id) || state.tabs.find((tab) => tab.id === id)?.isPinned),
      }
      const nextTabs = state.tabs.filter((tab) => {
        const belongsToPane = state.paneTabs.left.includes(tab.id) || state.paneTabs.right.includes(tab.id)
        if (!belongsToPane) return true
        if (state.paneTabs[pane].includes(tab.id)) {
          return keepIds.has(tab.id) || tab.isPinned
        }
        return true
      })
      return {
        tabs: nextTabs.map((tab) => ({ ...tab, isActive: tab.id === tabId })),
        activeTabId: tabId,
        focusedPane: pane,
        paneTabs: sanitizePaneTabs(nextPaneTabs, nextTabs),
        problems: state.problems.filter((problem) =>
          nextTabs.some((tab) => normalizePath(tab.filePath) === normalizePath(problem.filePath)),
        ),
      }
    })
    persistSession(get())
  },

  reopenClosedTab: async () => {
    const closedTabs = [...get().closedTabs]
    while (closedTabs.length > 0) {
      const latest = closedTabs.shift()
      if (!latest) break

      set({ closedTabs })
      try {
        if (latest.position) {
          await get().openFileAtPosition(latest.filePath, latest.position.line, latest.position.column)
        } else {
          await get().openFile(latest.filePath)
        }

        if (latest.isPinned) {
          const opened = findTabByFilePath(get().tabs, latest.filePath)
          if (opened) {
            set((state) => ({
              tabs: state.tabs.map((tab) =>
                tab.id === opened.id ? { ...tab, isPinned: true } : tab,
              ),
            }))
          }
        }

        persistSession(get())
        return
      } catch (error) {
        console.error(`Failed to reopen closed tab "${latest.filePath}":`, error)
      }
    }
  },

  restoreSessionForWorkspace: async (workspacePath) => {
    const session = loadSession()
    if (!session || !session.workspacePath) return
    if (normalizePath(session.workspacePath) !== normalizePath(workspacePath)) return
    if (get().tabs.length > 0) return

    for (const tab of session.tabs) {
      try {
        const content = await window.api.readFile(tab.filePath)
        const id = generateId()
        const newTab: FileTab = {
          id,
          filePath: tab.filePath,
          fileName: tab.fileName,
          language: tab.language,
          content,
          isDirty: false,
          isActive: false,
          isPinned: !!tab.isPinned,
        }
        set((state) => ({ tabs: [...state.tabs, newTab] }))
        if (tab.position) {
          set((state) => ({
            tabCursorPositions: {
              ...state.tabCursorPositions,
              [tab.filePath]: tab.position!,
            },
          }))
        }
      } catch (error) {
        console.error(`Failed to restore tab "${tab.filePath}":`, error)
      }
    }

    const restoredTabs = get().tabs
    const restoredIds = new Map(restoredTabs.map((tab) => [normalizePath(tab.filePath), tab.id]))
    const paneTabs: PaneState = {
      left: (session.paneTabs?.left ?? [])
        .map((filePathOrId) => restoredIds.get(normalizePath(filePathOrId)) ?? restoredTabs.find((tab) => tab.id === filePathOrId)?.id)
        .filter((id): id is string => !!id),
      right: (session.paneTabs?.right ?? [])
        .map((filePathOrId) => restoredIds.get(normalizePath(filePathOrId)) ?? restoredTabs.find((tab) => tab.id === filePathOrId)?.id)
        .filter((id): id is string => !!id),
    }

    const activeTabFilePath = session.activeTabId ?? null
    const activeTabId = activeTabFilePath
      ? restoredTabs.find((tab) => normalizePath(tab.filePath) === normalizePath(activeTabFilePath))?.id ?? null
      : paneTabs.left[0] ?? paneTabs.right[0] ?? null
    const focusedPane = session.focusedPane ?? 'left'
    const sanitized = sanitizePaneTabs(paneTabs, restoredTabs)
    const nextPaneTabs =
      session.splitEnabled ? sanitized : { left: activeTabId ? [activeTabId] : [], right: [] }

    set({
      tabs: restoredTabs.map((tab) => ({ ...tab, isActive: tab.id === activeTabId })),
      activeTabId,
      focusedPane,
      splitEnabled: session.splitEnabled ?? false,
      paneTabs: nextPaneTabs,
      recentFiles: session.recentFiles ?? [],
      closedTabs: session.closedTabs ?? [],
      tabCursorPositions: session.tabCursorPositions ?? {},
    })
    persistSession(get())
  },

  clearPendingReveal: () => set({ pendingReveal: null }),
}))
