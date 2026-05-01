import { create } from 'zustand'
import type { ProviderSettings } from '@/types/agent.types'

export type SidebarPanel = 'files' | 'outline' | 'search' | 'problems' | 'git'
export type AutoSaveMode = 'off' | 'afterDelay' | 'onFocusChange'

interface EditorPreferences {
  autoSaveMode: AutoSaveMode
  autoSaveDelay: number
  formatOnSave: boolean
}

interface SettingsState {
  provider: ProviderSettings | null
  workspacePath: string
  autoSaveMode: AutoSaveMode
  autoSaveDelay: number
  formatOnSave: boolean
  sidebarVisible: boolean
  chatVisible: boolean
  terminalVisible: boolean
  activeSidebarPanel: SidebarPanel
  loadSettings: () => Promise<void>
  updateProvider: (provider: ProviderSettings) => Promise<void>
  setAutoSaveMode: (mode: AutoSaveMode) => void
  setAutoSaveDelay: (delay: number) => void
  setFormatOnSave: (enabled: boolean) => void
  setWorkspacePath: (path: string) => void
  toggleSidebar: () => void
  toggleChatPanel: () => void
  toggleTerminal: () => void
  setActiveSidebarPanel: (panel: SidebarPanel) => void
  setSidebarPanel: (panel: SidebarPanel) => void
}

const EDITOR_PREFS_KEY = 'agent-ide.editor.preferences.v1'

function loadEditorPreferences(): EditorPreferences {
  try {
    const raw = localStorage.getItem(EDITOR_PREFS_KEY)
    if (!raw) return { autoSaveMode: 'off', autoSaveDelay: 1000, formatOnSave: false }
    const parsed = JSON.parse(raw) as Partial<EditorPreferences>
    return {
      autoSaveMode: parsed.autoSaveMode ?? 'off',
      autoSaveDelay:
        typeof parsed.autoSaveDelay === 'number' && parsed.autoSaveDelay > 0
          ? parsed.autoSaveDelay
          : 1000,
      formatOnSave: parsed.formatOnSave ?? false,
    }
  } catch {
    return { autoSaveMode: 'off', autoSaveDelay: 1000, formatOnSave: false }
  }
}

function saveEditorPreferences(prefs: EditorPreferences): void {
  try {
    localStorage.setItem(EDITOR_PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // Ignore localStorage errors
  }
}

export const useSettingsStore = create<SettingsState>((set) => ({
  provider: null,
  workspacePath: '',
  ...loadEditorPreferences(),
  sidebarVisible: true,
  chatVisible: true,
  terminalVisible: false,
  activeSidebarPanel: 'files',

  loadSettings: async () => {
    try {
      const settings = await window.api.getSettings()
      set({
        provider: settings.provider ?? null,
        workspacePath: settings.workspacePath ?? '',
      })
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  },

  updateProvider: async (provider: ProviderSettings) => {
    try {
      await window.api.updateSettings({ provider })
      set({ provider })
    } catch (error) {
      console.error('Failed to update provider:', error)
    }
  },

  setAutoSaveMode: (mode: AutoSaveMode) => {
    set((state) => {
      const next = { autoSaveMode: mode, autoSaveDelay: state.autoSaveDelay }
      saveEditorPreferences(next)
      return next
    })
  },

  setAutoSaveDelay: (delay: number) => {
    const normalized = Math.max(300, Math.min(10000, Math.floor(delay)))
    set((state) => {
      const next = {
        autoSaveMode: state.autoSaveMode,
        autoSaveDelay: normalized,
        formatOnSave: state.formatOnSave,
      }
      saveEditorPreferences(next)
      return { autoSaveDelay: normalized }
    })
  },

  setFormatOnSave: (enabled: boolean) => {
    set((state) => {
      const next = {
        autoSaveMode: state.autoSaveMode,
        autoSaveDelay: state.autoSaveDelay,
        formatOnSave: enabled,
      }
      saveEditorPreferences(next)
      return { formatOnSave: enabled }
    })
  },

  setWorkspacePath: (path: string) => {
    set({ workspacePath: path })
  },

  toggleSidebar: () => {
    set((state) => ({ sidebarVisible: !state.sidebarVisible }))
  },

  toggleChatPanel: () => {
    set((state) => ({ chatVisible: !state.chatVisible }))
  },

  toggleTerminal: () => {
    set((state) => ({ terminalVisible: !state.terminalVisible }))
  },

  setActiveSidebarPanel: (panel: SidebarPanel) => {
    set({ activeSidebarPanel: panel })
  },

  setSidebarPanel: (panel: SidebarPanel) => {
    set({ activeSidebarPanel: panel })
  },
}))
